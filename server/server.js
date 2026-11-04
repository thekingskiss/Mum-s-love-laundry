require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');
const zoneRoutes = require('./routes/zoneRoutes');
const capacityRoutes = require('./routes/capacityRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const itemRoutes = require('./routes/itemRoutes');
const currencyRoutes = require('./routes/currencyRoutes');
const contactRoutes = require('./routes/contactRoutes');
const paystackRoutes = require('./routes/paystackRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const branchRoutes = require('./routes/branchRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// A weak or missing signing secret compromises every account on the system
// (anyone could forge an admin token), so refuse to boot with one in
// production. Development keeps a warning only, so the shipped .env example
// still works out of the box for local setup.
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET is missing or too short. Set it to a long, random value (32+ characters) before starting in production.');
    process.exit(1);
  } else {
    console.warn('WARNING: JWT_SECRET is missing or short. Set a long, random value before deploying to production.');
  }
}

if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)
) {
  console.error('FATAL: Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET for production avatar storage.');
  process.exit(1);
}
const app = express();

// Behind a reverse proxy in production (e.g. Nginx/Render/Railway terminating
// TLS) so req.ip and rate-limiting see the real client address.
app.set('trust proxy', 1);

app.use(helmet());

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));
// Requests are small JSON forms — cap well above any legitimate payload to
// blunt large-body memory/CPU exhaustion attempts. File uploads go through
// multer's own separate size limit, not this parser. The `verify` hook stows
// the raw bytes on the request too — the Paystack webhook needs those (not
// the re-serialized JSON) to check its HMAC signature.
app.use(express.json({ limit: '100kb', verify: (req, res, buf) => { req.rawBody = buf; } }));
// Client and API run on different origins (ports) in dev, and can on
// different subdomains in production, so uploaded assets need an explicit
// cross-origin allowance — helmet's default CORP is same-origin, which
// silently blocks <img> loads from the client.
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/capacity', capacityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/currencies', currencyRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/paystack', paystackRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/branches', branchRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Mum's Love Laundry API listening on port ${PORT}`);
});

// Without this, `node --watch` restarts leave the old process's listening
// socket bound just long enough that the new process's app.listen() loses
// the race and dies with EADDRINUSE.
function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
