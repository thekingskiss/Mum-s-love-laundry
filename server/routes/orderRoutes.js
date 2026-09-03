const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  createOrder,
  listMyOrders,
  listOrders,
  getOrder,
  getOrderHistory,
  cancelOrder,
  sendReceipt,
} = require('../controllers/orderController');
const { listGarments, createGarment, updateGarment } = require('../controllers/garmentController');
const { listOrderPayments } = require('../controllers/paymentController');
const { getInvoiceForOrder } = require('../controllers/invoiceController');
const { requireAuth, requireStaff } = require('../middleware/auth');

const router = express.Router();

// Each hit sends a real email/SMS — its own tight limiter independent of
// the general API cap, so it can't be used to mail-bomb a customer (or,
// via a staff-supplied override, a third party).
const receiptShareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many receipt-share requests. Please try again later.' },
});

router.post('/', requireAuth, createOrder);
router.get('/user', requireAuth, listMyOrders);
router.get('/', requireAuth, requireStaff, listOrders);
router.get('/:id', requireAuth, getOrder);
router.get('/:id/history', requireAuth, getOrderHistory);
router.get('/:id/payments', requireAuth, listOrderPayments);
router.get('/:id/invoice', requireAuth, getInvoiceForOrder);
router.post('/:id/cancel', requireAuth, cancelOrder);
router.post('/:id/receipt/send', requireAuth, receiptShareLimiter, sendReceipt);

router.get('/:orderId/garments', requireAuth, requireStaff, listGarments);
router.post('/:orderId/garments', requireAuth, requireStaff, createGarment);
router.patch('/garments/:id', requireAuth, requireStaff, updateGarment);

module.exports = router;
