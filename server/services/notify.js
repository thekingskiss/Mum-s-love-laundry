const pool = require('../config/db');
const { outboundChannels } = require('../utils/notificationPrefs');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

let twilioLib;
try {
  twilioLib = require('twilio');
} catch {
  twilioLib = null;
}

const emailEnabled = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && nodemailer);
const smsEnabled = Boolean(
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER && twilioLib
);

const mailer = emailEnabled
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

const smsClient = smsEnabled ? twilioLib(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

// `attachments` uses nodemailer's shape: [{ filename, content, contentType }].
async function sendEmail(to, subject, body, attachments = []) {
  if (!mailer) {
    console.log(`[notify] Email not configured — would send to ${to}: "${subject}"`);
    return false;
  }
  const message = { from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, text: body };
  if (attachments.length) message.attachments = attachments;
  await mailer.sendMail(message);
  return true;
}

async function sendSms(to, body) {
  if (!smsClient) {
    console.log(`[notify] SMS not configured — would send to ${to}: "${body}"`);
    return false;
  }
  await smsClient.messages.create({ from: process.env.TWILIO_PHONE_NUMBER, to, body });
  return true;
}

// Always logs an in-app notification; also attempts email/SMS if the
// recipient's contact info is provided (those channels only fire once
// SMTP_* / TWILIO_* env vars are set — otherwise they log and no-op). Email and
// SMS are skipped when the recipient has opted out of this notification type.
//
// Admin messages can carry files: `attachments` is the saved metadata shown in
// the app, `emailAttachments` the actual files for the email copy. `skipInApp`
// is for direct, email-only messages that should not appear in the app.
// Resolves to { emailSent, smsSent } so callers can report what really went out.
async function notifyUser(
  userId,
  { type, title, body, email, phone, attachments = [], emailAttachments = [], skipInApp = false }
) {
  const outcome = { emailSent: false, smsSent: false };

  if (!skipInApp) {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, channel, sent_at, attachments)
       VALUES ($1, $2, $3, $4, 'in_app', CURRENT_TIMESTAMP, $5::jsonb)`,
      [userId, type, title, body, JSON.stringify(attachments)]
    );
  }

  const prefsResult = await pool.query(
    `SELECT email_order_updates, sms_order_updates, pickup_reminders, invoice_notifications, low_stock_alerts
     FROM users WHERE id = $1`,
    [userId]
  );
  const allowed = outboundChannels(type, prefsResult.rows[0]);

  if (email && allowed.email) {
    const sent = await sendEmail(email, title, body, emailAttachments);
    outcome.emailSent = sent;
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, channel, sent_at, attachments)
       VALUES ($1, $2, $3, $4, 'email', $5, $6::jsonb)`,
      [userId, type, title, body, sent ? new Date() : null, JSON.stringify(attachments)]
    );
  }

  if (phone && allowed.sms) {
    const sent = await sendSms(phone, `${title}: ${body}`);
    outcome.smsSent = sent;
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, channel, sent_at)
       VALUES ($1, $2, $3, $4, 'sms', $5)`,
      [userId, type, title, body, sent ? new Date() : null]
    );
  }

  return outcome;
}

module.exports = { notifyUser, sendEmail, sendSms, emailEnabled, smsEnabled };
