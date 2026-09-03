const pool = require('../config/db');
const { reserveCapacity, releaseCapacity } = require('./capacityController');
const { notifyUser, sendEmail, sendSms } = require('../services/notify');
const { calculateLateFee } = require('../utils/lateFee');
const { calculateBirthdayDiscount } = require('../utils/birthday');
const { SHOP_NAME, SHOP_ADDRESS, SHOP_PHONE, SHOP_EMAIL } = require('../config/shopInfo');
const {
  STATUS_LABELS,
  CUSTOMER_CANCELLABLE_STATUSES,
  isStaffRole,
} = require('../config/orderLifecycle');

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

// Attaches live late-pickup-fee figures to an order row. Frozen as of
// completed_at for a picked-up order; computed as of "now" while it's still
// sitting ready for pickup. A no-op (all zeros) for every other status.
function withLateFee(order) {
  const { daysReady, daysOverdue, fee } = calculateLateFee(
    order.ready_for_pickup_at,
    order.completed_at || new Date()
  );
  return { ...order, days_ready_for_pickup: daysReady, days_overdue: daysOverdue, late_fee: fee };
}

const ORDER_SELECT = `
  SELECT o.id, o.user_id, o.status, o.drop_off_date, o.pickup_date, o.total_price,
         o.discount_amount, o.storage_location, o.notes, o.assigned_staff_id, o.created_at,
         o.branch_id, br.name AS branch_name,
         u.full_name AS customer_name, u.phone_number AS customer_phone, u.email AS customer_email,
         COALESCE(oi.item_count, 0) AS item_count, oi.items_summary,
         COALESCE(pay.amount_paid, 0) AS amount_paid,
         GREATEST(o.total_price - COALESCE(pay.amount_paid, 0), 0) AS balance_due,
         CASE
           WHEN COALESCE(pay.amount_paid, 0) <= 0 THEN 'unpaid'
           WHEN COALESCE(pay.amount_paid, 0) + 0.005 >= o.total_price THEN 'paid'
           ELSE 'partial'
         END AS payment_status,
         (SELECT created_at FROM order_events WHERE order_id = o.id AND to_status = 'ready_for_pickup' ORDER BY created_at DESC LIMIT 1) AS ready_for_pickup_at,
         (SELECT created_at FROM order_events WHERE order_id = o.id AND to_status = 'completed' ORDER BY created_at DESC LIMIT 1) AS completed_at
  FROM orders o
  JOIN users u ON u.id = o.user_id
  JOIN branches br ON br.id = o.branch_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS item_count, string_agg(item_name || ' x' || quantity, ', ' ORDER BY id) AS items_summary
    FROM order_items WHERE order_id = o.id
  ) oi ON true
  LEFT JOIN LATERAL (
    SELECT SUM(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END) AS amount_paid
    FROM payments WHERE order_id = o.id
  ) pay ON true
`;

// Validates the item list against the catalog, reserves drop-off capacity,
// and writes the order + line items + initial order_event. Shared by the
// customer self-service flow (createOrder) and the staff-assisted walk-in
// flow (createStaffOrder in adminController) — the only things that differ
// between them are who the order belongs to, who's recording it, and
// whether a pickup date / note is known up front.
async function insertOrder(client, { userId, branchId, dropOffDate, pickupDate, items, createdBy, note }) {
  const itemIds = items.map((i) => i.laundry_item_id);
  const catalogResult = await client.query(
    'SELECT id, item_name, unit_price, price_min, price_max FROM laundry_items WHERE id = ANY($1) AND is_active = true',
    [itemIds]
  );
  const catalogById = new Map(catalogResult.rows.map((row) => [row.id, row]));

  if (catalogById.size !== new Set(itemIds).size) {
    const err = new Error('One or more selected items are invalid or no longer available.');
    err.status = 400;
    throw err;
  }

  const lineItems = items.map(({ laundry_item_id, quantity }) => {
    const qty = Number(quantity) || 1;
    const catalogItem = catalogById.get(laundry_item_id);
    const isEstimated = catalogItem.unit_price == null;
    const unitPrice = isEstimated ? Number(catalogItem.price_min) : Number(catalogItem.unit_price);
    return {
      laundry_item_id,
      item_name: catalogItem.item_name,
      quantity: qty,
      unit_price: unitPrice,
      is_price_estimated: isEstimated,
      line_total: unitPrice * qty,
    };
  });
  const subtotal = lineItems.reduce((sum, li) => sum + li.line_total, 0);

  // A 5% birthday discount applies when the drop-off date falls on the
  // customer's birthday (month + day, any year) — checked here so both the
  // customer self-service flow and the staff walk-in flow get it for free.
  const customerResult = await client.query('SELECT date_of_birth FROM users WHERE id = $1', [userId]);
  const { discountAmount, total } = calculateBirthdayDiscount(
    subtotal,
    customerResult.rows[0]?.date_of_birth,
    dropOffDate
  );
  const total_price = total;

  await reserveCapacity(client, dropOffDate, branchId);

  const orderResult = await client.query(
    `INSERT INTO orders (user_id, branch_id, status, drop_off_date, pickup_date, total_price, discount_amount, notes)
     VALUES ($1, $2, 'order_received', $3, $4, $5, $6, $7)
     RETURNING id, user_id, branch_id, status, drop_off_date, pickup_date, total_price, discount_amount, notes, created_at`,
    [userId, branchId, dropOffDate, pickupDate || null, total_price, discountAmount, note || null]
  );
  const order = orderResult.rows[0];

  for (const li of lineItems) {
    await client.query(
      `INSERT INTO order_items (order_id, laundry_item_id, item_name, quantity, unit_price, is_price_estimated, line_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [order.id, li.laundry_item_id, li.item_name, li.quantity, li.unit_price, li.is_price_estimated, li.line_total]
    );
  }

  await client.query(
    `INSERT INTO order_events (order_id, from_status, to_status, changed_by, notes) VALUES ($1, NULL, 'order_received', $2, $3)`,
    [order.id, createdBy, note || null]
  );

  return { order, lineItems, total_price };
}

async function createOrder(req, res, next) {
  const client = await pool.connect();
  try {
    const { drop_off_date, branch_id, items, notes } = req.body;

    if (!drop_off_date) {
      return res.status(400).json({ error: 'drop_off_date is required.' });
    }
    if (!branch_id) {
      return res.status(400).json({ error: 'branch_id is required — choose which location to drop off at.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array of { laundry_item_id, quantity }.' });
    }
    if (!isValidDateString(drop_off_date)) {
      return res.status(400).json({ error: 'drop_off_date must be a valid date in YYYY-MM-DD format.' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(`${drop_off_date}T00:00:00`) < today) {
      return res.status(400).json({ error: 'drop_off_date cannot be in the past.' });
    }
    const branchCheck = await pool.query('SELECT id FROM branches WHERE id = $1 AND is_active = true', [branch_id]);
    if (branchCheck.rows.length === 0) {
      return res.status(400).json({ error: 'branch_id is not a valid, active branch.' });
    }

    await client.query('BEGIN');
    const { order, lineItems } = await insertOrder(client, {
      userId: req.user.id,
      branchId: branch_id,
      dropOffDate: drop_off_date,
      pickupDate: null,
      items,
      createdBy: req.user.id,
      note: notes && notes.trim() ? notes.trim() : null,
    });
    await client.query('COMMIT');

    const phoneResult = await pool.query('SELECT phone_number FROM users WHERE id = $1', [req.user.id]);
    const itemsSummary = lineItems.map((li) => `${li.item_name} x${li.quantity}`).join(', ');
    const birthdayNote =
      order.discount_amount > 0
        ? ` Happy birthday! We've applied a 5% birthday discount (GHS ${Number(order.discount_amount).toFixed(2)} off).`
        : '';
    notifyUser(req.user.id, {
      type: 'order_status',
      title: 'Order Received',
      body: `We've received your order (${itemsSummary}), dropped off on ${drop_off_date}. We'll let you know when it's ready to collect.${birthdayNote}`,
      email: req.user.email,
      phone: phoneResult.rows[0]?.phone_number,
    }).catch((err) => console.error('[notify] failed:', err.message));

    res.status(201).json({ order: { ...order, items: lineItems } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function listMyOrders(req, res, next) {
  try {
    const result = await pool.query(
      `${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json({ orders: result.rows.map(withLateFee) });
  } catch (err) {
    next(err);
  }
}

// Staff/admin order queue — optionally filtered by status, or "mine" for orders
// assigned to the requesting staff member.
async function listOrders(req, res, next) {
  try {
    const { status, mine, branch_id } = req.query;
    const conditions = [];
    const params = [];

    // Non-super_admin staff only ever see their own branch's queue;
    // super_admin may filter by branch_id or omit it to see every branch.
    const effectiveBranchId = req.user.branch_id || branch_id;
    if (effectiveBranchId) {
      params.push(effectiveBranchId);
      conditions.push(`o.branch_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (mine === 'true') {
      params.push(req.user.id);
      conditions.push(`o.assigned_staff_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(`${ORDER_SELECT} ${where} ORDER BY o.created_at DESC LIMIT 200`, params);
    res.json({ orders: result.rows.map(withLateFee) });
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = result.rows[0];

    if (order.user_id !== req.user.id && !isStaffRole(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to view this order.' });
    }

    const itemsResult = await pool.query(
      'SELECT id, laundry_item_id, item_name, quantity, unit_price, is_price_estimated, line_total FROM order_items WHERE order_id = $1 ORDER BY id',
      [id]
    );

    res.json({ order: { ...withLateFee(order), items: itemsResult.rows } });
  } catch (err) {
    next(err);
  }
}

async function getOrderHistory(req, res, next) {
  try {
    const { id } = req.params;

    const orderCheck = await pool.query('SELECT user_id FROM orders WHERE id = $1', [id]);
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (orderCheck.rows[0].user_id !== req.user.id && !isStaffRole(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to view this order.' });
    }

    const result = await pool.query(
      `SELECT e.id, e.from_status, e.to_status, e.notes, e.created_at, u.full_name AS changed_by_name
       FROM order_events e
       LEFT JOIN users u ON u.id = e.changed_by
       WHERE e.order_id = $1
       ORDER BY e.created_at ASC`,
      [id]
    );
    res.json({ history: result.rows, statusLabels: STATUS_LABELS });
  } catch (err) {
    next(err);
  }
}

async function cancelOrder(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const orderResult = await client.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = orderResult.rows[0];

    if (order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only cancel your own orders.' });
    }
    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
      return res.status(400).json({
        error: `Orders can only be cancelled while status is one of: ${CUSTOMER_CANCELLABLE_STATUSES.join(', ')}.`,
      });
    }

    await client.query('BEGIN');
    await client.query('UPDATE orders SET status = $1 WHERE id = $2', ['cancelled', id]);
    await client.query(
      `INSERT INTO order_events (order_id, from_status, to_status, changed_by, notes) VALUES ($1, $2, 'cancelled', $3, 'Cancelled by customer')`,
      [id, order.status, req.user.id]
    );
    await releaseCapacity(client, order.drop_off_date, order.branch_id);
    await client.query('COMMIT');

    res.json({ message: 'Order cancelled.' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// Plain-text rendering shared by the email and SMS share channels — a
// receipt is short enough that one format works for both, and every
// notification email this app sends is already plain text (see notify.js),
// so this doesn't introduce a one-off HTML template to maintain.
function formatReceiptText(order, items) {
  const itemLines = items.map((i) => `- ${i.item_name} x${i.quantity} — GHS ${Number(i.line_total).toFixed(2)}`);

  const lines = [
    `${SHOP_NAME} — ${order.branch_name}`,
    order.branch_address || SHOP_ADDRESS,
    [order.branch_phone || SHOP_PHONE, order.branch_email || SHOP_EMAIL].filter(Boolean).join(' · '),
    '',
    `Receipt #${order.id}`,
    `Date: ${new Date(order.created_at).toLocaleString()}`,
    `Customer: ${order.customer_name} (${order.customer_phone})`,
    `Drop-off: ${String(order.drop_off_date).slice(0, 10)}`,
  ];
  if (order.pickup_date) lines.push(`Pickup: ${String(order.pickup_date).slice(0, 10)}`);
  lines.push('', 'Items:', ...itemLines, '');
  lines.push(`Total: GHS ${Number(order.total_price).toFixed(2)}`);
  if (Number(order.discount_amount) > 0) {
    lines.push(`Discount applied: -GHS ${Number(order.discount_amount).toFixed(2)}`);
  }
  lines.push(`Paid: GHS ${Number(order.amount_paid).toFixed(2)}`);
  if (Number(order.balance_due) > 0) {
    lines.push(`Balance due: GHS ${Number(order.balance_due).toFixed(2)}`);
  }
  lines.push(`Status: ${STATUS_LABELS[order.status] || order.status}`);
  lines.push('', `Thank you for choosing ${SHOP_NAME}!`);

  return lines.join('\n');
}

// Sends the full receipt (customer detail + itemized total + payment
// status) as a standalone message, rather than just a link — the recipient
// shouldn't need to log into the app to read it. Same ownership rule as
// getOrder (the order's own customer, or any staff member); only staff may
// redirect delivery to an address/number other than the customer's own on
// file, so a customer can't use this to spam a third party.
async function sendReceipt(req, res, next) {
  try {
    const { id } = req.params;
    const { channel, to } = req.body;

    if (!['email', 'sms'].includes(channel)) {
      return res.status(400).json({ error: 'channel must be "email" or "sms".' });
    }

    const result = await pool.query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = result.rows[0];

    if (order.user_id !== req.user.id && !isStaffRole(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to share this order.' });
    }
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled orders have no receipt to send.' });
    }

    const staffOverride = isStaffRole(req.user.role) && to && to.trim() ? to.trim() : null;
    const target = staffOverride || (channel === 'email' ? order.customer_email : order.customer_phone);
    if (!target) {
      return res.status(400).json({
        error: `No ${channel === 'email' ? 'email address' : 'phone number'} is on file for this customer.`,
      });
    }

    const [itemsResult, branchResult] = await Promise.all([
      pool.query('SELECT item_name, quantity, line_total FROM order_items WHERE order_id = $1 ORDER BY id', [id]),
      pool.query('SELECT address, phone, email FROM branches WHERE id = $1', [order.branch_id]),
    ]);
    const branch = branchResult.rows[0] || {};

    const text = formatReceiptText(
      { ...order, branch_address: branch.address, branch_phone: branch.phone, branch_email: branch.email },
      itemsResult.rows
    );

    const sent =
      channel === 'email'
        ? await sendEmail(target, `Receipt #${order.id} — ${SHOP_NAME}`, text)
        : await sendSms(target, text);

    if (!sent) {
      return res.status(503).json({
        error:
          channel === 'email'
            ? 'Email sending is not configured on this server yet.'
            : 'SMS sending is not configured on this server yet.',
      });
    }

    res.json({ message: `Receipt sent via ${channel}.`, to: target });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  listMyOrders,
  listOrders,
  getOrder,
  getOrderHistory,
  cancelOrder,
  sendReceipt,
  insertOrder,
  isValidDateString,
};
