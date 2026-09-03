const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  advanceOrderStatus,
  setPickupDate,
  setStorageLocation,
  createStaffOrder,
  listCustomers,
  getCustomerDetail,
  getAnalytics,
  runRemindersNow,
  runBirthdayGreetingsNow,
  runBalanceDueRemindersNow,
  runInvoiceRemindersNow,
  sendMessage,
} = require('../controllers/adminController');
const { listStaff, createStaff } = require('../controllers/staffController');
const { listZonesAdmin, createZone, updateZone } = require('../controllers/zoneController');
const { listCapacity, setCapacity } = require('../controllers/capacityController');
const { listItemsAdmin, createItem, updateItem } = require('../controllers/itemController');
const { listCurrenciesAdmin, updateCurrency } = require('../controllers/currencyController');
const {
  listInventory,
  createInventoryItem,
  updateInventoryItem,
  adjustStock,
  listInventoryTransactions,
} = require('../controllers/inventoryController');
const { listExpenses, createExpense, deleteExpense } = require('../controllers/expenseController');
const { recordPayment, listAllPayments } = require('../controllers/paymentController');
const { listBranchesAdmin, createBranch, updateBranch } = require('../controllers/branchController');
const {
  generateInvoice,
  bulkGenerateInvoices,
  addInvoiceLine,
  removeInvoiceLine,
  updateInvoice,
  listInvoices,
  voidInvoice,
  sendInvoice,
} = require('../controllers/invoiceController');
const { requireAuth, requireAdmin, requireStaff, requireRole } = require('../middleware/auth');
const requireSuperAdmin = requireRole('super_admin');

const router = express.Router();

// A single request here can fan out into hundreds of notifyUser calls (and
// thus email/SMS provider calls) when broadcasting to all customers — worth
// its own tight limit independent of the general API limiter.
const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please try again later.' },
});

// Order status transitions — open to any staff role; the lifecycle's own
// role-per-edge rules (in canTransition) enforce who can do what.
router.post('/orders', requireAuth, requireStaff, createStaffOrder);
router.patch('/orders/:id', requireAuth, requireStaff, advanceOrderStatus);
router.patch('/orders/:id/pickup-date', requireAuth, requireStaff, setPickupDate);
router.patch('/orders/:id/storage-location', requireAuth, requireStaff, setStorageLocation);
router.post('/orders/:id/payments', requireAuth, requireStaff, recordPayment);

// Global transaction ledger — administrators only.
router.get('/payments', requireAuth, requireAdmin, listAllPayments);

// Invoices — open to any staff role (mirrors the order queue/payments they
// already work with); voiding one is administrator-only.
router.post('/orders/:id/invoice', requireAuth, requireStaff, generateInvoice);
router.post('/invoices/bulk', requireAuth, requireStaff, bulkGenerateInvoices);
router.get('/invoices', requireAuth, requireStaff, listInvoices);
router.patch('/invoices/:id', requireAuth, requireStaff, updateInvoice);
router.post('/invoices/:id/lines', requireAuth, requireStaff, addInvoiceLine);
router.delete('/invoices/:id/lines/:lineId', requireAuth, requireStaff, removeInvoiceLine);
router.post('/invoices/:id/send', requireAuth, requireStaff, sendInvoice);
router.delete('/invoices/:id', requireAuth, requireAdmin, voidInvoice);

// Staff management — administrators/super admins only.
router.get('/staff', requireAuth, requireAdmin, listStaff);
router.post('/staff', requireAuth, requireAdmin, createStaff);

// Branches — super admin only (managing/opening a new location is a
// business-level decision, not a day-to-day admin task).
router.get('/branches', requireAuth, requireSuperAdmin, listBranchesAdmin);
router.post('/branches', requireAuth, requireSuperAdmin, createBranch);
router.patch('/branches/:id', requireAuth, requireSuperAdmin, updateBranch);

// Zones — administrators only.
router.get('/zones', requireAuth, requireAdmin, listZonesAdmin);
router.post('/zones', requireAuth, requireAdmin, createZone);
router.patch('/zones/:id', requireAuth, requireAdmin, updateZone);

// Daily capacity — administrators only.
router.get('/capacity', requireAuth, requireAdmin, listCapacity);
router.post('/capacity', requireAuth, requireAdmin, setCapacity);

// Laundry item catalog (the real price list) — administrators only.
router.get('/items', requireAuth, requireAdmin, listItemsAdmin);
router.post('/items', requireAuth, requireAdmin, createItem);
router.patch('/items/:id', requireAuth, requireAdmin, updateItem);

// Display currencies (manual exchange rates) — administrators only.
router.get('/currencies', requireAuth, requireAdmin, listCurrenciesAdmin);
router.patch('/currencies/:code', requireAuth, requireAdmin, updateCurrency);

// Customer directory + full order detail — open to any staff role, same as the order queue.
router.get('/customers', requireAuth, requireStaff, listCustomers);
router.get('/customers/:id', requireAuth, requireStaff, getCustomerDetail);

// Revenue/volume analytics — administrators only.
router.get('/analytics', requireAuth, requireAdmin, getAnalytics);

// Inventory (laundry essentials) — administrators only.
router.get('/inventory', requireAuth, requireAdmin, listInventory);
router.post('/inventory', requireAuth, requireAdmin, createInventoryItem);
router.patch('/inventory/:id', requireAuth, requireAdmin, updateInventoryItem);
router.post('/inventory/:id/adjust', requireAuth, requireAdmin, adjustStock);
router.get('/inventory/:id/transactions', requireAuth, requireAdmin, listInventoryTransactions);

// Expenses — administrators only.
router.get('/expenses', requireAuth, requireAdmin, listExpenses);
router.post('/expenses', requireAuth, requireAdmin, createExpense);
router.delete('/expenses/:id', requireAuth, requireAdmin, deleteExpense);

// Manually trigger the daily pickup-reminder sweep — administrators only.
router.post('/reminders/run', requireAuth, requireAdmin, runRemindersNow);

// Manually trigger the daily birthday-greeting sweep — administrators only.
router.post('/birthdays/run', requireAuth, requireAdmin, runBirthdayGreetingsNow);

// Manually trigger the daily balance-due-reminder sweep — administrators only.
router.post('/balance-reminders/run', requireAuth, requireAdmin, runBalanceDueRemindersNow);

// Manually trigger the daily invoice-reminder sweep — administrators only.
router.post('/invoice-reminders/run', requireAuth, requireAdmin, runInvoiceRemindersNow);

// Admin-authored message to one customer (customer_id) or broadcast to all — administrators only.
router.post('/messages', requireAuth, requireAdmin, messageLimiter, sendMessage);

module.exports = router;
