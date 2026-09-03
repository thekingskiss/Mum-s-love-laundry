const pool = require('../config/db');

async function listNotifications(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, type, title, body, channel, read_at, created_at
       FROM notifications
       WHERE user_id = $1 AND channel = 'in_app'
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING id, type, title, body, channel, read_at, created_at`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found.' });
    }
    res.json({ notification: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listNotifications, markRead };
