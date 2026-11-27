const express = require('express');
const rateLimit = require('express-rate-limit');
const { sendMessage } = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Public and database-backed, so it gets its own limit on top of the general
// API one: generous for a real conversation, tight enough to stop scraping.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You’re sending messages very quickly. Please wait a moment and try again.' },
});

// Anyone may chat; a signed-in customer additionally gets answers about their
// own orders. Without a token the request goes through as a visitor. With one,
// the normal sign-in checks apply (so a revoked login is refused, not treated
// as a visitor).
function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  return requireAuth(req, res, next);
}

router.post('/', chatLimiter, optionalAuth, sendMessage);

module.exports = router;
