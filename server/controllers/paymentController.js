const pool = require('../config/db');
const { notifyUser } = require('../services/notify');
const { calculateLateFee } = require('../utils/lateFee');
const { DIFFERENT_BRANCH_ERROR, canAccessBranch, canViewOrder } = require('../utils/branchAccess');

const PAYMENT_METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card', 'other'];
const PAYMENT_TYPES = ['deposit', 'partial', 'balance', 'full', 'refund', 'late_fee'];

// Net amount paid so far towards an order's total — refunds subtract, and
// storage-fee collections don't count because the fee sits outside total_price.
const NET_PAID_EXPR = `COALESCE(SUM(CASE WHEN payment_type = 'refund' THEN -amount WHEN payment_type = 'late_fee' THEN 0 ELSE amount END), 0)`;

async function recordPayment(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { amount, payment_method, payment_type, reference, notes } = req.body;

    const amountNum = Number(amount);
    if (!(amountNum > 0)) {
      return res.status(400).json({ error: 'amount must be a positive number.' });
    }
    if (!PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({ error: `payment_method must be one of: ${PAYMENT_METHODS.join(', ')}` });
    }
    const type = payment_type || 'partial';
    if (!PAYMENT_TYPES.includes(type)) {
      return res.status(400).json({ error: `payment_type must be one of: ${PAYMENT_TYPES.join(', ')}` });
    }

    await client.query('BEGIN');

    const orderResult = await client.query(
      `SELECT o.total_price, o.user_id, o.branch_id, u.email, u.full_name, u.phone_number,
              (SELECT string_agg(item_name || ' x' || quantity, ', ') FROM order_items WHERE order_id = o.id) AS items_summary,
              (SELECT created_at FROM order_events WHERE order_id = o.id AND to_status = 'ready_for_pickup' ORDER BY created_at DESC LIMIT 1) AS ready_for_pickup_at,
              (SELECT created_at FROM order_events WHERE order_id = o.id AND to_status = 'completed' ORDER BY created_at DESC LIMIT 1) AS completed_at
       FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1 FOR UPDATE`,
      [id]
    );
    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderResult.rows[0];

    if (!canAccessBranch(req.user, order.branch_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: DIFFERENT_BRANCH_ERROR });
    }

    const netPaidResult = await client.query(
      `SELECT ${NET_PAID_EXPR} AS net_paid,
              COALESCE(SUM(amount) FILTER (WHERE payment_type = 'late_fee'), 0) AS late_fee_paid
       FROM payments WHERE order_id = $1`,
      [id]
    );
    const netPaid = Number(netPaidResult.rows[0].net_paid);
    const totalPrice = Number(order.total_price);

    if (type === 'late_fee') {
      const { fee } = calculateLateFee(order.ready_for_pickup_at, order.completed_at || new Date());
      const feeDue = Math.max(fee - Number(netPaidResult.rows[0].late_fee_paid), 0);
      if (amountNum > feeDue + 0.005) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `That amount exceeds the storage fee due of GHS ${feeDue.toFixed(2)}.`,
        });
      }
    } else if (type === 'refund') {
      if (amountNum > netPaid + 0.005) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Refund cannot exceed the amount already paid (GHS ${netPaid.toFixed(2)}).`,
        });
      }
    } else if (netPaid + amountNum > totalPrice + 0.005) {
      const remaining = Math.max(totalPrice - netPaid, 0);
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `That amount exceeds the remaining balance of GHS ${remaining.toFixed(2)}.`,
      });
    }

    const result = await client.query(
      `INSERT INTO payments (order_id, amount, payment_method, payment_type, reference, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, order_id, amount, payment_method, payment_type, reference, notes, recorded_by, paid_at, created_at`,
      [id, amountNum, payment_method, type, reference || null, notes || null, req.user.id]
    );

    await client.query('COMMIT');

    let newNetPaid = netPaid + amountNum;
    if (type === 'refund') newNetPaid = netPaid - amountNum;
    if (type === 'late_fee') newNetPaid = netPaid;
    const balance = Math.max(totalPrice - newNetPaid, 0);
    let verb = 'Payment received';
    if (type === 'refund') verb = 'Refund issued';
    if (type === 'late_fee') verb = 'Storage fee received';
    notifyUser(order.user_id, {
      type: 'payment',
      title: verb,
      body: `${verb}: GHS ${amountNum.toFixed(2)} (${payment_method.replace('_', ' ')}) for your order (${order.items_summary || 'items'}). Balance remaining: GHS ${balance.toFixed(2)}.`,
      email: order.email,
      phone: order.phone_number,
    }).catch((err) => console.error('[notify] failed:', err.message));

    res.status(201).json({ payment: result.rows[0], amount_paid: newNetPaid, balance_due: balance });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// An order's own payment history — its owner or any staff member can view it.
async function listOrderPayments(req, res, next) {
  try {
    const { id } = req.params;
    const orderCheck = await pool.query('SELECT user_id, branch_id, total_price FROM orders WHERE id = $1', [id]);
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (!canViewOrder(req.user, orderCheck.rows[0])) {
      return res.status(403).json({ error: 'You do not have permission to view this order.' });
    }

    const result = await pool.query(
      `SELECT p.id, p.amount, p.payment_method, p.payment_type, p.reference, p.notes, p.paid_at, p.created_at,
              u.full_name AS recorded_by_name
       FROM payments p
       LEFT JOIN users u ON u.id = p.recorded_by
       WHERE p.order_id = $1
       ORDER BY p.paid_at ASC`,
      [id]
    );

    const netPaid = result.rows.reduce((sum, p) => {
      if (p.payment_type === 'late_fee') return sum;
      return sum + (p.payment_type === 'refund' ? -Number(p.amount) : Number(p.amount));
    }, 0);
    const balance = Math.max(Number(orderCheck.rows[0].total_price) - netPaid, 0);

    res.json({ payments: result.rows, amount_paid: netPaid, balance_due: balance });
  } catch (err) {
    next(err);
  }
}

// Global transaction ledger across every order — administrators only.
async function listAllPayments(req, res, next) {
  try {
    const { start, end, payment_method, payment_type, branch_id } = req.query;
    const conditions = [];
    const params = [];

    // Non-super_admin staff only ever see their own branch's ledger;
    // super_admin may filter by branch_id or omit it to see every branch.
    const effectiveBranchId = req.user.branch_id || branch_id;
    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      conditions.push(`o.branch_id = $${params.length}`);
    }
    if (start) {
      params.push(start);
      conditions.push(`p.paid_at::date >= $${params.length}`);
    }
    if (end) {
      params.push(end);
      conditions.push(`p.paid_at::date <= $${params.length}`);
    }
    if (payment_method) {
      params.push(payment_method);
      conditions.push(`p.payment_method = $${params.length}`);
    }
    if (payment_type) {
      params.push(payment_type);
      conditions.push(`p.payment_type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT p.id, p.order_id, p.amount, p.payment_method, p.payment_type, p.reference, p.notes, p.paid_at,
              u.full_name AS recorded_by_name, c.full_name AS customer_name
       FROM payments p
       LEFT JOIN users u ON u.id = p.recorded_by
       JOIN orders o ON o.id = p.order_id
       JOIN users c ON c.id = o.user_id
       ${where}
       ORDER BY p.paid_at DESC
       LIMIT 500`,
      params
    );

    const totalsResult = await pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE payment_type != 'refund'), 0) AS total_collected,
         COALESCE(SUM(amount) FILTER (WHERE payment_type = 'refund'), 0) AS total_refunded
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       ${where}`,
      params
    );

    res.json({
      payments: result.rows,
      total_collected: Number(totalsResult.rows[0].total_collected),
      total_refunded: Number(totalsResult.rows[0].total_refunded),
    });
  } catch (err) {
    next(err);
  }
}

// A customer's own payments across all their orders, newest first. Always
// scoped to the signed-in user, so it takes no user or order id from the request.
async function listMyPayments(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT p.id, p.order_id, p.amount, p.payment_method, p.payment_type, p.paid_at
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.user_id = $1
       ORDER BY p.paid_at DESC, p.id DESC`,
      [req.user.id]
    );
    res.json({ payments: result.rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { recordPayment, listOrderPayments, listMyPayments, listAllPayments, NET_PAID_EXPR };
