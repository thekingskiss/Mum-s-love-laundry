const express = require('express');
const { initializePayment, verifyPayment, webhook } = require('../controllers/paystackController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Customer paying their own order, or staff initiating a charge/payment link
// on a customer's behalf — the controller enforces who may pay for what.
router.post('/initialize', requireAuth, initializePayment);
router.get('/verify/:reference', requireAuth, verifyPayment);

// Paystack itself calls this — no user session, authenticated by HMAC
// signature inside the controller instead of requireAuth.
router.post('/webhook', webhook);

module.exports = router;
