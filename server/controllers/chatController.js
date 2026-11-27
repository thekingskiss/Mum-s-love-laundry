const pool = require('../config/db');
const { answer, MAX_MESSAGE_LENGTH } = require('../services/chatbot');

// Read-only lookups the assistant answers from. Each is loaded only when the
// question needs it, so "hi" never touches the database.
const data = {
  async getServices() {
    const { rows } = await pool.query(
      `SELECT id, service_name, description, base_price, pricing_unit, price_per_kg,
              promo_price, promo_starts_at, promo_ends_at
       FROM services ORDER BY base_price ASC`
    );
    return rows;
  },

  async getItems() {
    const { rows } = await pool.query(
      `SELECT category, item_name, unit_price, price_min, price_max
       FROM laundry_items WHERE is_active = true ORDER BY category, item_name`
    );
    return rows;
  },

  async getBranches() {
    const { rows } = await pool.query(
      'SELECT name, address, phone FROM branches WHERE is_active = true ORDER BY id'
    );
    return rows;
  },

  // Always scoped to the one signed-in customer: the assistant can never be
  // asked about anyone else's orders.
  async getOrders(userId) {
    const { rows } = await pool.query(
      `SELECT o.id, o.status, o.drop_off_date, o.pickup_date, o.storage_location,
              GREATEST(o.total_price - COALESCE(pay.amount_paid, 0), 0) AS balance_due,
              (SELECT string_agg(item_name || ' x' || quantity, ', ' ORDER BY id)
                 FROM order_items WHERE order_id = o.id) AS items_summary,
              (SELECT created_at FROM order_events
                 WHERE order_id = o.id AND to_status = 'ready_for_pickup'
                 ORDER BY created_at DESC LIMIT 1) AS ready_for_pickup_at
       FROM orders o
       LEFT JOIN LATERAL (
         SELECT SUM(CASE WHEN payment_type = 'refund' THEN -amount
                         WHEN payment_type = 'late_fee' THEN 0
                         ELSE amount END) AS amount_paid
         FROM payments WHERE order_id = o.id
       ) pay ON true
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT 20`,
      [userId]
    );
    return rows;
  },
};

async function sendMessage(req, res, next) {
  try {
    const { message } = req.body || {};
    if (typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Type a message first.' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Please keep your message under ${MAX_MESSAGE_LENGTH} characters.` });
    }

    const result = await answer(message, { user: req.user || null, data });
    res.json({ reply: result.reply, suggestions: result.suggestions, actions: result.actions });
  } catch (err) {
    next(err);
  }
}

module.exports = { sendMessage };
