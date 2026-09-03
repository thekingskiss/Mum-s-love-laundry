const pool = require('../config/db');

// Any authenticated user — the booking form and the staff branch switcher
// both need this, but it doesn't need to be public.
async function listBranches(req, res, next) {
  try {
    const result = await pool.query('SELECT id, name, address, phone, email FROM branches WHERE is_active = true ORDER BY name');
    res.json({ branches: result.rows });
  } catch (err) {
    next(err);
  }
}

async function listBranchesAdmin(req, res, next) {
  try {
    const result = await pool.query('SELECT id, name, address, phone, email, is_active, created_at FROM branches ORDER BY name');
    res.json({ branches: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createBranch(req, res, next) {
  try {
    const { name, address, phone, email } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required.' });
    }

    const result = await pool.query(
      `INSERT INTO branches (name, address, phone, email)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, address, phone, email, is_active, created_at`,
      [name.trim(), (address || '').trim() || null, (phone || '').trim() || null, (email || '').trim() || null]
    );
    res.status(201).json({ branch: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function updateBranch(req, res, next) {
  try {
    const { id } = req.params;
    const { name, address, phone, email, is_active } = req.body;
    const updates = [];
    const params = [];

    function set(column, value) {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    }

    if (name !== undefined) set('name', name.trim());
    if (address !== undefined) set('address', address.trim() || null);
    if (phone !== undefined) set('phone', phone.trim() || null);
    if (email !== undefined) set('email', email.trim() || null);
    if (is_active !== undefined) set('is_active', !!is_active);

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }

    params.push(id);
    const result = await pool.query(
      `UPDATE branches SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, address, phone, email, is_active, created_at`,
      params
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Branch not found.' });
    }
    res.json({ branch: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listBranches, listBranchesAdmin, createBranch, updateBranch };
