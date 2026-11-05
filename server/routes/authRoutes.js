const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { register, login, me, forgotPassword, resetPassword, updateProfile, uploadAvatar } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { uploadAvatar: uploadAvatarMiddleware } = require('../middleware/upload');

const router = express.Router();

// Credential-guessing / account-enumeration surfaces get a tighter limit
// than the general API — these are the endpoints worth brute-forcing.
//
// Two limits work together. The per-IP one is generous because many customers
// share a mobile-network or office IP address, so one person's mistakes
// shouldn't lock everyone else out. The per-account one is strict, so guessing
// at a single account's password still stops after a few tries from anywhere.
const WINDOW_MS = 15 * 60 * 1000;
const tooMany = { error: 'Too many attempts. Please try again later.' };

const ipLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
});

const accountLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany,
  // Keyed by the email being attacked; falls back to the IP when there is none.
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return email ? `acct:${email}` : ipKeyGenerator(req.ip);
  },
});

router.post('/register', ipLimiter, register);
router.post('/login', ipLimiter, accountLimiter, login);
router.get('/me', requireAuth, me);
router.post('/forgot-password', ipLimiter, accountLimiter, forgotPassword);
router.post('/reset-password', ipLimiter, resetPassword);
router.patch('/profile', requireAuth, updateProfile);
router.post('/profile/avatar', requireAuth, uploadAvatarMiddleware.single('avatar'), uploadAvatar);

module.exports = router;
