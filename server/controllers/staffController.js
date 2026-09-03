const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateUniqueUsername } = require('../utils/username');

const SALT_ROUNDS = 12;
const STAFF_ROLES = ['laundry_staff', 'administrator'];

async function listStaff(req, res, next) {
  try {
    // Non-super_admin admins only ever see their own branch's staff;
    // super_admin sees everyone.
    const params = [];
    let where = "WHERE u.role != 'customer'";
    if (req.user.branch_id) {
      params.push(req.user.branch_id);
      where += ` AND u.branch_id = $${params.length}`;
    }
    const result = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.phone_number, u.location_zone, u.role, u.branch_id, b.name AS branch_name, u.created_at
       FROM users u
       LEFT JOIN branches b ON b.id = u.branch_id
       ${where} ORDER BY u.created_at DESC`,
      params
    );
    res.json({ staff: result.rows });
  } catch (err) {
    next(err);
  }
}

async function createStaff(req, res, next) {
  try {
    const { email, password, full_name, phone_number, location_zone, role, branch_id } = req.body;

    if (!email || !password || !full_name || !phone_number || !location_zone || !role) {
      return res.status(400).json({ error: 'email, password, full_name, phone_number, location_zone, and role are required.' });
    }
    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${STAFF_ROLES.join(', ')}` });
    }
    // Only a super_admin may create another administrator.
    if (role === 'administrator' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only a super admin can create administrator accounts.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    // A non-super_admin admin can only staff their own branch; super_admin
    // must say which branch explicitly.
    const staffBranchId = req.user.branch_id || branch_id;
    if (!staffBranchId) {
      return res.status(400).json({ error: 'branch_id is required.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const username = await generateUniqueUsername(pool, normalizedEmail);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, phone_number, location_zone, role, branch_id, username)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, username, full_name, phone_number, location_zone, role, branch_id, created_at`,
      [normalizedEmail, password_hash, full_name.trim(), phone_number.trim(), location_zone.trim(), role, staffBranchId, username]
    );

    res.status(201).json({ staff: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listStaff, createStaff };
