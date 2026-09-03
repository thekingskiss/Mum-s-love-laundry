const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getInvoice,
  downloadInvoicePdf,
  listInvoiceActivity,
  postInvoiceMessage,
  getPublicInvoice,
  initPublicPayment,
  verifyPublicPayment,
} = require('../controllers/invoiceController');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

// No login on these three — authorized by the invoice's own unguessable
// public_token instead of a session, so a customer can view/pay a bill from
// a texted link without an account. Own limiter since abuse here means
// hammering Paystack's initialize endpoint, not just our own DB.
const publicInvoiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// Mounted before the /:id routes below so "public" never matches as an id.
router.get('/public/:token', publicInvoiceLimiter, getPublicInvoice);
router.post('/public/:token/pay', publicInvoiceLimiter, initPublicPayment);
router.get('/public/:token/verify/:reference', publicInvoiceLimiter, verifyPublicPayment);

router.get('/:id', requireAuth, getInvoice);
router.get('/:id/pdf', requireAuth, downloadInvoicePdf);
router.get('/:id/activity', requireAuth, listInvoiceActivity);
router.post('/:id/activity', requireAuth, requireStaff, postInvoiceMessage);

module.exports = router;
