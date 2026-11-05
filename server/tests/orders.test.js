import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp, answerNotifications } from './helpers/app';
import { tokenFor } from './helpers/accounts';

// Placing and cancelling orders, and voiding invoices: the rules that decide
// who can do what to an order and when.
let app;
let db;
let close;

beforeAll(async () => {
  ({ app, db, close } = await buildApp());
});
afterAll(() => close());
beforeEach(() => db.reset());

const as = (role) => (method, path) => request(app)[method](path).set('Authorization', `Bearer ${tokenFor(role)}`);

function isoDate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

describe('placing an order', () => {
  const place = (body) => as('customer')('post', '/api/orders').send(body);
  const valid = { drop_off_date: isoDate(2), branch_id: 1, items: [{ laundry_item_id: 1, quantity: 2 }] };

  it('requires a login', async () => {
    const res = await request(app).post('/api/orders').send(valid);
    expect(res.status).toBe(401);
  });

  it.each([
    ['no drop-off date', { ...valid, drop_off_date: undefined }, 'drop_off_date is required.'],
    ['no branch', { ...valid, branch_id: undefined }, 'branch_id is required — choose which location to drop off at.'],
    ['no items', { ...valid, items: [] }, 'items must be a non-empty array of { laundry_item_id, quantity }.'],
    ['items that are not a list', { ...valid, items: 'shirt' }, 'items must be a non-empty array of { laundry_item_id, quantity }.'],
    ['a badly formatted date', { ...valid, drop_off_date: '05/11/2026' }, 'drop_off_date must be a valid date in YYYY-MM-DD format.'],
    ['an impossible date', { ...valid, drop_off_date: '2026-13-45' }, 'drop_off_date must be a valid date in YYYY-MM-DD format.'],
    ['a date in the past', { ...valid, drop_off_date: isoDate(-1) }, 'drop_off_date cannot be in the past.'],
  ])('rejects %s', async (_label, body, message) => {
    const res = await place(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
    expect(db.callsMatching(/INSERT INTO orders/)).toHaveLength(0);
  });

  it('rejects a branch that is not active, before reserving anything', async () => {
    db.on(/SELECT id FROM branches WHERE id = \$1 AND is_active = true/, []);
    const res = await place(valid);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('branch_id is not a valid, active branch.');
    expect(db.callsMatching(/daily_capacity/)).toHaveLength(0);
  });
});

describe('cancelling an order', () => {
  const cancel = (role = 'customer') => as(role)('post', '/api/orders/7/cancel').send({});

  function orderRow(changes = {}) {
    db.on(/SELECT \* FROM orders WHERE id = \$1 FOR UPDATE/, [{
      id: 7, user_id: 1, status: 'order_received', drop_off_date: '2026-11-10', branch_id: 1, ...changes,
    }]);
  }

  it('lets a customer cancel their own order before it is processed, and frees the slot', async () => {
    orderRow();
    db.on(/UPDATE orders SET status/, []);
    db.on(/INSERT INTO order_events/, []);
    db.on(/UPDATE daily_capacity SET current_orders/, []);

    const res = await cancel();

    expect(res.status).toBe(200);
    expect(db.callsMatching(/UPDATE orders SET status/)[0].params).toEqual(['cancelled', '7']);
    expect(db.callsMatching(/UPDATE daily_capacity/)).toHaveLength(1);
    expect(db.callsMatching(/^\s*COMMIT/i)).toHaveLength(1);
  });

  it('refuses once work has started', async () => {
    orderRow({ status: 'washing' });
    const res = await cancel();
    expect(res.status).toBe(400);
    expect(db.callsMatching(/UPDATE orders SET status/)).toHaveLength(0);
    expect(db.callsMatching(/^\s*ROLLBACK/i).length).toBeGreaterThan(0);
  });

  it('refuses to cancel someone else\'s order', async () => {
    orderRow({ user_id: 999 });
    const res = await cancel();
    expect(res.status).toBe(403);
    expect(db.callsMatching(/UPDATE orders SET status/)).toHaveLength(0);
  });

  it('answers 404 for an order that does not exist', async () => {
    db.on(/SELECT \* FROM orders WHERE id = \$1 FOR UPDATE/, []);
    const res = await cancel();
    expect(res.status).toBe(404);
  });

  it('does not release the capacity slot twice for an order that is already cancelled', async () => {
    orderRow({ status: 'cancelled' });
    const res = await cancel();
    expect(res.status).toBe(400);
    expect(db.callsMatching(/UPDATE daily_capacity/)).toHaveLength(0);
  });
});

describe('voiding an invoice', () => {
  const voidInvoice = (role = 'administrator') => as(role)('delete', '/api/admin/invoices/3');

  function invoice(changes = {}, netPaid = 0) {
    answerNotifications(db);
    db.on(/INSERT INTO audit_log/, []);
    db.on(/SELECT id, order_id, voided_at, branch_id FROM invoices WHERE id = \$1 FOR UPDATE/, [{
      id: 3, order_id: 7, voided_at: null, branch_id: 1, ...changes,
    }]);
    db.on(/AS net_paid FROM payments WHERE order_id = \$1/, [{ net_paid: netPaid }]);
    db.on(/UPDATE invoices SET voided_at/, []);
    db.on(/INSERT INTO invoice_activity/, []);
  }

  it('voids an invoice nobody has paid, and records who did it', async () => {
    invoice();
    const res = await voidInvoice();
    expect(res.status).toBe(200);
    expect(db.callsMatching(/UPDATE invoices SET voided_at/)).toHaveLength(1);
    expect(db.callsMatching(/INSERT INTO audit_log/)[0].params).toContain('invoice.voided');
  });

  it('refuses once money has been paid against the order', async () => {
    invoice({}, 25);
    const res = await voidInvoice();
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot void an invoice with payments recorded against its order.');
    expect(db.callsMatching(/UPDATE invoices SET voided_at/)).toHaveLength(0);
  });

  it('refuses to void twice', async () => {
    invoice({ voided_at: '2026-11-01T10:00:00Z' });
    const res = await voidInvoice();
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This invoice is already voided.');
  });

  it('keeps an administrator to their own branch', async () => {
    invoice({ branch_id: 2 });
    const res = await voidInvoice();
    expect(res.status).toBe(403);
    expect(db.callsMatching(/UPDATE invoices SET voided_at/)).toHaveLength(0);
  });

  it('lets a super admin void at any branch', async () => {
    invoice({ branch_id: 2 });
    expect((await voidInvoice('super_admin')).status).toBe(200);
  });

  it.each(['laundry_staff', 'customer'])('keeps %s out', async (role) => {
    expect((await voidInvoice(role)).status).toBe(403);
  });
});

describe('adding an invoice line', () => {
  const addLine = (body) => as('laundry_staff')('post', '/api/admin/invoices/3/lines').send(body);

  it.each([
    ['an unknown kind', { kind: 'gift', description: 'x', unit_amount: 5 }, /kind must be one of/],
    ['no description', { kind: 'fee', description: '  ', unit_amount: 5 }, /description is required/],
    ['a zero amount', { kind: 'fee', description: 'Delivery', unit_amount: 0 }, /non-zero number/],
    ['an amount that is not a number', { kind: 'fee', description: 'Delivery', unit_amount: 'five' }, /non-zero number/],
  ])('rejects %s', async (_label, body, message) => {
    const res = await addLine(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(db.callsMatching(/INSERT INTO invoice_items/)).toHaveLength(0);
  });

  it('refuses to edit a voided invoice', async () => {
    db.on(/SELECT id, voided_at, branch_id FROM invoices WHERE id = \$1 FOR UPDATE/, [{ id: 3, voided_at: '2026-11-01', branch_id: 1 }]);
    const res = await addLine({ kind: 'fee', description: 'Delivery', unit_amount: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This invoice has been voided.');
  });
});
