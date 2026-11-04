const pool = require('../config/db');
const { DIFFERENT_BRANCH_ERROR, canAccessBranch } = require('../utils/branchAccess');

function generateTagCode(orderId) {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MLL-${orderId}-${random}`;
}

async function listGarments(req, res, next) {
  try {
    const { orderId } = req.params;

    const order = await pool.query('SELECT branch_id FROM orders WHERE id = $1', [orderId]);
    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (!canAccessBranch(req.user, order.rows[0].branch_id)) {
      return res.status(403).json({ error: DIFFERENT_BRANCH_ERROR });
    }

    const result = await pool.query(
      'SELECT id, order_id, tag_code, description, damage_notes, status, created_at FROM garment_tags WHERE order_id = $1 ORDER BY created_at',
      [orderId]
    );
    res.json({ garments: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createGarment(req, res, next) {
  try {
    const { orderId } = req.params;
    const { description } = req.body;

    const order = await pool.query('SELECT id, branch_id FROM orders WHERE id = $1', [orderId]);
    if (order.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (!canAccessBranch(req.user, order.rows[0].branch_id)) {
      return res.status(403).json({ error: DIFFERENT_BRANCH_ERROR });
    }

    const tag_code = generateTagCode(orderId);
    const result = await pool.query(
      `INSERT INTO garment_tags (order_id, tag_code, description)
       VALUES ($1, $2, $3)
       RETURNING id, order_id, tag_code, description, damage_notes, status, created_at`,
      [orderId, tag_code, description || null]
    );
    res.status(201).json({ garment: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateGarment(req, res, next) {
  try {
    const { id } = req.params;
    const { status, damage_notes, description } = req.body;

    const allowedStatuses = ['tagged', 'in_process', 'ready', 'collected', 'damaged'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowedStatuses.join(', ')}` });
    }

    const garment = await pool.query(
      'SELECT o.branch_id FROM garment_tags g JOIN orders o ON o.id = g.order_id WHERE g.id = $1',
      [id]
    );
    if (garment.rows.length === 0) {
      return res.status(404).json({ error: 'Garment tag not found.' });
    }
    if (!canAccessBranch(req.user, garment.rows[0].branch_id)) {
      return res.status(403).json({ error: DIFFERENT_BRANCH_ERROR });
    }

    const result = await pool.query(
      `UPDATE garment_tags SET
         status = COALESCE($1, status),
         damage_notes = COALESCE($2, damage_notes),
         description = COALESCE($3, description)
       WHERE id = $4
       RETURNING id, order_id, tag_code, description, damage_notes, status, created_at`,
      [status, damage_notes, description, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Garment tag not found.' });
    }
    res.json({ garment: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listGarments, createGarment, updateGarment };
