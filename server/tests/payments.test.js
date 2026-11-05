import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { buildApp, answerNotifications } from './helpers/app';
import { tokenFor } from './helpers/accounts';

// Recording a payment at the counter: POST /api/admin/orders/:id/payments.
// This is the code that decides how much a customer still owes, so the cases
// below pin the rules: no overpaying, refunds capped at what was paid, one
// branch can't touch another's orders, and a refused payment writes nothing.
let app;
let db;
let close;

beforeAll(async () => {
  ({ app, db, close } = await buildApp());
});
afterAll(() => close());
beforeEach(() => db.reset());

const pay = (body, role = 'laundry_staff') =>
  request(app).post('/api/admin/orders/7/payments').set('Authorization', `Bearer ${tokenFor(role)}`).send(body);

// An order for GHS 100 at branch 1 (the test staff member's branch) with
// `netPaid` already paid, and the queries a payment makes.
function scenario({ total = 100, netPaid = 0, lateFeePaid = 0, branchId = 1, noOrder = false, readyAt = null } = {}) {
  answerNotifications(db);
  db.on(/FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = \$1 FOR UPDATE/, noOrder ? [] : [{
    total_price: total, user_id: 1, branch_id: branchId, email: 'c@example.com', full_name: 'Ama',
    phone_number: '+233200000000', items_summary: 'Shirt x2', ready_for_pickup_at: readyAt, completed_at: null,
  }]);
  db.on(/AS net_paid,\s+COALESCE\(SUM\(amount\) FILTER/, [{ net_paid: netPaid, late_fee_paid: lateFeePaid }]);
  db.on(/INSERT INTO payments/, (params) => [{
    id: 99, order_id: params[0], amount: params[1], payment_method: params[2], payment_type: params[3],
    reference: params[4], notes: params[5], recorded_by: params[6],
  }]);
}

const inserted = () => db.callsMatching(/INSERT INTO payments/);
const rolledBack = () => db.callsMatching(/^\s*ROLLBACK/i).length > 0;

describe('recording a payment', () => {
  it('records a part payment and reports the balance left', async () => {
    scenario({ total: 100, netPaid: 0 });
    const res = await pay({ amount: 30, payment_method: 'cash', payment_type: 'deposit' });

    expect(res.status).toBe(201);
    expect(res.body.amount_paid).toBe(30);
    expect(res.body.balance_due).toBe(70);
    expect(inserted()).toHaveLength(1);
    // order id, amount, method, type, reference, notes, and who recorded it (staff account 2)
    expect(inserted()[0].params).toEqual(['7', 30, 'cash', 'deposit', null, null, 2]);
    expect(db.callsMatching(/^\s*COMMIT/i)).toHaveLength(1);
  });

  it('defaults the type to a partial payment', async () => {
    scenario();
    const res = await pay({ amount: 10, payment_method: 'mobile_money' });
    expect(res.status).toBe(201);
    expect(inserted()[0].params[3]).toBe('partial');
  });

  it('accepts exactly the remaining balance', async () => {
    scenario({ total: 100, netPaid: 60 });
    const res = await pay({ amount: 40, payment_method: 'cash', payment_type: 'balance' });
    expect(res.status).toBe(201);
    expect(res.body.balance_due).toBe(0);
  });

  it('tolerates half a pesewa of rounding either way', async () => {
    scenario({ total: 100, netPaid: 60 });
    expect((await pay({ amount: 40.004, payment_method: 'cash' })).status).toBe(201);
  });

  it('refuses to take more than is owed, and writes nothing', async () => {
    scenario({ total: 100, netPaid: 60 });
    const res = await pay({ amount: 40.5, payment_method: 'cash' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('That amount exceeds the remaining balance of GHS 40.00.');
    expect(inserted()).toHaveLength(0);
    expect(rolledBack()).toBe(true);
  });

  it('refuses any payment on an order that is already paid in full', async () => {
    scenario({ total: 100, netPaid: 100 });
    const res = await pay({ amount: 1, payment_method: 'cash' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('GHS 0.00');
  });
});

describe('refunds', () => {
  it('allows a refund up to what has been paid', async () => {
    scenario({ total: 100, netPaid: 100 });
    const res = await pay({ amount: 100, payment_method: 'cash', payment_type: 'refund' });
    expect(res.status).toBe(201);
    expect(res.body.amount_paid).toBe(0);
    expect(res.body.balance_due).toBe(100);
  });

  it('refuses a refund larger than what has been paid', async () => {
    scenario({ total: 100, netPaid: 40 });
    const res = await pay({ amount: 50, payment_method: 'cash', payment_type: 'refund' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Refund cannot exceed the amount already paid (GHS 40.00).');
    expect(inserted()).toHaveLength(0);
  });
});

describe('storage (late pickup) fees', () => {
  it('refuses a storage fee when nothing is owed', async () => {
    scenario({ readyAt: null });
    const res = await pay({ amount: 5, payment_method: 'cash', payment_type: 'late_fee' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('That amount exceeds the storage fee due of GHS 0.00.');
  });

  it('does not count a storage fee towards the order balance', async () => {
    // Ready 30 days ago: well past the free days, so a fee is owed.
    const readyAt = new Date(Date.now() - 30 * 86400000).toISOString();
    scenario({ total: 100, netPaid: 100, readyAt });
    const res = await pay({ amount: 1, payment_method: 'cash', payment_type: 'late_fee' });
    expect(res.status).toBe(201);
    expect(res.body.amount_paid).toBe(100);
    expect(res.body.balance_due).toBe(0);
  });
});

describe('who may record payments', () => {
  it('keeps a staff member to their own branch', async () => {
    scenario({ branchId: 2 });
    const res = await pay({ amount: 10, payment_method: 'cash' });
    expect(res.status).toBe(403);
    expect(inserted()).toHaveLength(0);
    expect(rolledBack()).toBe(true);
  });

  it('lets a super admin record a payment at any branch', async () => {
    scenario({ branchId: 2 });
    expect((await pay({ amount: 10, payment_method: 'cash' }, 'super_admin')).status).toBe(201);
  });

  it('keeps customers out', async () => {
    const res = await pay({ amount: 10, payment_method: 'cash' }, 'customer');
    expect(res.status).toBe(403);
  });

  it('answers 404 for an order that does not exist', async () => {
    scenario({ noOrder: true });
    const res = await pay({ amount: 10, payment_method: 'cash' });
    expect(res.status).toBe(404);
    expect(inserted()).toHaveLength(0);
  });
});

describe('input checks that stop before the database', () => {
  it.each([
    ['no amount', { payment_method: 'cash' }],
    ['a zero amount', { amount: 0, payment_method: 'cash' }],
    ['a negative amount', { amount: -5, payment_method: 'cash' }],
    ['an amount that is not a number', { amount: 'ten', payment_method: 'cash' }],
    ['no payment method', { amount: 10 }],
    ['an unknown payment method', { amount: 10, payment_method: 'bitcoin' }],
    ['an unknown payment type', { amount: 10, payment_method: 'cash', payment_type: 'gift' }],
  ])('rejects %s', async (_label, body) => {
    const res = await pay(body);
    expect(res.status).toBe(400);
    expect(inserted()).toHaveLength(0);
  });
});
