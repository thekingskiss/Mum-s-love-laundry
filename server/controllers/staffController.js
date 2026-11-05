const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { generateUniqueUsername } = require('../utils/username');
const { recordAudit } = require('../services/auditLog');
const { checkStaffChange } = require('../utils/staffRules');

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
      `SELECT u.id, u.email, u.full_name, u.phone_number, u.location_zone, u.role, u.branch_id, b.name AS branch_name, u.is_active, u.created_at
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

    await recordAudit(req.user, {
      action: 'staff.created',
      entityType: 'user',
      entityId: result.rows[0].id,
      summary: `Created ${role} account for ${normalizedEmail}`,
    });

    res.status(201).json({ staff: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

async function loadStaffTarget(id) {
  if (!/^\d+$/.test(String(id))) return null;
  const result = await pool.query(
    'SELECT id, email, role, branch_id, is_active FROM users WHERE id = $1',
    [Number(id)]
  );
  return result.rows[0] || null;
}

// Runs the shared permission check; sends the refusal and returns null if the
// change isn't allowed, otherwise returns the target account.
async function authorizeStaffChange(req, res, change) {
  const target = await loadStaffTarget(req.params.id);
  const refusal = checkStaffChange({ actor: req.user, target, change });
  if (refusal) {
    res.status(refusal.status).json({ error: refusal.error });
    return null;
  }
  return target;
}

// PATCH /staff/:id  { role?, branch_id? }  (super admin only)
async function updateStaff(req, res, next) {
  try {
    const { role, branch_id } = req.body;
    if (role === undefined && branch_id === undefined) {
      return res.status(400).json({ error: 'Provide a role or a branch_id to change.' });
    }

    let target = null;
    if (role !== undefined) {
      target = await authorizeStaffChange(req, res, { type: 'role', role });
      if (!target) return undefined;
    }
    if (branch_id !== undefined) {
      const branchId = Number(branch_id);
      target = await authorizeStaffChange(req, res, { type: 'branch', branchId });
      if (!target) return undefined;
      const branch = await pool.query('SELECT id FROM branches WHERE id = $1', [branchId]);
      if (branch.rows.length === 0) {
        return res.status(400).json({ error: 'That branch does not exist.' });
      }
    }

    const sets = [];
    const params = [];
    if (role !== undefined) {
      params.push(role);
      sets.push(`role = $${params.length}`);
    }
    if (branch_id !== undefined) {
      params.push(Number(branch_id));
      sets.push(`branch_id = $${params.length}`);
    }
    params.push(target.id);
    const result = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, email, full_name, role, branch_id, is_active`,
      params
    );

    const changes = [];
    if (role !== undefined) changes.push(`role ${target.role} -> ${role}`);
    if (branch_id !== undefined) changes.push(`branch ${target.branch_id} -> ${Number(branch_id)}`);
    await recordAudit(req.user, {
      action: 'staff.updated',
      entityType: 'user',
      entityId: target.id,
      summary: `Updated ${target.email}: ${changes.join(', ')}`,
    });

    res.json({ staff: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// PATCH /staff/:id/active  { active: boolean }
async function setStaffActive(req, res, next) {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'active must be true or false.' });
    }
    const target = await authorizeStaffChange(req, res, { type: 'active' });
    if (!target) return undefined;

    const result = await pool.query(
      `UPDATE users SET is_active = $1, deactivated_at = CASE WHEN $1 THEN NULL ELSE NOW() END
       WHERE id = $2 RETURNING id, email, full_name, role, branch_id, is_active`,
      [active, target.id]
    );

    await recordAudit(req.user, {
      action: active ? 'staff.reactivated' : 'staff.deactivated',
      entityType: 'user',
      entityId: target.id,
      summary: `${active ? 'Reactivated' : 'Deactivated'} ${target.role} account for ${target.email}`,
    });

    res.json({ staff: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /staff/:id/password  { password }
async function resetStaffPassword(req, res, next) {
  try {
    const { password } = req.body;
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const target = await authorizeStaffChange(req, res, { type: 'password' });
    if (!target) return undefined;

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    // password_changed_at signs the person out everywhere (see middleware/auth).
    await pool.query(
      `UPDATE users SET password_hash = $1, password_changed_at = NOW(),
              reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = $2`,
      [password_hash, target.id]
    );

    await recordAudit(req.user, {
      action: 'staff.password_reset',
      entityType: 'user',
      entityId: target.id,
      summary: `Reset the password for ${target.email}`,
    });

    res.json({ message: 'Password updated. They have been signed out everywhere.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listStaff, createStaff, updateStaff, setStaffActive, resetStaffPassword };
