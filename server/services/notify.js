const pool = require('../config/db');

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

async function sendEmail(to, subject, body) {
  if (!mailer) {
    console.log(`[notify] Email not configured — would send to ${to}: "${subject}"`);
    return false;
  }
  await mailer.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to, subject, text: body });
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
// SMTP_* / TWILIO_* env vars are set — otherwise they log and no-op).
async function notifyUser(userId, { type, title, body, email, phone }) {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, body, channel, sent_at)
     VALUES ($1, $2, $3, $4, 'in_app', CURRENT_TIMESTAMP)`,
    [userId, type, title, body]
  );

  if (email) {
    const sent = await sendEmail(email, title, body);
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, channel, sent_at)
       VALUES ($1, $2, $3, $4, 'email', $5)`,
      [userId, type, title, body, sent ? new Date() : null]
    );
  }

  if (phone) {
    const sent = await sendSms(phone, `${title}: ${body}`);
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, channel, sent_at)
       VALUES ($1, $2, $3, $4, 'sms', $5)`,
      [userId, type, title, body, sent ? new Date() : null]
    );
  }
}

module.exports = { notifyUser, sendEmail, sendSms, emailEnabled, smsEnabled };
