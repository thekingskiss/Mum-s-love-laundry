const pool = require('../config/db');
const { notifyUser } = require('./notify');
const { NET_PAID_EXPR } = require('../controllers/paymentController');

// A first nudge two days after drop-off, then a weekly reminder for as long
// as a balance remains — independent of whether the laundry itself has been
// collected (a completed, picked-up order can still owe money).
function isReminderDue(daysSinceDropOff) {
  return daysSinceDropOff === 2 || (daysSinceDropOff >= 7 && daysSinceDropOff % 7 === 0);
}

// Sweeps every non-cancelled order with an outstanding balance and reminds
// the customer (email + SMS) if it matches the reminder schedule and hasn't
// already been reminded today. Returns how many reminders were sent, for
// logging/manual-trigger feedback.
async function runBalanceDueReminders() {
  const result = await pool.query(
    `SELECT o.id, o.user_id, o.drop_off_date, o.total_price, u.email, u.phone_number, u.full_name,
            (SELECT string_agg(item_name || ' x' || quantity, ', ') FROM order_items WHERE order_id = o.id) AS items_summary,
            COALESCE(pay.net_paid, 0) AS net_paid
     FROM orders o
     JOIN users u ON u.id = o.user_id
     LEFT JOIN LATERAL (
       SELECT ${NET_PAID_EXPR} AS net_paid FROM payments WHERE order_id = o.id
     ) pay ON true
     WHERE o.status != 'cancelled'
       AND (o.last_balance_reminder_sent_at IS NULL OR o.last_balance_reminder_sent_at::date < CURRENT_DATE)`
  );

  let remindersSent = 0;

  for (const order of result.rows) {
    const balance = Math.max(Number(order.total_price) - Number(order.net_paid), 0);
    if (balance <= 0) continue;

    const daysSinceDropOff = Math.floor((Date.now() - new Date(order.drop_off_date).getTime()) / (1000 * 60 * 60 * 24));
    if (!isReminderDue(daysSinceDropOff)) continue;

    await notifyUser(order.user_id, {
      type: 'balance_reminder',
      title: 'Payment Reminder',
      body: `Reminder: your order (${order.items_summary || 'items'}) has a balance of GHS ${balance.toFixed(2)} outstanding. Please settle it at your earliest convenience.`,
      email: order.email,
      phone: order.phone_number,
    });

    await pool.query('UPDATE orders SET last_balance_reminder_sent_at = NOW() WHERE id = $1', [order.id]);
    remindersSent += 1;
  }

  return remindersSent;
}

module.exports = { runBalanceDueReminders, isReminderDue };
