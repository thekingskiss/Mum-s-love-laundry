const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const { releaseCapacity } = require('./capacityController');
const { notifyUser } = require('../services/notify');
const { calculateLateFee, FREE_PICKUP_DAYS, LATE_FEE_PER_DAY } = require('../utils/lateFee');
const { runPickupReminders } = require('../services/pickupReminders');
const { runBalanceDueReminders } = require('../services/balanceDueReminders');
const { runInvoiceReminders } = require('../services/invoiceReminders');
const { sendBirthdayGreetings } = require('../services/birthdayGreetings');
const { canTransition, getAllowedTransitions, STATUS_LABELS, STORAGE_LOCATIONS } = require('../config/orderLifecycle');
const { insertOrder, isValidDateString } = require('./orderController');
const { generateUniqueUsername } = require('../utils/username');

const SALT_ROUNDS = 12;

async function advanceOrderStatus(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status, notes, assign_to_me } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required.' });
    }

    const current = await client.query(
      `SELECT o.status, o.drop_off_date, o.branch_id, o.user_id, o.assigned_staff_id, u.email, u.full_name, u.phone_number,
              (SELECT string_agg(item_name || ' x' || quantity, ', ') FROM order_items WHERE order_id = o.id) AS items_summary
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`,
      [id]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = current.rows[0];

    if (!canTransition(order.status, status, req.user.role)) {
      const allowed = getAllowedTransitions(order.status);
      return res.status(403).json({
        error: allowed.length
          ? `Cannot move from "${order.status}" to "${status}" with your role. Allowed next steps: ${allowed.join(', ')}.`
          : `Order is already in a terminal state ("${order.status}").`,
      });
    }

    await client.query('BEGIN');

    const assignedStaffId = assign_to_me ? req.user.id : order.assigned_staff_id;
    const result = await client.query(
      `UPDATE orders SET status = $1, notes = COALESCE($2, notes), assigned_staff_id = $3
       WHERE id = $4
       RETURNING id, user_id, status, drop_off_date, pickup_date, total_price, assigned_staff_id, notes, created_at`,
      [status, notes || null, assignedStaffId, id]
    );

    await client.query(
      `INSERT INTO order_events (order_id, from_status, to_status, changed_by, notes) VALUES ($1, $2, $3, $4, $5)`,
      [id, order.status, status, req.user.id, notes || null]
    );

    if (status === 'cancelled') {
      await releaseCapacity(client, order.drop_off_date, order.branch_id);
    }

    await client.query('COMMIT');

    const policyNote =
      status === 'ready_for_pickup'
        ? ` Pickup is free for ${FREE_PICKUP_DAYS} days — after that a GHS ${LATE_FEE_PER_DAY}/day storage fee applies.`
        : '';
    notifyUser(order.user_id, {
      type: 'order_status',
      title: `Order Update: ${STATUS_LABELS[status] || status}`,
      body: `Your order (${order.items_summary || 'items'}) is now: ${STATUS_LABELS[status] || status}.${policyNote}`,
      email: order.email,
      phone: order.phone_number,
    }).catch((err) => console.error('[notify] failed:', err.message));

    res.json({ order: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function setPickupDate(req, res, next) {
  try {
    const { id } = req.params;
    const { pickup_date } = req.body;

    if (!pickup_date || !/^\d{4}-\d{2}-\d{2}$/.test(pickup_date) || Number.isNaN(new Date(`${pickup_date}T00:00:00`).getTime())) {
      return res.status(400).json({ error: 'pickup_date is required and must be a valid date in YYYY-MM-DD format.' });
    }

    const current = await pool.query(
      `SELECT o.drop_off_date, o.user_id, u.email, u.full_name, u.phone_number,
              (SELECT string_agg(item_name || ' x' || quantity, ', ') FROM order_items WHERE order_id = o.id) AS items_summary
       FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1`,
      [id]
    );
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const order = current.rows[0];

    const dropOffDateStr = new Date(order.drop_off_date).toISOString().slice(0, 10);
    if (pickup_date < dropOffDateStr) {
      return res.status(400).json({ error: 'pickup_date cannot be before the drop-off date.' });
    }

    const result = await pool.query(
      `UPDATE orders SET pickup_date = $1 WHERE id = $2
       RETURNING id, user_id, status, drop_off_date, pickup_date, total_price, assigned_staff_id, notes, created_at`,
      [pickup_date, id]
    );

    notifyUser(order.user_id, {
      type: 'order_status',
      title: 'Pickup Date Assigned',
      body: `Your order (${order.items_summary || 'items'}) will be ready to collect on ${pickup_date}.`,
      email: order.email,
      phone: order.phone_number,
    }).catch((err) => console.error('[notify] failed:', err.message));

    res.json({ order: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// Records which physical partition (Shelf 1 / Area 2 / Area 3 / Area 4) an
// order's laundry has been placed in, so staff can find it instantly when
// the customer arrives. Stays set until the order is collected.
async function setStorageLocation(req, res, next) {
  try {
    const { id } = req.params;
    const { storage_location } = req.body;

    if (!STORAGE_LOCATIONS.includes(storage_location)) {
      return res.status(400).json({ error: `storage_location must be one of: ${STORAGE_LOCATIONS.join(', ')}.` });
    }

    const result = await pool.query(
      `UPDATE orders SET storage_location = $1 WHERE id = $2
       RETURNING id, user_id, status, drop_off_date, pickup_date, total_price, storage_location, assigned_staff_id, notes, created_at`,
      [storage_location, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    res.json({ order: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// Admin-authored message, either to one customer (customer_id) or broadcast
// to every customer account. Always lands as an in-app notification; email/sms
// are opt-in per send so a broadcast doesn't silently spam every channel.
async function sendMessage(req, res, next) {
  try {
    const { title, body, customer_id, send_email, send_sms } = req.body;

    if (!title || !title.trim() || !body || !body.trim()) {
      return res.status(400).json({ error: 'title and body are required.' });
    }
    if (title.trim().length > 255) {
      return res.status(400).json({ error: 'title must be 255 characters or fewer.' });
    }
    if (body.trim().length > 2000) {
      return res.status(400).json({ error: 'body must be 2000 characters or fewer.' });
    }

    let recipients;
    if (customer_id) {
      const result = await pool.query(
        `SELECT id, email, phone_number FROM users WHERE id = $1 AND role = 'customer'`,
        [customer_id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer not found.' });
      }
      recipients = result.rows;
    } else {
      const result = await pool.query(`SELECT id, email, phone_number FROM users WHERE role = 'customer'`);
      recipients = result.rows;
    }

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No matching customers to message.' });
    }

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    await Promise.all(
      recipients.map((r) =>
        notifyUser(r.id, {
          type: 'admin_message',
          title: trimmedTitle,
          body: trimmedBody,
          email: send_email ? r.email : undefined,
          phone: send_sms ? r.phone_number : undefined,
        }).catch((err) => console.error('[notify] failed:', err.message))
      )
    );

    res.json({ recipient_count: recipients.length });
  } catch (err) {
    next(err);
  }
}

// Staff recording a walk-in drop-off on a customer's behalf — the customer
// may not be the one physically handing over the items (dropped_off_by
// captures who did), and may not have an account yet (new_customer creates
// one). Unlike the customer self-service flow, staff can set pickup_date
// immediately since they're standing at the counter.
async function createStaffOrder(req, res, next) {
  const client = await pool.connect();
  try {
    const { customer_id, new_customer, drop_off_date, pickup_date, items, dropped_off_by } = req.body;

    // Staff standing at a branch's counter create orders for that branch by
    // default; only a super_admin (who has no branch of their own) must say
    // which one explicitly.
    const branchId = req.user.branch_id || req.body.branch_id;
    if (!branchId) {
      return res.status(400).json({ error: 'branch_id is required.' });
    }
    if (!drop_off_date || !isValidDateString(drop_off_date)) {
      return res.status(400).json({ error: 'drop_off_date is required and must be a valid date in YYYY-MM-DD format.' });
    }
    if (pickup_date && !isValidDateString(pickup_date)) {
      return res.status(400).json({ error: 'pickup_date must be a valid date in YYYY-MM-DD format.' });
    }
    if (pickup_date && pickup_date < drop_off_date) {
      return res.status(400).json({ error: 'pickup_date cannot be before the drop-off date.' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array of { laundry_item_id, quantity }.' });
    }
    if (!customer_id && !new_customer) {
      return res.status(400).json({ error: 'Provide either customer_id (existing customer) or new_customer (their details).' });
    }
    if (customer_id && new_customer) {
      return res.status(400).json({ error: 'Provide only one of customer_id or new_customer, not both.' });
    }

    await client.query('BEGIN');

    let userId = customer_id;
    if (new_customer) {
      const { full_name, phone_number, location_zone, email } = new_customer;
      if (!full_name || !phone_number || !location_zone) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'new_customer requires full_name, phone_number, and location_zone.' });
      }

      // Walk-in customers often don't want to give an email at the counter —
      // synthesize a placeholder so the account can still exist; they can
      // add a real one later from Settings.
      const normalizedEmail = email
        ? email.toLowerCase().trim()
        : `walkin.${phone_number.replace(/[^0-9]/g, '')}.${Date.now()}@walkin.local`;

      const existing = await client.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'A customer with that email already exists — search for them instead.' });
      }

      const username = await generateUniqueUsername(client, normalizedEmail);
      const tempPassword = crypto.randomBytes(9).toString('base64url');
      const password_hash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

      const newUserResult = await client.query(
        `INSERT INTO users (email, password_hash, full_name, phone_number, location_zone, username)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [normalizedEmail, password_hash, full_name.trim(), phone_number.trim(), location_zone.trim(), username]
      );
      userId = newUserResult.rows[0].id;
    } else {
      const customerCheck = await client.query("SELECT id FROM users WHERE id = $1 AND role = 'customer'", [customer_id]);
      if (customerCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Customer not found.' });
      }
    }

    const note = dropped_off_by ? `Dropped off by: ${dropped_off_by}` : null;
    const { order, lineItems } = await insertOrder(client, {
      userId,
      branchId,
      dropOffDate: drop_off_date,
      pickupDate: pickup_date,
      items,
      createdBy: req.user.id,
      note,
    });

    await client.query('COMMIT');

    const customerResult = await pool.query('SELECT email, phone_number, full_name FROM users WHERE id = $1', [userId]);
    const customer = customerResult.rows[0];
    const itemsSummary = lineItems.map((li) => `${li.item_name} x${li.quantity}`).join(', ');
    const birthdayNote =
      order.discount_amount > 0
        ? ` Happy birthday! We've applied a 5% birthday discount (GHS ${Number(order.discount_amount).toFixed(2)} off).`
        : '';
    notifyUser(userId, {
      type: 'order_status',
      title: 'Order Received',
      body: `We've received your order (${itemsSummary}), dropped off on ${drop_off_date}. We'll let you know when it's ready to collect.${birthdayNote}`,
      email: customer.email,
      phone: customer.phone_number,
    }).catch((err) => console.error('[notify] failed:', err.message));

    res.status(201).json({ order: { ...order, items: lineItems, customer_name: customer.full_name, customer_phone: customer.phone_number } });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

// Every customer with a summary of their order activity, for the admin
// customer-detail view (Staff → Customers).
async function listCustomers(req, res, next) {
  try {
    const { search } = req.query;
    const params = [];
    let where = "WHERE u.role = 'customer'";
    if (search) {
      params.push(`%${search.trim()}%`);
      where += ` AND (u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
    }

    const result = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone_number, u.location_zone,
              u.avatar_url, u.created_at,
              COALESCE(o.order_count, 0) AS order_count,
              o.last_drop_off_date,
              COALESCE(o.pending_pickup_count, 0) AS pending_pickup_count
       FROM users u
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS order_count,
                MAX(drop_off_date) AS last_drop_off_date,
                COUNT(*) FILTER (WHERE status = 'ready_for_pickup') AS pending_pickup_count
         FROM orders WHERE user_id = u.id
       ) o ON true
       ${where}
       ORDER BY u.created_at DESC`,
      params
    );
    res.json({ customers: result.rows });
  } catch (err) {
    next(err);
  }
}

// One customer's full profile plus every order in detail — drop-off date,
// items brought, pickup date, and whether it's been picked up.
async function getCustomerDetail(req, res, next) {
  try {
    const { id } = req.params;
    const customerResult = await pool.query(
      `SELECT id, username, full_name, email, phone_number, location_zone, avatar_url, created_at
       FROM users WHERE id = $1 AND role = 'customer'`,
      [id]
    );
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const ordersResult = await pool.query(
      `SELECT o.id, o.status, o.drop_off_date, o.pickup_date, o.total_price, o.notes, o.created_at,
              COALESCE(oi.item_count, 0) AS item_count, oi.items_summary,
              (o.status = 'completed') AS picked_up,
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
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS item_count, string_agg(item_name || ' x' || quantity, ', ' ORDER BY id) AS items_summary
         FROM order_items WHERE order_id = o.id
       ) oi ON true
       LEFT JOIN LATERAL (
         SELECT SUM(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END) AS amount_paid
         FROM payments WHERE order_id = o.id
       ) pay ON true
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [id]
    );

    const orders = ordersResult.rows.map((order) => {
      const { daysReady, daysOverdue, fee } = calculateLateFee(order.ready_for_pickup_at, order.completed_at || new Date());
      return { ...order, days_ready_for_pickup: daysReady, days_overdue: daysOverdue, late_fee: fee };
    });

    res.json({ customer: customerResult.rows[0], orders });
  } catch (err) {
    next(err);
  }
}

// Aggregate figures for Staff → Analytics — total volume, status
// breakdown, sales trends at daily/monthly/yearly granularity (each with
// expenses and net alongside revenue), busiest drop-off dates, and a
// low-stock count. Revenue excludes cancelled orders throughout.
async function getAnalytics(req, res, next) {
  try {
    // Non-super_admin staff only ever see their own branch's figures;
    // super_admin may filter by branch_id or omit it to see every branch.
    const branchId = req.user.branch_id || req.query.branch_id || null;
    const branchOrderFilter = branchId ? 'AND branch_id = $1' : '';
    const branchExpenseFilter = branchId ? 'AND branch_id = $1' : '';
    const params = branchId ? [branchId] : [];

    const totalsResult = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM orders WHERE status != 'cancelled' ${branchOrderFilter}) AS total_orders,
         (SELECT COALESCE(SUM(total_price), 0) FROM orders WHERE status != 'cancelled' ${branchOrderFilter}) AS total_revenue,
         (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE true ${branchExpenseFilter}) AS total_expenses,
         (SELECT COUNT(*) FROM inventory_items WHERE is_active = true AND quantity_on_hand <= reorder_threshold ${branchId ? 'AND branch_id = $1' : ''}) AS low_stock_count,
         (SELECT COALESCE(SUM(GREATEST(o.total_price - COALESCE(pay.amount_paid, 0), 0)), 0)
            FROM orders o
            LEFT JOIN LATERAL (
              SELECT SUM(CASE WHEN payment_type = 'refund' THEN -amount ELSE amount END) AS amount_paid
              FROM payments WHERE order_id = o.id
            ) pay ON true
            WHERE o.status != 'cancelled' ${branchId ? 'AND o.branch_id = $1' : ''}) AS outstanding_balance`,
      params
    );

    const statusResult = await pool.query(
      `SELECT status, COUNT(*) AS count FROM orders WHERE true ${branchOrderFilter} GROUP BY status`,
      params
    );

    const dailyResult = await pool.query(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS period,
              COALESCE(SUM(o.total_price) FILTER (WHERE o.id IS NOT NULL), 0) AS revenue,
              COUNT(DISTINCT o.id) AS order_count,
              COALESCE(MAX(e.expenses), 0) AS expenses
       FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS d(day)
       LEFT JOIN orders o ON o.created_at::date = d.day AND o.status != 'cancelled' ${branchId ? 'AND o.branch_id = $1' : ''}
       LEFT JOIN (SELECT expense_date, SUM(amount) AS expenses FROM expenses WHERE true ${branchExpenseFilter} GROUP BY expense_date) e ON e.expense_date = d.day
       GROUP BY d.day
       ORDER BY d.day`,
      params
    );

    const monthlyResult = await pool.query(
      `WITH months AS (
         SELECT generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '11 months', date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS month
       ),
       rev AS (
         SELECT date_trunc('month', created_at) AS month, SUM(total_price) AS revenue, COUNT(*) AS order_count
         FROM orders WHERE status != 'cancelled' ${branchOrderFilter} GROUP BY 1
       ),
       exp AS (
         SELECT date_trunc('month', expense_date) AS month, SUM(amount) AS expenses
         FROM expenses WHERE true ${branchExpenseFilter} GROUP BY 1
       )
       SELECT to_char(m.month, 'YYYY-MM') AS period,
              COALESCE(rev.revenue, 0) AS revenue,
              COALESCE(rev.order_count, 0) AS order_count,
              COALESCE(exp.expenses, 0) AS expenses
       FROM months m
       LEFT JOIN rev ON rev.month = m.month
       LEFT JOIN exp ON exp.month = m.month
       ORDER BY m.month`,
      params
    );

    const yearlyResult = await pool.query(
      `WITH years AS (
         SELECT DISTINCT date_trunc('year', created_at) AS year FROM orders WHERE status != 'cancelled' ${branchOrderFilter}
         UNION
         SELECT DISTINCT date_trunc('year', expense_date) AS year FROM expenses WHERE true ${branchExpenseFilter}
       ),
       rev AS (
         SELECT date_trunc('year', created_at) AS year, SUM(total_price) AS revenue, COUNT(*) AS order_count
         FROM orders WHERE status != 'cancelled' ${branchOrderFilter} GROUP BY 1
       ),
       exp AS (
         SELECT date_trunc('year', expense_date) AS year, SUM(amount) AS expenses
         FROM expenses WHERE true ${branchExpenseFilter} GROUP BY 1
       )
       SELECT to_char(y.year, 'YYYY') AS period,
              COALESCE(rev.revenue, 0) AS revenue,
              COALESCE(rev.order_count, 0) AS order_count,
              COALESCE(exp.expenses, 0) AS expenses
       FROM years y
       LEFT JOIN rev ON rev.year = y.year
       LEFT JOIN exp ON exp.year = y.year
       ORDER BY y.year`,
      params
    );

    const busiestResult = await pool.query(
      `SELECT drop_off_date, COUNT(*) AS order_count
       FROM orders
       WHERE status != 'cancelled' ${branchOrderFilter}
       GROUP BY drop_off_date
       ORDER BY order_count DESC, drop_off_date DESC
       LIMIT 5`,
      params
    );

    function toSalesTrend(rows) {
      return rows.map((r) => ({
        period: r.period,
        revenue: Number(r.revenue),
        order_count: Number(r.order_count),
        expenses: Number(r.expenses),
        net: Number(r.revenue) - Number(r.expenses),
      }));
    }

    const totals = totalsResult.rows[0];
    res.json({
      total_orders: Number(totals.total_orders),
      total_revenue: Number(totals.total_revenue),
      total_expenses: Number(totals.total_expenses),
      net_profit: Number(totals.total_revenue) - Number(totals.total_expenses),
      low_stock_count: Number(totals.low_stock_count),
      outstanding_balance: Number(totals.outstanding_balance),
      orders_by_status: statusResult.rows.map((r) => ({ status: r.status, count: Number(r.count) })),
      daily_sales: toSalesTrend(dailyResult.rows),
      monthly_sales: toSalesTrend(monthlyResult.rows),
      yearly_sales: toSalesTrend(yearlyResult.rows),
      busiest_dates: busiestResult.rows.map((r) => ({
        drop_off_date: r.drop_off_date,
        order_count: Number(r.order_count),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// Manually fires the daily pickup-reminder sweep on demand — useful for
// verifying it works without waiting for the scheduled cron run.
async function runRemindersNow(req, res, next) {
  try {
    const remindersSent = await runPickupReminders();
    res.json({ remindersSent });
  } catch (err) {
    next(err);
  }
}

// Manually fires the daily birthday-greeting sweep on demand.
async function runBirthdayGreetingsNow(req, res, next) {
  try {
    const greetingsSent = await sendBirthdayGreetings();
    res.json({ greetingsSent });
  } catch (err) {
    next(err);
  }
}

// Manually fires the daily balance-due-reminder sweep on demand — useful
// for verifying it works without waiting for the scheduled cron run.
async function runBalanceDueRemindersNow(req, res, next) {
  try {
    const remindersSent = await runBalanceDueReminders();
    res.json({ remindersSent });
  } catch (err) {
    next(err);
  }
}

// Manually fires the daily invoice-reminder sweep on demand — useful for
// verifying it works without waiting for the scheduled cron run.
async function runInvoiceRemindersNow(req, res, next) {
  try {
    const remindersSent = await runInvoiceReminders();
    res.json({ remindersSent });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  advanceOrderStatus,
  setPickupDate,
  setStorageLocation,
  createStaffOrder,
  listCustomers,
  getCustomerDetail,
  getAnalytics,
  runRemindersNow,
  runBirthdayGreetingsNow,
  runBalanceDueRemindersNow,
  runInvoiceRemindersNow,
  sendMessage,
};
