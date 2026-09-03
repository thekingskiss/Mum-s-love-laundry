const pool = require('../config/db');
const { notifyUser } = require('./notify');
const { NET_PAID_EXPR } = require('../controllers/paymentController');

const CLIENT_ORIGIN = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();

// A nudge the day an invoice falls due, then a weekly follow-up for as long
// as it stays unpaid past that — mirrors the cadence balanceDueReminders.js
// already uses for order-level balances.
function isInvoiceReminderDue(daysPastDue) {
  return daysPastDue === 0 || (daysPastDue > 0 && daysPastDue % 7 === 0);
}

// Sweeps every non-voided invoice with an outstanding balance and reminds
// the customer (email + SMS) with a link straight back to the invoice's pay
// page if it matches the reminder schedule and hasn't already been reminded
// today. Returns how many reminders were sent, for logging/manual-trigger
// feedback — same shape as runPickupReminders/runBalanceDueReminders.
async function runInvoiceReminders() {
  const result = await pool.query(
    `SELECT i.id, i.invoice_number, i.due_date, i.total_amount, i.public_token,
            o.user_id, u.email, u.phone_number,
            COALESCE(pay.net_paid, 0) AS net_paid
     FROM invoices i
     JOIN orders o ON o.id = i.order_id
     JOIN users u ON u.id = o.user_id
     LEFT JOIN LATERAL (
       SELECT ${NET_PAID_EXPR} AS net_paid FROM payments WHERE order_id = i.order_id
     ) pay ON true
     WHERE i.voided_at IS NULL
       AND (i.last_reminder_sent_at IS NULL OR i.last_reminder_sent_at::date < CURRENT_DATE)`
  );

  let remindersSent = 0;

  for (const invoice of result.rows) {
    const balance = Math.max(Number(invoice.total_amount) - Number(invoice.net_paid), 0);
    if (balance <= 0) continue;

    const daysPastDue = Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24));
    if (!isInvoiceReminderDue(daysPastDue)) continue;

    const link = `${CLIENT_ORIGIN}/pay/invoice/${invoice.public_token}`;
    const statusWord = daysPastDue > 0 ? 'overdue' : 'due today';
    await notifyUser(invoice.user_id, {
      type: 'invoice_reminder',
      title: 'Invoice Payment Reminder',
      body: `Reminder: Invoice ${invoice.invoice_number} is ${statusWord}. Balance: GHS ${balance.toFixed(2)}. Pay at ${link}`,
      email: invoice.email,
      phone: invoice.phone_number,
    });

    await pool.query('UPDATE invoices SET last_reminder_sent_at = NOW() WHERE id = $1', [invoice.id]);
    await pool.query(
      `INSERT INTO invoice_activity (invoice_id, event_type, body) VALUES ($1, 'reminder_sent', $2)`,
      [invoice.id, `Reminder sent to ${invoice.email || invoice.phone_number}.`]
    );
    remindersSent += 1;
  }

  return remindersSent;
}

module.exports = { runInvoiceReminders, isInvoiceReminderDue };
