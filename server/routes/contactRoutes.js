const express = require('express');
const rateLimit = require('express-rate-limit');
const { createMessage, listMessages, markMessageRead } = require('../controllers/contactController');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

// Public, unauthenticated endpoint that triggers a DB write and an outbound
// email — worth its own tight limit so it can't be used to spam the shop's
// inbox or flood contact_messages, independent of the general API limiter.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please try again later.' },
});

router.post('/', contactLimiter, createMessage);
router.get('/', requireAuth, requireStaff, listMessages);
router.patch('/:id/read', requireAuth, requireStaff, markMessageRead);

module.exports = router;
