const pool = require('../config/db');
const { sendEmail } = require('../services/notify');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createMessage(req, res, next) {
  try {
    const { name, email, message } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required.' });
    }
    if (!email || !EMAIL_PATTERN.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'message is required.' });
    }

    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, message)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, message, created_at`,
      [name.trim(), email.trim().toLowerCase(), message.trim()]
    );

    const shopEmail = process.env.CONTACT_EMAIL || process.env.SMTP_USER;
    if (shopEmail) {
      sendEmail(
        shopEmail,
        `New contact message from ${name.trim()}`,
        `From: ${name.trim()} <${email.trim()}>\n\n${message.trim()}`
      ).catch((err) => console.error('[contact] failed to notify shop:', err.message));
    }

    res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function listMessages(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, message, read_at, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200'
    );
    res.json({ messages: result.rows });
  } catch (err) {
    next(err);
  }
}

async function markMessageRead(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE contact_messages SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE id = $1
       RETURNING id, name, email, message, read_at, created_at`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found.' });
    }
    res.json({ message: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { createMessage, listMessages, markMessageRead };
