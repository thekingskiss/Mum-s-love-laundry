// Decides which outbound channels a notification may use, given the
// recipient's saved preferences. In-app notifications are always written, so a
// customer who opts out of email/SMS can still see the update in the app.
//
// A preference that is missing (no such user row) counts as opted in, matching
// the column defaults. Types not listed here are always sent: payment
// confirmations, admin messages, and birthday greetings have no setting.
function outboundChannels(type, prefs = {}) {
  const on = (field) => prefs[field] !== false;

  switch (type) {
    case 'order_status':
      return { email: on('email_order_updates'), sms: on('sms_order_updates') };
    case 'pickup_reminder':
      return { email: on('pickup_reminders'), sms: on('pickup_reminders') };
    case 'invoice':
    case 'invoice_reminder':
      return { email: on('invoice_notifications'), sms: on('invoice_notifications') };
    case 'low_stock':
      return { email: on('low_stock_alerts'), sms: on('low_stock_alerts') };
    default:
      return { email: true, sms: true };
  }
}

module.exports = { outboundChannels };
