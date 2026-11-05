const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// The token proves who someone is; the database says what they may do now.
// Role, branch and active status are read fresh on every request, so switching
// an account off or changing its role takes effect immediately instead of when
// the (7-day) token expires. A token issued before the last password change is
// refused too, so changing a password signs out anyone holding an old login.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, email, location_zone, role, branch_id, is_active, password_changed_at
       FROM users WHERE id = $1`,
      [decoded.id]
    );
    const account = result.rows[0];

    if (!account || account.is_active === false) {
      return res.status(401).json({ error: 'This account is no longer active.' });
    }
    if (account.password_changed_at && decoded.iat < Math.floor(new Date(account.password_changed_at).getTime() / 1000)) {
      return res.status(401).json({ error: 'Your password changed. Please log in again.' });
    }

    req.user = {
      id: account.id,
      email: account.email,
      location_zone: account.location_zone,
      role: account.role,
      // null for a customer or a super_admin (super_admin means "all
      // branches" — enforced in application code, not the schema).
      branch_id: account.branch_id ?? null,
    };
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

const requireAdmin = requireRole('administrator', 'super_admin');
const requireStaff = requireRole('laundry_staff', 'administrator', 'super_admin');

module.exports = { requireAuth, requireRole, requireAdmin, requireStaff };
