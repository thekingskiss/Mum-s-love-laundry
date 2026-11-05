import express from 'express';
import { installFakeDb } from './fakeDb';
import { SECRET, answerAccountLookups } from './accounts';

// Builds the real routes with the real middleware on top of a fake database,
// the way server.js wires them, minus rate limits and logging.
//
//   const { app, db, close } = await buildApp();
//
// Routes are imported lazily so JWT_SECRET is set before they load.
export async function buildApp({ accountChanges } = {}) {
  process.env.JWT_SECRET = SECRET;
  const db = installFakeDb();
  answerAccountLookups(db, accountChanges);
  db.freeze();

  const { default: adminRoutes } = await import('../../routes/adminRoutes');
  const { default: orderRoutes } = await import('../../routes/orderRoutes');
  const { default: paystackRoutes } = await import('../../routes/paystackRoutes');
  const { default: authRoutes } = await import('../../routes/authRoutes');
  const { notFound, errorHandler } = await import('../../middleware/errorHandler');

  const app = express();
  // Same as server.js: keep the raw bytes, which the Paystack webhook needs to
  // check its signature.
  app.use(express.json({ limit: '100kb', verify: (req, res, buf) => { req.rawBody = buf; } }));
  app.use('/api/admin', adminRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/paystack', paystackRoutes);
  app.use('/api/auth', authRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return { app, db, close: () => db.restore() };
}

// Answers the queries notifyUser runs after a payment or status change, so
// tests don't fail on (or print noise from) fire-and-forget notifications.
export function answerNotifications(db) {
  db.on(/INSERT INTO notifications/, []);
  db.on(/email_order_updates.*FROM users WHERE id/s, [{
    email_order_updates: true, sms_order_updates: true, pickup_reminders: true,
    invoice_notifications: true, low_stock_alerts: true,
  }]);
}
