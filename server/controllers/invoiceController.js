const crypto = require('crypto');
const pool = require('../config/db');
const { notifyUser } = require('../services/notify');
const { isStaffRole } = require('../config/orderLifecycle');
const { NET_PAID_EXPR } = require('./paymentController');
const { finalizePaystackPayment } = require('./paystackController');
const paystack = require('../services/paystack');
const { renderInvoicePdf } = require('../services/invoicePdf');

const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
const ADJUSTMENT_KINDS = ['discount', 'fee', 'tax'];

// Balance/status are always derived live from the same payments ledger
// orders already use (NET_PAID_EXPR) — an invoice never stores its own
// redundant balance, it's a frozen bill layered on top of one order's
// payment history.
const INVOICE_SELECT = `
  SELECT i.id, i.invoice_number, i.order_id, i.branch_id, i.customer_name, i.customer_phone, i.customer_email,
         i.due_date, i.notes, i.subtotal, i.total_amount, i.public_token, i.voided_at,
         i.created_by, i.created_at, o.user_id AS order_owner_id, o.status AS order_status,
         COALESCE(pay.net_paid, 0) AS amount_paid,
         GREATEST(i.total_amount - COALESCE(pay.net_paid, 0), 0) AS balance_due,
         CASE
           WHEN i.voided_at IS NOT NULL THEN 'voided'
           WHEN COALESCE(pay.net_paid, 0) <= 0 THEN 'not_paid'
           WHEN COALESCE(pay.net_paid, 0) + 0.005 >= i.total_amount THEN 'paid'
           ELSE 'partial'
         END AS payment_status
  FROM invoices i
  JOIN orders o ON o.id = i.order_id
  LEFT JOIN LATERAL (
    SELECT ${NET_PAID_EXPR} AS net_paid FROM payments WHERE order_id = i.order_id
  ) pay ON true
`;

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

async function recomputeInvoiceTotal(client, invoiceId) {
  const result = await client.query(
    `UPDATE invoices SET total_amount = (SELECT COALESCE(SUM(line_total), 0) FROM invoice_items WHERE invoice_id = $1)
     WHERE id = $1
     RETURNING id, invoice_number, order_id, customer_name, customer_phone, customer_email,
               due_date, notes, subtotal, total_amount, voided_at, created_at`,
    [invoiceId]
  );
  return result.rows[0];
}

// Does the actual work of turning an order into an invoice — shared by the
// single-order endpoint and the bulk endpoint below. Runs inside the
// caller's transaction (BEGIN/COMMIT/ROLLBACK is the caller's job) and
// throws an Error with a `.status` for the caller to map to an HTTP/skip
// response. requesterBranchId is the acting staff member's own branch
// (null for super_admin) — passed through so bulk-generate can silently
// skip orders outside a branch-scoped staff member's reach.
async function generateInvoiceCore(client, orderId, { dueDate, notes, actorId, requesterBranchId }) {
  const orderResult = await client.query(
    `SELECT o.id, o.branch_id, u.full_name, u.phone_number, u.email
     FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1 FOR UPDATE`,
    [orderId]
  );
  if (orderResult.rows.length === 0) {
    const err = new Error('Order not found.');
    err.status = 404;
    throw err;
  }
  const order = orderResult.rows[0];

  if (requesterBranchId && order.branch_id !== requesterBranchId) {
    const err = new Error('This order belongs to a different branch.');
    err.status = 403;
    throw err;
  }

  const existing = await client.query('SELECT id FROM invoices WHERE order_id = $1 AND voided_at IS NULL', [orderId]);
  if (existing.rows.length > 0) {
    const err = new Error('This order already has an active invoice — void it before generating a new one.');
    err.status = 409;
    throw err;
  }

  const itemsResult = await client.query(
    'SELECT item_name, quantity, unit_price, line_total FROM order_items WHERE order_id = $1 ORDER BY id',
    [orderId]
  );
  if (itemsResult.rows.length === 0) {
    const err = new Error('This order has no items to invoice.');
    err.status = 400;
    throw err;
  }

  const subtotal = itemsResult.rows.reduce((sum, li) => sum + Number(li.line_total), 0);
  const resolvedDueDate = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const publicToken = crypto.randomBytes(32).toString('hex');

  const invoiceResult = await client.query(
    `INSERT INTO invoices
       (invoice_number, order_id, branch_id, customer_name, customer_phone, customer_email, due_date, notes, subtotal, total_amount, public_token, created_by)
     VALUES ('INV-' || lpad(nextval('invoice_number_seq')::text, 4, '0'), $1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10)
     RETURNING id, invoice_number, order_id, branch_id, customer_name, customer_phone, customer_email, due_date, notes, subtotal, total_amount, public_token, created_at`,
    [orderId, order.branch_id, order.full_name, order.phone_number, order.email, resolvedDueDate, notes || null, subtotal, publicToken, actorId]
  );
  const invoice = invoiceResult.rows[0];

  let sortOrder = 0;
  for (const li of itemsResult.rows) {
    await client.query(
      `INSERT INTO invoice_items (invoice_id, kind, description, quantity, unit_amount, line_total, sort_order)
       VALUES ($1, 'item', $2, $3, $4, $5, $6)`,
      [invoice.id, li.item_name, li.quantity, li.unit_price, li.line_total, sortOrder++]
    );
  }

  await client.query(
    `INSERT INTO invoice_activity (invoice_id, event_type, actor_id, body) VALUES ($1, 'created', $2, $3)`,
    [invoice.id, actorId, `Invoice ${invoice.invoice_number} created.`]
  );

  return invoice;
}

// Staff generates an invoice from an existing order — snapshots its items
// (mirrors how order_items itself snapshots the laundry_items catalog) and
// freezes a due date, invoice number, and pay-without-login token.
async function generateInvoice(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { due_date, notes } = req.body;

    if (due_date && !isValidDateString(due_date)) {
      return res.status(400).json({ error: 'due_date must be a valid date in YYYY-MM-DD format.' });
    }

    await client.query('BEGIN');
    const invoice = await generateInvoiceCore(client, id, {
      dueDate: due_date,
      notes,
      actorId: req.user.id,
      requesterBranchId: req.user.branch_id,
    });
    await client.query('COMMIT');
    res.status(201).json({ invoice });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    client.release();
  }
}

// Bulk equivalent of generateInvoice — one transaction per order so a
// failure on one (already invoiced, wrong branch, etc.) doesn't roll back
// the others. Mirrors Hubtel's "Many Invoices" bulk-create action, scoped
// down to "generate for several selected orders" rather than a recurring/
// subscription billing engine (this business has no subscription model).
async function bulkGenerateInvoices(req, res, next) {
  try {
    const { order_ids, due_date, notes } = req.body;
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ error: 'order_ids must be a non-empty array.' });
    }
    if (due_date && !isValidDateString(due_date)) {
      return res.status(400).json({ error: 'due_date must be a valid date in YYYY-MM-DD format.' });
    }

    const created = [];
    const skipped = [];

    for (const orderId of order_ids) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const invoice = await generateInvoiceCore(client, orderId, {
          dueDate: due_date,
          notes,
          actorId: req.user.id,
          requesterBranchId: req.user.branch_id,
        });
        await client.query('COMMIT');
        created.push(invoice);
      } catch (err) {
        await client.query('ROLLBACK');
        skipped.push({ order_id: orderId, reason: err.message });
      } finally {
        client.release();
      }
    }

    res.status(201).json({ created, skipped });
  } catch (err) {
    next(err);
  }
}

// Adds an ad hoc discount/fee/tax line — the "Add discount/taxes/fees" row
// on Hubtel's invoice screen. Order-item lines aren't editable here; void
// and regenerate the invoice if the underlying order changed.
async function addInvoiceLine(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { kind, description, quantity, unit_amount } = req.body;

    if (!ADJUSTMENT_KINDS.includes(kind)) {
      return res.status(400).json({ error: `kind must be one of: ${ADJUSTMENT_KINDS.join(', ')}.` });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'description is required.' });
    }
    const qty = Number(quantity) || 1;
    const unitAmountNum = Number(unit_amount);
    if (!Number.isFinite(unitAmountNum) || unitAmountNum === 0) {
      return res.status(400).json({ error: 'unit_amount must be a non-zero number.' });
    }
    // Discounts are always stored (and displayed) as negative, whichever
    // sign the caller sent.
    const signedUnitAmount = kind === 'discount' ? -Math.abs(unitAmountNum) : Math.abs(unitAmountNum);
    const lineTotal = signedUnitAmount * qty;

    await client.query('BEGIN');

    const invoiceCheck = await client.query('SELECT id, voided_at FROM invoices WHERE id = $1 FOR UPDATE', [id]);
    if (invoiceCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    if (invoiceCheck.rows[0].voided_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This invoice has been voided.' });
    }

    const nextSort = await client.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM invoice_items WHERE invoice_id = $1', [id]);

    const lineResult = await client.query(
      `INSERT INTO invoice_items (invoice_id, kind, description, quantity, unit_amount, line_total, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, kind, description, quantity, unit_amount, line_total, sort_order`,
      [id, kind, description.trim(), qty, signedUnitAmount, lineTotal, nextSort.rows[0].next]
    );

    const invoice = await recomputeInvoiceTotal(client, id);
    await client.query(
      `INSERT INTO invoice_activity (invoice_id, event_type, actor_id, body) VALUES ($1, 'edited', $2, $3)`,
      [id, req.user.id, `Added ${kind}: ${description.trim()} (GHS ${lineTotal.toFixed(2)}).`]
    );

    await client.query('COMMIT');
    res.status(201).json({ line: lineResult.rows[0], invoice });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function removeInvoiceLine(req, res, next) {
  const client = await pool.connect();
  try {
    const { id, lineId } = req.params;

    await client.query('BEGIN');

    const invoiceCheck = await client.query('SELECT id, voided_at FROM invoices WHERE id = $1 FOR UPDATE', [id]);
    if (invoiceCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    if (invoiceCheck.rows[0].voided_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This invoice has been voided.' });
    }

    const lineResult = await client.query('SELECT kind, description FROM invoice_items WHERE id = $1 AND invoice_id = $2', [lineId, id]);
    if (lineResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Line item not found on this invoice.' });
    }
    if (lineResult.rows[0].kind === 'item') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order item lines cannot be removed — void and regenerate the invoice instead.' });
    }

    await client.query('DELETE FROM invoice_items WHERE id = $1', [lineId]);
    const invoice = await recomputeInvoiceTotal(client, id);
    await client.query(
      `INSERT INTO invoice_activity (invoice_id, event_type, actor_id, body) VALUES ($1, 'edited', $2, $3)`,
      [id, req.user.id, `Removed ${lineResult.rows[0].kind}: ${lineResult.rows[0].description}.`]
    );

    await client.query('COMMIT');
    res.json({ invoice });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// due_date/notes only — line items have their own dedicated endpoints above.
async function updateInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const { due_date, notes } = req.body;

    if (due_date && !isValidDateString(due_date)) {
      return res.status(400).json({ error: 'due_date must be a valid date in YYYY-MM-DD format.' });
    }

    const current = await pool.query('SELECT voided_at FROM invoices WHERE id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    if (current.rows[0].voided_at) {
      return res.status(400).json({ error: 'This invoice has been voided.' });
    }

    const result = await pool.query(
      `UPDATE invoices SET due_date = COALESCE($1, due_date), notes = COALESCE($2, notes) WHERE id = $3
       RETURNING id, invoice_number, due_date, notes`,
      [due_date || null, notes !== undefined ? notes : null, id]
    );

    await pool.query(
      `INSERT INTO invoice_activity (invoice_id, event_type, actor_id, body) VALUES ($1, 'edited', $2, 'Updated due date/notes.')`,
      [id, req.user.id]
    );

    res.json({ invoice: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function getInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(`SELECT * FROM (${INVOICE_SELECT}) sub WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    const invoice = result.rows[0];
    if (invoice.order_owner_id !== req.user.id && !isStaffRole(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to view this invoice.' });
    }

    const items = await pool.query(
      'SELECT id, kind, description, quantity, unit_amount, line_total, sort_order FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order',
      [id]
    );
    res.json({ invoice: { ...invoice, items: items.rows } });
  } catch (err) {
    next(err);
  }
}

// Convenience lookup so order-detail UIs can show "View Invoice" vs
// "Generate Invoice" without a separate list call.
async function getInvoiceForOrder(req, res, next) {
  try {
    const { id } = req.params;
    const orderCheck = await pool.query('SELECT user_id FROM orders WHERE id = $1', [id]);
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (orderCheck.rows[0].user_id !== req.user.id && !isStaffRole(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to view this order.' });
    }

    const result = await pool.query(`SELECT * FROM (${INVOICE_SELECT}) sub WHERE order_id = $1 AND voided_at IS NULL`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No invoice has been generated for this order yet.' });
    }
    const items = await pool.query(
      'SELECT id, kind, description, quantity, unit_amount, line_total, sort_order FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order',
      [result.rows[0].id]
    );
    res.json({ invoice: { ...result.rows[0], items: items.rows } });
  } catch (err) {
    next(err);
  }
}

// Staff invoice queue — filterable by derived payment status, due-date
// range, and a name/number search, mirroring listAllPayments's shape.
async function listInvoices(req, res, next) {
  try {
    const { status, start, end, search, branch_id } = req.query;
    const conditions = [];
    const params = [];

    // Non-super_admin staff only ever see their own branch's invoices;
    // super_admin may filter by branch_id or omit it to see every branch.
    const effectiveBranchId = req.user.branch_id || branch_id;
    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      conditions.push(`branch_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`payment_status = $${params.length}`);
    }
    if (start) {
      params.push(start);
      conditions.push(`due_date >= $${params.length}`);
    }
    if (end) {
      params.push(end);
      conditions.push(`due_date <= $${params.length}`);
    }
    if (search) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(invoice_number ILIKE $${params.length} OR customer_name ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM (${INVOICE_SELECT}) sub ${where} ORDER BY created_at DESC LIMIT 200`,
      params
    );
    res.json({ invoices: result.rows });
  } catch (err) {
    next(err);
  }
}

// Admin-only — blocked once any payment has been recorded against the
// invoice's order, since that would make historical balance math ambiguous.
// Void, don't delete: the row (and its activity trail) stays for the record.
async function voidInvoice(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    // FOR UPDATE can't combine with an aggregate subquery in the same
    // statement, so the row lock and the net-paid aggregate are two
    // separate queries (same split paymentController.recordPayment uses).
    const lockResult = await client.query('SELECT id, order_id, voided_at FROM invoices WHERE id = $1 FOR UPDATE', [id]);
    if (lockResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    const invoice = lockResult.rows[0];
    if (invoice.voided_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This invoice is already voided.' });
    }

    const paidResult = await client.query(`SELECT ${NET_PAID_EXPR} AS net_paid FROM payments WHERE order_id = $1`, [invoice.order_id]);
    if (Number(paidResult.rows[0].net_paid) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot void an invoice with payments recorded against its order.' });
    }

    await client.query('UPDATE invoices SET voided_at = NOW() WHERE id = $1', [id]);
    await client.query(
      `INSERT INTO invoice_activity (invoice_id, event_type, actor_id, body) VALUES ($1, 'voided', $2, NULL)`,
      [id, req.user.id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Invoice voided.' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// Emails/texts the customer a link to the invoice's public pay page — the
// standalone, no-login-required equivalent of Hubtel's "Go to ... to pay".
async function sendInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT i.invoice_number, i.due_date, i.total_amount, i.public_token, i.voided_at,
              o.user_id, u.email, u.phone_number,
              COALESCE(pay.net_paid, 0) AS net_paid
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       JOIN users u ON u.id = o.user_id
       LEFT JOIN LATERAL (SELECT ${NET_PAID_EXPR} AS net_paid FROM payments WHERE order_id = i.order_id) pay ON true
       WHERE i.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    const invoice = result.rows[0];
    if (invoice.voided_at) {
      return res.status(400).json({ error: 'This invoice has been voided.' });
    }

    const balance = Math.max(Number(invoice.total_amount) - Number(invoice.net_paid), 0);
    const link = `${CLIENT_ORIGIN}/pay/invoice/${invoice.public_token}`;
    const dueDateStr = new Date(invoice.due_date).toISOString().slice(0, 10);
    const body =
      balance > 0
        ? `Invoice ${invoice.invoice_number}: GHS ${Number(invoice.total_amount).toFixed(2)}, due ${dueDateStr}. Balance: GHS ${balance.toFixed(2)}. Pay at ${link}`
        : `Invoice ${invoice.invoice_number}: GHS ${Number(invoice.total_amount).toFixed(2)} — paid in full. View at ${link}`;

    await notifyUser(invoice.user_id, {
      type: 'invoice',
      title: `Invoice ${invoice.invoice_number}`,
      body,
      email: invoice.email,
      phone: invoice.phone_number,
    });

    await pool.query(
      `INSERT INTO invoice_activity (invoice_id, event_type, actor_id, body) VALUES ($1, 'sent', $2, $3)`,
      [id, req.user.id, `Sent to ${invoice.email || invoice.phone_number}.`]
    );

    res.json({ message: 'Invoice sent.', link });
  } catch (err) {
    next(err);
  }
}

async function downloadInvoicePdf(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(`SELECT * FROM (${INVOICE_SELECT}) sub WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    const invoice = result.rows[0];
    if (invoice.order_owner_id !== req.user.id && !isStaffRole(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to view this invoice.' });
    }

    const items = await pool.query(
      'SELECT kind, description, quantity, unit_amount, line_total FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order',
      [id]
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
    renderInvoicePdf(invoice, items.rows).pipe(res);
  } catch (err) {
    next(err);
  }
}

async function listInvoiceActivity(req, res, next) {
  try {
    const { id } = req.params;
    const invoiceCheck = await pool.query(
      'SELECT o.user_id FROM invoices i JOIN orders o ON o.id = i.order_id WHERE i.id = $1',
      [id]
    );
    if (invoiceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    if (invoiceCheck.rows[0].user_id !== req.user.id && !isStaffRole(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to view this invoice.' });
    }

    const result = await pool.query(
      `SELECT a.id, a.event_type, a.body, a.created_at, u.full_name AS actor_name
       FROM invoice_activity a
       LEFT JOIN users u ON u.id = a.actor_id
       WHERE a.invoice_id = $1
       ORDER BY a.created_at ASC`,
      [id]
    );
    res.json({ activity: result.rows });
  } catch (err) {
    next(err);
  }
}

// Staff-only, per the scoping cut in the plan: no public write endpoint on
// the unauthenticated pay page, to avoid an abuse vector.
async function postInvoiceMessage(req, res, next) {
  try {
    const { id } = req.params;
    const { body } = req.body;
    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'body is required.' });
    }
    if (body.trim().length > 1000) {
      return res.status(400).json({ error: 'body must be 1000 characters or fewer.' });
    }

    const invoiceCheck = await pool.query('SELECT id FROM invoices WHERE id = $1', [id]);
    if (invoiceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const result = await pool.query(
      `INSERT INTO invoice_activity (invoice_id, event_type, actor_id, body) VALUES ($1, 'message', $2, $3)
       RETURNING id, event_type, body, created_at`,
      [id, req.user.id, body.trim()]
    );
    res.status(201).json({ activity: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// --- Public, no-login routes — authorized by the unguessable token instead
// of a session. Mirrors the Paystack webhook's shape (auth done inside the
// controller, not via requireAuth middleware), just token- instead of
// HMAC-verified. Rate-limited at the route layer.

async function getPublicInvoice(req, res, next) {
  try {
    const { token } = req.params;
    const result = await pool.query(`SELECT * FROM (${INVOICE_SELECT}) sub WHERE public_token = $1`, [token]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    const { order_owner_id, created_by, ...invoice } = result.rows[0];

    const items = await pool.query(
      'SELECT kind, description, quantity, unit_amount, line_total FROM invoice_items WHERE invoice_id = $1 ORDER BY sort_order',
      [invoice.id]
    );
    res.json({ invoice: { ...invoice, items: items.rows } });
  } catch (err) {
    next(err);
  }
}

async function initPublicPayment(req, res, next) {
  try {
    if (!paystack.configured()) {
      return res.status(503).json({ error: 'Online payments are not configured yet.' });
    }

    const { token } = req.params;
    const { amount } = req.body;
    const amountNum = Number(amount);
    if (!(amountNum > 0)) {
      return res.status(400).json({ error: 'A positive amount is required.' });
    }

    const result = await pool.query(
      `SELECT i.id, i.order_id, i.total_amount, i.voided_at, u.email, COALESCE(pay.net_paid, 0) AS net_paid
       FROM invoices i
       JOIN orders o ON o.id = i.order_id
       JOIN users u ON u.id = o.user_id
       LEFT JOIN LATERAL (SELECT ${NET_PAID_EXPR} AS net_paid FROM payments WHERE order_id = i.order_id) pay ON true
       WHERE i.public_token = $1`,
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }
    const invoice = result.rows[0];
    if (invoice.voided_at) {
      return res.status(400).json({ error: 'This invoice has been voided.' });
    }

    const balance = Math.max(Number(invoice.total_amount) - Number(invoice.net_paid), 0);
    if (balance <= 0) {
      return res.status(400).json({ error: 'This invoice has no balance due.' });
    }
    if (amountNum > balance + 0.005) {
      return res.status(400).json({ error: `That amount exceeds the remaining balance of GHS ${balance.toFixed(2)}.` });
    }

    const reference = `mll_inv_${invoice.id}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const data = await paystack.initializeTransaction({
      email: invoice.email,
      amountPesewas: Math.round(amountNum * 100),
      reference,
      callbackUrl: `${CLIENT_ORIGIN}/pay/invoice/${token}`,
      metadata: { order_id: invoice.order_id, payment_type: 'partial', invoice_id: invoice.id, initiated_by: null },
    });

    res.json({ authorization_url: data.authorization_url, reference: data.reference });
  } catch (err) {
    next(err);
  }
}

// Public equivalent of paystackController.verifyPayment — same shared
// finalizePaystackPayment logic, just scoped to a token instead of req.user.
async function verifyPublicPayment(req, res, next) {
  try {
    if (!paystack.configured()) {
      return res.status(503).json({ error: 'Online payments are not configured yet.' });
    }

    const { token, reference } = req.params;
    const invoiceCheck = await pool.query('SELECT id FROM invoices WHERE public_token = $1', [token]);
    if (invoiceCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const result = await finalizePaystackPayment(reference);
    if (result.status !== 'success') {
      return res.json({ status: result.status });
    }
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  generateInvoice,
  bulkGenerateInvoices,
  addInvoiceLine,
  removeInvoiceLine,
  updateInvoice,
  getInvoice,
  getInvoiceForOrder,
  listInvoices,
  voidInvoice,
  sendInvoice,
  downloadInvoicePdf,
  listInvoiceActivity,
  postInvoiceMessage,
  getPublicInvoice,
  initPublicPayment,
  verifyPublicPayment,
};
