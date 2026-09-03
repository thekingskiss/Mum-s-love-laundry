const pool = require('../config/db');
const { notifyUser } = require('./notify');
const { calculateLateFee, FREE_PICKUP_DAYS, LATE_FEE_PER_DAY } = require('../utils/lateFee');

// A gentle nudge before fees kick in, then a weekly reminder (with the
// accrued fee) for as long as the order sits uncollected.
function isReminderDue(daysReady) {
  return daysReady === 3 || (daysReady >= FREE_PICKUP_DAYS && daysReady % 7 === 0);
}

// Sweeps every order still sitting ready_for_pickup and reminds the
// customer (email + SMS) if it matches the reminder schedule and hasn't
// already been reminded today. Returns how many reminders were sent, for
// logging/manual-trigger feedback.
async function runPickupReminders() {
  const result = await pool.query(
    `SELECT o.id, o.user_id, u.email, u.phone_number, u.full_name,
            (SELECT created_at FROM order_events WHERE order_id = o.id AND to_status = 'ready_for_pickup' ORDER BY created_at DESC LIMIT 1) AS ready_for_pickup_at,
            (SELECT string_agg(item_name || ' x' || quantity, ', ') FROM order_items WHERE order_id = o.id) AS items_summary
     FROM orders o
     JOIN users u ON u.id = o.user_id
     WHERE o.status = 'ready_for_pickup'
       AND (o.last_reminder_sent_at IS NULL OR o.last_reminder_sent_at::date < CURRENT_DATE)`
  );

  let remindersSent = 0;

  for (const order of result.rows) {
    const { daysReady, fee } = calculateLateFee(order.ready_for_pickup_at);
    if (!isReminderDue(daysReady)) continue;

    const isOverdue = daysReady >= FREE_PICKUP_DAYS;
    const body = isOverdue
      ? `Reminder: your order (${order.items_summary || 'items'}) has been ready for pickup for ${daysReady} days and has accrued a GHS ${fee} storage fee (GHS ${LATE_FEE_PER_DAY}/day after the first ${FREE_PICKUP_DAYS} days free). Please collect it as soon as possible.`
      : `Reminder: your order (${order.items_summary || 'items'}) has been ready for pickup for ${daysReady} days. Pickup is free for ${FREE_PICKUP_DAYS} days — please collect it soon.`;

    await notifyUser(order.user_id, {
      type: 'pickup_reminder',
      title: isOverdue ? 'Overdue Pickup — Storage Fee Applies' : 'Reminder: Your Order Is Ready',
      body,
      email: order.email,
      phone: order.phone_number,
    });

    await pool.query('UPDATE orders SET last_reminder_sent_at = NOW() WHERE id = $1', [order.id]);
    remindersSent += 1;
  }

  return remindersSent;
}

module.exports = { runPickupReminders, isReminderDue };
