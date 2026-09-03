const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      location_zone: decoded.location_zone,
      role: decoded.role,
      // null for a customer or a super_admin (super_admin means "all
      // branches" — enforced in application code, not the schema).
      branch_id: decoded.branch_id ?? null,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
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
