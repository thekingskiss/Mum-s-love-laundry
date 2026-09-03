const crypto = require('crypto');
const pool = require('../config/db');
const { notifyUser } = require('../services/notify');
const { isStaffRole } = require('../config/orderLifecycle');
const { NET_PAID_EXPR } = require('./paymentController');
const paystack = require('../services/paystack');

const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
const CHARGE_PAYMENT_TYPES = ['deposit', 'partial', 'balance', 'full'];

function mapChannelToMethod(channel) {
  if (channel === 'card') return 'card';
  if (channel === 'mobile_money') return 'mobile_money';
  if (channel === 'bank' || channel === 'bank_transfer') return 'bank_transfer';
  return 'other';
}

// Customer paying their own order, or staff initiating a charge/payment link
// on a customer's behalf — both hit this the same way, just from different
// screens. Nothing is written to `payments` here; that only happens once
// Paystack confirms the charge actually succeeded (see finalizePaystackPayment).
async function initializePayment(req, res, next) {
  try {
    if (!paystack.configured()) {
      return res.status(503).json({ error: 'Online payments are not configured yet.' });
    }

    const { order_id, amount, payment_type } = req.body;
    const amountNum = Number(amount);
    if (!order_id || !(amountNum > 0)) {
      return res.status(400).json({ error: 'order_id and a positive amount are required.' });
    }
    const type = CHARGE_PAYMENT_TYPES.includes(payment_type) ? payment_type : 'partial';

    const orderResult = await pool.query(
      `SELECT o.id, o.total_price, o.user_id, u.email
       FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
      [order_id]
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderResult.rows[0];

    if (order.user_id !== req.user.id && !isStaffRole(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to pay for this order.' });
    }

    const netPaidResult = await pool.query(`SELECT ${NET_PAID_EXPR} AS net_paid FROM payments WHERE order_id = $1`, [order_id]);
    const netPaid = Number(netPaidResult.rows[0].net_paid);
    const balance = Math.max(Number(order.total_price) - netPaid, 0);
    if (balance <= 0) {
      return res.status(400).json({ error: 'This order has no balance due.' });
    }
    if (amountNum > balance + 0.005) {
      return res.status(400).json({ error: `That amount exceeds the remaining balance of GHS ${balance.toFixed(2)}.` });
    }

    const reference = `mll_${order_id}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const data = await paystack.initializeTransaction({
      email: order.email,
      amountPesewas: Math.round(amountNum * 100),
      reference,
      callbackUrl: `${CLIENT_ORIGIN}/payments/callback`,
      metadata: { order_id: order.id, payment_type: type, initiated_by: req.user.id },
    });

    res.json({ authorization_url: data.authorization_url, reference: data.reference });
  } catch (err) {
    next(err);
  }
}

// Shared by the browser-redirect verify call and the webhook. Always
// re-verifies against Paystack itself (never trusts the caller's claimed
// amount/status) and is idempotent on `reference`, so whichever of the two
// confirms first wins and the other becomes a no-op.
async function finalizePaystackPayment(reference) {
  const data = await paystack.verifyTransaction(reference);

  if (data.status !== 'success') {
    return { status: data.status, payment: null };
  }

  const existing = await pool.query(
    `SELECT id, order_id, amount, payment_method, payment_type, reference, notes, paid_at, created_at
     FROM payments WHERE reference = $1`,
    [reference]
  );
  if (existing.rows.length > 0) {
    return { status: 'success', payment: existing.rows[0], alreadyRecorded: true };
  }

  const orderId = data.metadata?.order_id;
  if (!orderId) {
    throw new Error(`Paystack transaction ${reference} is missing order_id metadata.`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `SELECT o.total_price, o.user_id, u.email, u.full_name, u.phone_number,
              (SELECT string_agg(item_name || ' x' || quantity, ', ') FROM order_items WHERE order_id = o.id) AS items_summary
       FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1 FOR UPDATE`,
      [orderId]
    );
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error(`Order ${orderId} for Paystack reference ${reference} no longer exists.`);
    }
    const order = orderResult.rows[0];

    const netPaidResult = await client.query(`SELECT ${NET_PAID_EXPR} AS net_paid FROM payments WHERE order_id = $1`, [orderId]);
    const netPaid = Number(netPaidResult.rows[0].net_paid);
    const totalPrice = Number(order.total_price);
    const amountPaid = data.amount / 100;
    const type = CHARGE_PAYMENT_TYPES.includes(data.metadata?.payment_type) ? data.metadata.payment_type : 'partial';
    const method = mapChannelToMethod(data.channel);

    const result = await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_type, reference, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, order_id, amount, payment_method, payment_type, reference, notes, recorded_by, paid_at, created_at`,
      [orderId, amountPaid, method, type, reference, 'Paid online via Paystack', null]
    );

    await client.query('COMMIT');

    const newNetPaid = netPaid + amountPaid;
    const balance = Math.max(totalPrice - newNetPaid, 0);
    notifyUser(order.user_id, {
      type: 'payment',
      title: 'Payment received',
      body: `Payment received: GHS ${amountPaid.toFixed(2)} (${method.replace('_', ' ')}) for your order (${order.items_summary || 'items'}). Balance remaining: GHS ${balance.toFixed(2)}.`,
      email: order.email,
      phone: order.phone_number,
    }).catch((err) => console.error('[notify] failed:', err.message));

    return { status: 'success', payment: result.rows[0], amount_paid: newNetPaid, balance_due: balance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Called by the client after Paystack redirects back — the primary
// confirmation path from the payer's point of view. The webhook below is the
// backup in case the browser never makes it back (closed tab, network drop).
async function verifyPayment(req, res, next) {
  try {
    if (!paystack.configured()) {
      return res.status(503).json({ error: 'Online payments are not configured yet.' });
    }

    const { reference } = req.params;
    const result = await finalizePaystackPayment(reference);

    if (result.status !== 'success') {
      return res.json({ status: result.status });
    }

    const orderCheck = await pool.query('SELECT user_id FROM orders WHERE id = $1', [result.payment.order_id]);
    if (orderCheck.rows.length > 0 && orderCheck.rows[0].user_id !== req.user.id && !isStaffRole(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to view this payment.' });
    }

    res.json({ status: 'success', payment: result.payment, order_id: result.payment.order_id });
  } catch (err) {
    next(err);
  }
}

// Paystack calls this directly — no user session, so it's authenticated by
// HMAC signature instead. Always acks 200 once the signature checks out (even
// if finalizing fails) so Paystack doesn't retry-storm us over something the
// /verify round trip will most likely already have resolved; failures are
// logged for follow-up rather than surfaced as a webhook error.
async function webhook(req, res, next) {
  try {
    const signature = req.headers['x-paystack-signature'];
    const secret = paystack.secretKey();
    if (!secret || !signature || !req.rawBody) {
      return res.status(400).end();
    }
    const expected = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex');
    if (expected !== signature) {
      return res.status(401).end();
    }

    const event = req.body;
    if (event?.event === 'charge.success' && event.data?.reference) {
      finalizePaystackPayment(event.data.reference).catch((err) =>
        console.error('[paystack webhook] failed to finalize:', err.message)
      );
    }

    res.status(200).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { initializePayment, verifyPayment, webhook, finalizePaystackPayment };
