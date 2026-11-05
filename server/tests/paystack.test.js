import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { buildApp, answerNotifications } from './helpers/app';
import { tokenFor } from './helpers/accounts';

// Online payments. Three things matter most and are pinned here:
//   1. the webhook only believes a correctly signed request;
//   2. the amount recorded is the one Paystack confirms, never the caller's;
//   3. the same payment is never recorded twice, whether Paystack's webhook,
//      the customer's browser, or both report it.
const SECRET_KEY = 'sk_test_secret_for_tests';
const REFERENCE = 'mll_7_1700000000000_abc123';

let app;
let db;
let close;

beforeAll(async () => {
  ({ app, db, close } = await buildApp());
});
afterAll(() => close());

beforeEach(() => {
  db.reset();
  process.env.PAYSTACK_SECRET_KEY = SECRET_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PAYSTACK_SECRET_KEY;
});

// Stands in for Paystack's API. `data` is what GET /transaction/verify returns.
function stubPaystack(data, { ok = true, status = true } = {}) {
  const fetchStub = vi.fn(async () => ({ ok, status: ok ? 200 : 400, json: async () => ({ status, data, message: 'stub' }) }));
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

const SUCCESS = {
  status: 'success',
  amount: 5000, // pesewas: GHS 50
  channel: 'mobile_money',
  reference: REFERENCE,
  metadata: { order_id: 7, payment_type: 'deposit' },
};

// The queries a successful confirmation makes.
function orderAndPayments({ existing = [], total = 100, netPaid = 0 } = {}) {
  answerNotifications(db);
  db.on(/FROM payments WHERE reference = \$1/, existing);
  db.on(/FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = \$1 FOR UPDATE/, [{
    total_price: total, user_id: 1, email: 'c@example.com', full_name: 'Ama', phone_number: '+233200000000', items_summary: 'Shirt x2',
  }]);
  db.on(/AS net_paid FROM payments WHERE order_id/, [{ net_paid: netPaid }]);
  db.on(/INSERT INTO payments/, (params) => [{
    id: 55, order_id: params[0], amount: params[1], payment_method: params[2], payment_type: params[3], reference: params[4],
  }]);
  // verifyPayment checks the caller may see the order (customer 1 owns it).
  db.on(/SELECT user_id, branch_id FROM orders WHERE id = \$1/, [{ user_id: 1, branch_id: 1 }]);
}

const inserted = () => db.callsMatching(/INSERT INTO payments/);

function sign(body, key = SECRET_KEY) {
  return crypto.createHmac('sha512', key).update(body).digest('hex');
}

function sendWebhook(payload, signature) {
  const body = JSON.stringify(payload);
  const req = request(app).post('/api/paystack/webhook').set('Content-Type', 'application/json');
  if (signature !== null) req.set('x-paystack-signature', signature === undefined ? sign(body) : signature);
  return req.send(body);
}

const CHARGE_SUCCESS = { event: 'charge.success', data: { reference: REFERENCE } };

describe('the webhook signature', () => {
  it('refuses a request with no signature', async () => {
    const res = await sendWebhook(CHARGE_SUCCESS, null);
    expect(res.status).toBe(400);
  });

  it('refuses a signature made with the wrong key', async () => {
    const fetchStub = stubPaystack(SUCCESS);
    const res = await sendWebhook(CHARGE_SUCCESS, sign(JSON.stringify(CHARGE_SUCCESS), 'someone-elses-key'));
    expect(res.status).toBe(401);
    expect(fetchStub).not.toHaveBeenCalled();
    expect(inserted()).toHaveLength(0);
  });

  it('refuses a signature of the wrong length', async () => {
    const res = await sendWebhook(CHARGE_SUCCESS, 'abc');
    expect(res.status).toBe(401);
  });

  it('refuses a genuine signature if the body was changed afterwards', async () => {
    const signedBody = JSON.stringify(CHARGE_SUCCESS);
    const tampered = { event: 'charge.success', data: { reference: 'mll_999_other' } };
    const res = await sendWebhook(tampered, sign(signedBody));
    expect(res.status).toBe(401);
  });

  it('refuses everything when no Paystack key is configured', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const res = await sendWebhook(CHARGE_SUCCESS, sign(JSON.stringify(CHARGE_SUCCESS)));
    expect(res.status).toBe(400);
  });
});

describe('the webhook, once signed correctly', () => {
  it('re-checks the payment with Paystack and records it', async () => {
    const fetchStub = stubPaystack(SUCCESS);
    orderAndPayments();

    const res = await sendWebhook(CHARGE_SUCCESS);

    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(inserted()).toHaveLength(1));
    // It asked Paystack about this reference rather than trusting the webhook body.
    expect(fetchStub.mock.calls[0][0]).toContain(`/transaction/verify/${REFERENCE}`);
    // The amount recorded is what Paystack confirmed: 5000 pesewas = GHS 50.
    expect(inserted()[0].params).toEqual([7, 50, 'mobile_money', 'deposit', REFERENCE, 'Paid online via Paystack', null]);
  });

  it('ignores events other than a successful charge', async () => {
    const fetchStub = stubPaystack(SUCCESS);
    const res = await sendWebhook({ event: 'charge.failed', data: { reference: REFERENCE } });
    expect(res.status).toBe(200);
    expect(fetchStub).not.toHaveBeenCalled();
    expect(inserted()).toHaveLength(0);
  });

  it('still answers 200 when recording fails, so Paystack does not retry forever', async () => {
    stubPaystack(SUCCESS);
    db.on(/FROM payments WHERE reference = \$1/, () => new Error('database down'));
    const res = await sendWebhook(CHARGE_SUCCESS);
    expect(res.status).toBe(200);
  });
});

describe('confirming a payment from the customer browser', () => {
  const verify = (role = 'customer') =>
    request(app).get(`/api/paystack/verify/${REFERENCE}`).set('Authorization', `Bearer ${tokenFor(role)}`);

  it('records the payment Paystack confirms', async () => {
    stubPaystack(SUCCESS);
    orderAndPayments({ total: 100, netPaid: 0 });

    const res = await verify();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.order_id).toBe(7);
    expect(inserted()).toHaveLength(1);
    expect(inserted()[0].params[1]).toBe(50);
  });

  it('does not record the same payment again if it is already there', async () => {
    stubPaystack(SUCCESS);
    orderAndPayments({ existing: [{ id: 55, order_id: 7, amount: 50, reference: REFERENCE }] });

    const res = await verify();

    expect(res.status).toBe(200);
    expect(res.body.payment.id).toBe(55);
    expect(inserted()).toHaveLength(0);
  });

  it('treats losing a race with the webhook as success, not an error', async () => {
    stubPaystack(SUCCESS);
    orderAndPayments();
    // The "already recorded?" check finds nothing, then the webhook's insert
    // lands first, so ours hits the unique index on payments.reference.
    const duplicate = Object.assign(new Error('duplicate key value'), { code: '23505' });
    db.first(/INSERT INTO payments/, () => duplicate);
    let lookups = 0;
    db.first(/FROM payments WHERE reference = \$1/, () => {
      lookups += 1;
      return lookups === 1 ? [] : [{ id: 55, order_id: 7, amount: 50, reference: REFERENCE }];
    });

    const res = await verify();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.payment.id).toBe(55);
    expect(db.callsMatching(/^\s*ROLLBACK/i).length).toBeGreaterThan(0);
  });

  it('records nothing for a payment that did not succeed', async () => {
    stubPaystack({ ...SUCCESS, status: 'abandoned' });
    orderAndPayments();
    const res = await verify();
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('abandoned');
    expect(inserted()).toHaveLength(0);
  });

  it('will not show one customer another customer\'s payment', async () => {
    stubPaystack(SUCCESS);
    orderAndPayments();
    // The order belongs to someone else (customer 1 is the test customer).
    db.first(/SELECT user_id, branch_id FROM orders WHERE id = \$1/, [{ user_id: 999, branch_id: 1 }]);
    const res = await verify();
    expect(res.status).toBe(403);
  });

  it('reports a transaction with no order attached as a server error', async () => {
    stubPaystack({ ...SUCCESS, metadata: {} });
    db.on(/FROM payments WHERE reference = \$1/, []);
    const res = await verify();
    expect(res.status).toBe(500);
    expect(inserted()).toHaveLength(0);
  });

  it('answers 503 when online payments are not set up', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const res = await verify();
    expect(res.status).toBe(503);
  });
});

describe('starting a payment', () => {
  const initialize = (body, role = 'customer') =>
    request(app).post('/api/paystack/initialize').set('Authorization', `Bearer ${tokenFor(role)}`).send(body);

  function ownOrder({ total = 100, netPaid = 0, ownerId = 1 } = {}) {
    db.on(/SELECT o.id, o.total_price, o.user_id, o.branch_id, u.email/, [{
      id: 7, total_price: total, user_id: ownerId, branch_id: 1, email: 'c@example.com',
    }]);
    db.on(/AS net_paid FROM payments WHERE order_id = \$1/, [{ net_paid: netPaid }]);
  }

  it('asks Paystack to charge the amount in pesewas and returns the payment link', async () => {
    const fetchStub = stubPaystack({ authorization_url: 'https://checkout.paystack.com/abc', reference: 'ref_1' });
    ownOrder();

    const res = await initialize({ order_id: 7, amount: 25.5, payment_type: 'deposit' });

    expect(res.status).toBe(200);
    expect(res.body.authorization_url).toBe('https://checkout.paystack.com/abc');
    const sent = JSON.parse(fetchStub.mock.calls[0][1].body);
    expect(sent.amount).toBe(2550);
    expect(sent.currency).toBe('GHS');
    expect(sent.email).toBe('c@example.com');
    expect(sent.metadata).toMatchObject({ order_id: 7, payment_type: 'deposit', initiated_by: 1 });
    expect(sent.reference).toMatch(/^mll_7_/);
    // Nothing is recorded until Paystack confirms the charge.
    expect(inserted()).toHaveLength(0);
  });

  it('refuses to charge more than the balance', async () => {
    const fetchStub = stubPaystack({});
    ownOrder({ total: 100, netPaid: 80 });
    const res = await initialize({ order_id: 7, amount: 30 });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('GHS 20.00');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('refuses when the order is already paid', async () => {
    stubPaystack({});
    ownOrder({ total: 100, netPaid: 100 });
    const res = await initialize({ order_id: 7, amount: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This order has no balance due.');
  });

  it('will not let a customer pay for someone else\'s order', async () => {
    const fetchStub = stubPaystack({});
    ownOrder({ ownerId: 999 });
    const res = await initialize({ order_id: 7, amount: 10 });
    expect(res.status).toBe(403);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it.each([
    ['no order', { amount: 10 }],
    ['no amount', { order_id: 7 }],
    ['a zero amount', { order_id: 7, amount: 0 }],
    ['a negative amount', { order_id: 7, amount: -5 }],
  ])('rejects %s', async (_label, body) => {
    stubPaystack({});
    const res = await initialize(body);
    expect(res.status).toBe(400);
  });

  it('answers 503 when online payments are not set up', async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const res = await initialize({ order_id: 7, amount: 10 });
    expect(res.status).toBe(503);
  });
});
