const express = require('express');
const rateLimit = require('express-rate-limit');
const { register, login, me, forgotPassword, resetPassword, updateProfile, uploadAvatar } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const { uploadAvatar: uploadAvatarMiddleware } = require('../middleware/upload');

const router = express.Router();

// Credential-guessing / account-enumeration surfaces get a tighter limit
// than the general API — these are the endpoints worth brute-forcing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/me', requireAuth, me);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.patch('/profile', requireAuth, updateProfile);
router.post('/profile/avatar', requireAuth, uploadAvatarMiddleware.single('avatar'), uploadAvatar);

module.exports = router;
