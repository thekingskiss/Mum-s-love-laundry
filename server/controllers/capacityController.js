const pool = require('../config/db');

const DEFAULT_MAX_ORDERS = Number(process.env.MAX_DAILY_CAPACITY) || 50;

async function checkCapacity(req, res, next) {
  try {
    const { date, branch_id } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date query parameter is required (YYYY-MM-DD).' });
    }
    if (!branch_id) {
      return res.status(400).json({ error: 'branch_id query parameter is required.' });
    }
    const result = await pool.query(
      'SELECT max_orders, current_orders FROM daily_capacity WHERE capacity_date = $1 AND branch_id = $2',
      [date, branch_id]
    );
    const row = result.rows[0] || { max_orders: DEFAULT_MAX_ORDERS, current_orders: 0 };
    res.json({
      date,
      max_orders: row.max_orders,
      current_orders: row.current_orders,
      available: row.current_orders < row.max_orders,
    });
  } catch (err) {
    next(err);
  }
}

// Non-super_admin staff only ever see/manage their own branch's capacity —
// super_admin may pass branch_id to filter, or omit it to see every branch.
async function listCapacity(req, res, next) {
  try {
    const branchId = req.user.branch_id || req.query.branch_id;
    const conditions = [];
    const params = [];
    if (branchId) {
      params.push(branchId);
      conditions.push(`c.branch_id = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT c.id, c.capacity_date, c.max_orders, c.current_orders, c.branch_id, b.name AS branch_name
       FROM daily_capacity c
       JOIN branches b ON b.id = c.branch_id
       ${where}
       ORDER BY c.capacity_date DESC LIMIT 60`,
      params
    );
    res.json({ capacity: result.rows });
  } catch (err) {
    next(err);
  }
}

async function setCapacity(req, res, next) {
  try {
    const { date, max_orders } = req.body;
    // Non-super_admin staff can only ever set capacity for their own branch;
    // super_admin must say which branch explicitly.
    const branchId = req.user.branch_id || req.body.branch_id;
    if (!date || max_orders === undefined || max_orders === null || Number(max_orders) < 0) {
      return res.status(400).json({ error: 'date and a non-negative max_orders are required.' });
    }
    if (!branchId) {
      return res.status(400).json({ error: 'branch_id is required.' });
    }
    const result = await pool.query(
      `INSERT INTO daily_capacity (capacity_date, branch_id, max_orders)
       VALUES ($1, $2, $3)
       ON CONFLICT (capacity_date, branch_id) DO UPDATE SET max_orders = EXCLUDED.max_orders
       RETURNING id, capacity_date, branch_id, max_orders, current_orders`,
      [date, branchId, max_orders]
    );
    res.json({ capacity: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// Reserve one slot for `date` at `branchId` within an existing transaction
// (pass the checked-out pg client, not the pool). Throws a 409 error if
// fully booked.
async function reserveCapacity(client, date, branchId) {
  const existing = await client.query(
    'SELECT max_orders, current_orders FROM daily_capacity WHERE capacity_date = $1 AND branch_id = $2 FOR UPDATE',
    [date, branchId]
  );
  let row = existing.rows[0];

  if (!row) {
    const inserted = await client.query(
      'INSERT INTO daily_capacity (capacity_date, branch_id, max_orders, current_orders) VALUES ($1, $2, $3, 0) RETURNING max_orders, current_orders',
      [date, branchId, DEFAULT_MAX_ORDERS]
    );
    row = inserted.rows[0];
  }

  if (row.current_orders >= row.max_orders) {
    const err = new Error(`Fully booked for ${date}. Please choose another drop-off date.`);
    err.status = 409;
    throw err;
  }

  await client.query('UPDATE daily_capacity SET current_orders = current_orders + 1 WHERE capacity_date = $1 AND branch_id = $2', [date, branchId]);
}

async function releaseCapacity(client, date, branchId) {
  await client.query(
    'UPDATE daily_capacity SET current_orders = GREATEST(current_orders - 1, 0) WHERE capacity_date = $1 AND branch_id = $2',
    [date, branchId]
  );
}

module.exports = {
  checkCapacity,
  listCapacity,
  setCapacity,
  reserveCapacity,
  releaseCapacity,
  DEFAULT_MAX_ORDERS,
};
