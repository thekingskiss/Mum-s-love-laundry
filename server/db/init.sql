-- Mum's Love Laundry — Local PostgreSQL schema (v13.0, adds storage location)
-- Run with: psql -U <DB_USER> -d <DB_NAME> -f server/db/init.sql

BEGIN;

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  location_zone VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'laundry_staff', 'administrator', 'super_admin')),
  avatar_url VARCHAR(500),
  preferred_language VARCHAR(10) NOT NULL DEFAULT 'en',
  preferred_currency VARCHAR(10) NOT NULL DEFAULT 'GHS',
  theme_preference VARCHAR(10) NOT NULL DEFAULT 'light'
    CHECK (theme_preference IN ('light', 'dark')),
  reset_token_hash VARCHAR(255),
  reset_token_expires_at TIMESTAMP,
  date_of_birth DATE,
  last_birthday_greeted_year INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- currencies — admin-configurable manual exchange rates relative to
-- GHS (the currency all orders are actually priced/stored in). Purely
-- a display preference; it never changes what's charged.
-- ============================================================
CREATE TABLE IF NOT EXISTS currencies (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  rate_to_ghs DECIMAL(12, 6) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================
-- service_zones — informational only (which areas customers come
-- from); doesn't gate anything since customers walk in to drop off.
-- ============================================================
CREATE TABLE IF NOT EXISTS service_zones (
  id SERIAL PRIMARY KEY,
  zone_name VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- services
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  service_name VARCHAR(255) NOT NULL,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  icon_name VARCHAR(100),
  pricing_unit VARCHAR(20) NOT NULL DEFAULT 'flat' CHECK (pricing_unit IN ('flat', 'per_kg')),
  price_per_kg DECIMAL(10, 2),
  promo_price DECIMAL(10, 2),
  promo_starts_at TIMESTAMP,
  promo_ends_at TIMESTAMP
);

-- ============================================================
-- service_pricing_history — audit trail for price changes
-- ============================================================
CREATE TABLE IF NOT EXISTS service_pricing_history (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  changed_by INTEGER REFERENCES users(id),
  old_base_price DECIMAL(10, 2),
  new_base_price DECIMAL(10, 2),
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- daily_capacity — optional per-day order caps
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_capacity (
  id SERIAL PRIMARY KEY,
  capacity_date DATE UNIQUE NOT NULL,
  max_orders INTEGER NOT NULL DEFAULT 50,
  current_orders INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id),
  status VARCHAR(30) NOT NULL DEFAULT 'order_received'
    CHECK (status IN (
      'order_received', 'in_washing', 'ironing_process', 'quality_check',
      'ready_for_pickup', 'completed', 'cancelled'
    )),
  drop_off_date DATE NOT NULL,
  pickup_date DATE, -- assigned by staff once the order is received; when it'll be ready to collect
  estimated_kg DECIMAL(6, 2),
  total_price DECIMAL(10, 2) NOT NULL,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  storage_location VARCHAR(20) CHECK (storage_location IN ('Shelf 1', 'Area 2', 'Area 3', 'Area 4')),
  assigned_staff_id INTEGER REFERENCES users(id),
  notes TEXT,
  last_reminder_sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_staff ON orders(assigned_staff_id);

-- ============================================================
-- order_events — status transition history / audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS order_events (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);

-- ============================================================
-- garment_tags — per-item tracking within an order
-- ============================================================
CREATE TABLE IF NOT EXISTS garment_tags (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tag_code VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255),
  damage_notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'tagged' CHECK (status IN ('tagged', 'in_process', 'ready', 'collected', 'damaged')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_garment_tags_order_id ON garment_tags(order_id);

-- ============================================================
-- notifications — in-app now; email/SMS channels scaffolded
-- for when SMTP/Twilio credentials are configured.
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  channel VARCHAR(20) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'sms')),
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- laundry_items — the real, physical per-garment price list
-- ============================================================
CREATE TABLE IF NOT EXISTS laundry_items (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  item_name VARCHAR(150) UNIQUE NOT NULL,
  unit_price DECIMAL(10, 2),
  price_min DECIMAL(10, 2),
  price_max DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (unit_price IS NOT NULL AND price_min IS NULL AND price_max IS NULL) OR
    (unit_price IS NULL AND price_min IS NOT NULL AND price_max IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_laundry_items_category ON laundry_items(category);

-- ============================================================
-- order_items — a cart of items per order, snapshotted at order time
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  laundry_item_id INTEGER REFERENCES laundry_items(id),
  item_name VARCHAR(150) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  is_price_estimated BOOLEAN NOT NULL DEFAULT false,
  line_total DECIMAL(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- contact_messages — public Contact page submissions
-- ============================================================
CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);

-- ============================================================
-- Seed data — laundry services
-- ============================================================
INSERT INTO services (service_name, description, base_price, icon_name)
SELECT * FROM (VALUES
  ('Washing Only', 'Standard wash cycle with detergent and fabric softener, gentle on every fabric.', 15.00, 'washer'),
  ('Ironing Only', 'Sharp, professional pressing and folding for clean or customer-supplied garments.', 10.00, 'iron'),
  ('Wash & Iron', 'Our full-service package: wash, dry, iron, and fold — ready to wear.', 22.00, 'shirt'),
  ('Dry Cleaning', 'Specialist care for delicate fabrics, suits, and formal wear.', 30.00, 'sparkles')
) AS v(service_name, description, base_price, icon_name)
WHERE NOT EXISTS (SELECT 1 FROM services);

-- ============================================================
-- Seed data — Eastern Region service zones
-- ============================================================
INSERT INTO service_zones (zone_name)
SELECT * FROM (VALUES
  ('Koforidua'), ('Akropong'), ('Nkawkaw'), ('Mpraeso'),
  ('Suhum'), ('Akim Oda'), ('Nsawam'), ('New Tafo'), ('Eastern Region'),
  ('Peduase'), ('Aburi'), ('Ahwerease'), ('Obosomase'), ('Tutu'),
  ('Mampong Akuapem'), ('Abotakyi'), ('Amanokrom'), ('Mamfe'), ('Larteh'),
  ('Abiriw'), ('Dawu'), ('Awukugua'), ('Adukrom'), ('Apirede'),
  ('Aseseeso (Abonse)'), ('Berekusu'), ('Atweasin'), ('Odawu'), ('Obodan'),
  ('Konkonuru'), ('Yensiso'), ('Adamorobe'), ('Gyankam')
) AS v(zone_name)
WHERE NOT EXISTS (SELECT 1 FROM service_zones);

-- ============================================================
-- Seed data — the real Mum's Love Laundry price list
-- ============================================================
INSERT INTO laundry_items (category, item_name, unit_price, price_min, price_max)
SELECT * FROM (VALUES
  -- Everyday Wear
  ('Everyday Wear', 'Shirt', 10.00, NULL, NULL),
  ('Everyday Wear', 'T-shirt', 8.00, NULL, NULL),
  ('Everyday Wear', 'Polo Shirt', 8.00, NULL, NULL),
  ('Everyday Wear', 'Jeans', 15.00, NULL, NULL),
  ('Everyday Wear', 'Trousers', 10.00, NULL, NULL),
  ('Everyday Wear', 'Shorts', 8.00, NULL, NULL),
  ('Everyday Wear', 'Jacket', 20.00, NULL, NULL),
  ('Everyday Wear', 'Hoodie', 15.00, NULL, NULL),
  ('Everyday Wear', 'Sweater', 15.00, NULL, NULL),
  ('Everyday Wear', 'Underwear', 3.00, NULL, NULL),
  ('Everyday Wear', 'Blouse', 5.00, NULL, NULL),
  ('Everyday Wear', 'Tunic', 20.00, NULL, NULL),
  ('Everyday Wear', 'Leggings', 5.00, NULL, NULL),
  ('Everyday Wear', 'African Print (Top & Skirt)', 15.00, NULL, NULL),
  ('Everyday Wear', 'Pajamas', 10.00, NULL, NULL),
  ('Everyday Wear', 'Nighties', 10.00, NULL, NULL),
  ('Everyday Wear', 'Singlet', 3.00, NULL, NULL),
  ('Everyday Wear', 'Track Suit', 15.00, NULL, NULL),
  ('Everyday Wear', 'Office Dress (Female)', 10.00, NULL, NULL),
  ('Everyday Wear', 'Men Cloth', 35.00, NULL, NULL),
  ('Everyday Wear', 'Sneakers', 25.00, NULL, NULL),

  -- Bedding & Linens
  ('Bedding & Linens', 'Bedsheet with Pillowcase', 25.00, NULL, NULL),
  ('Bedding & Linens', 'Bedsheet without Pillowcase', 20.00, NULL, NULL),
  ('Bedding & Linens', 'Bedsheet (King)', 30.00, NULL, NULL),
  ('Bedding & Linens', 'Bedsheet (Queen)', 25.00, NULL, NULL),
  ('Bedding & Linens', 'Bedsheet (Double)', 20.00, NULL, NULL),
  ('Bedding & Linens', 'Bedsheet (Single)', 15.00, NULL, NULL),
  ('Bedding & Linens', 'Pillow Case', 5.00, NULL, NULL),
  ('Bedding & Linens', 'Duvet Cover (Double)', 40.00, NULL, NULL),
  ('Bedding & Linens', 'Duvet Cover (Queen)', 50.00, NULL, NULL),
  ('Bedding & Linens', 'Duvet Cover (King)', 80.00, NULL, NULL),
  ('Bedding & Linens', 'Blanket (Student)', 15.00, NULL, NULL),
  ('Bedding & Linens', 'Blanket (Double)', 20.00, NULL, NULL),
  ('Bedding & Linens', 'Blanket (Queen)', 25.00, NULL, NULL),
  ('Bedding & Linens', 'Blanket (King)', 30.00, NULL, NULL),
  ('Bedding & Linens', 'Comforter (Student)', 20.00, NULL, NULL),
  ('Bedding & Linens', 'Comforter (Double)', 30.00, NULL, NULL),
  ('Bedding & Linens', 'Comforter (Queen)', 40.00, NULL, NULL),
  ('Bedding & Linens', 'Comforter (King)', 80.00, NULL, NULL),

  -- Towels & Household
  ('Towels & Household', 'Towel XL', 30.00, NULL, NULL),
  ('Towels & Household', 'Towel Large', 25.00, NULL, NULL),
  ('Towels & Household', 'Towel Medium', 20.00, NULL, NULL),
  ('Towels & Household', 'Towel Small', 10.00, NULL, NULL),
  ('Towels & Household', 'Face Towel', 2.00, NULL, NULL),
  ('Towels & Household', 'Table Cloth', 10.00, NULL, NULL),
  ('Towels & Household', 'Curtains (Short)', 10.00, NULL, NULL),
  ('Towels & Household', 'Curtains (Long)', 15.00, NULL, NULL),
  ('Towels & Household', 'Bathroom Mat', NULL, 10.00, 20.00),
  ('Towels & Household', 'Sofa Covers', NULL, 30.00, 50.00),
  ('Towels & Household', 'Car Seat Covers', NULL, 20.00, 30.00),

  -- Formal & Traditional Wear
  ('Formal & Traditional Wear', 'Suit', 30.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Smock (Sleeveless)', 30.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Smock (With Sleeves)', 35.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kaftan', 20.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kaftan (Long)', 25.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kaftan (3 Pieces)', 30.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kaftan (2 Piece)', 20.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Jarabier', 15.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kente Cloth (Men''s)', 40.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Uniform', 15.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Dress Lace', 20.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kaba Lace', 30.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Wedding Dress (Large)', 150.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Wedding Dress (Small)', NULL, 100.00, 120.00)
) AS v(category, item_name, unit_price, price_min, price_max)
WHERE NOT EXISTS (SELECT 1 FROM laundry_items);

-- ============================================================
-- inventory_items / inventory_transactions — laundry essentials stock
-- tracking, with a running quantity_on_hand and reorder_threshold for
-- low-stock alerting.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  unit VARCHAR(30) NOT NULL DEFAULT 'pieces',
  quantity_on_hand DECIMAL(10, 2) NOT NULL DEFAULT 0,
  reorder_threshold DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  change_qty DECIMAL(10, 2) NOT NULL,
  reason VARCHAR(255),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);

-- ============================================================
-- expenses — simple operating-expense ledger, entered by admins.
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  expense_date DATE NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- ============================================================
-- payments — a running ledger of what's been paid on each order.
-- There's no online payment gateway; customers pay in person (cash or
-- Mobile Money) as a deposit at drop-off, the balance later, or in full —
-- before or after pickup. Staff record each payment as it happens; the
-- running balance is always computed from this table, never stored
-- redundantly on the order itself.
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(30) NOT NULL
    CHECK (payment_method IN ('cash', 'mobile_money', 'bank_transfer', 'card', 'other')),
  payment_type VARCHAR(20) NOT NULL DEFAULT 'partial'
    CHECK (payment_type IN ('deposit', 'partial', 'balance', 'full', 'refund')),
  reference VARCHAR(100),
  notes VARCHAR(255),
  recorded_by INTEGER REFERENCES users(id),
  paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
-- Stops a Paystack webhook and the browser-redirect verify call from racing
-- to record the same transaction twice; NULL references (manual payments)
-- never conflict.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference_unique
  ON payments (reference) WHERE reference IS NOT NULL;

-- ============================================================
-- Seed data — display currencies (manual exchange rates vs. GHS)
-- ============================================================
INSERT INTO currencies (code, name, symbol, rate_to_ghs)
SELECT * FROM (VALUES
  ('GHS', 'Ghanaian Cedi', 'GHS', 1.0),
  ('USD', 'US Dollar', '$', 0.065),
  ('EUR', 'Euro', '€', 0.060),
  ('GBP', 'British Pound', '£', 0.051)
) AS v(code, name, symbol, rate_to_ghs)
WHERE NOT EXISTS (SELECT 1 FROM currencies);

-- ============================================================
-- Seed data — common laundry essentials (starting quantities are 0;
-- record real counts via Staff -> Inventory -> Adjust Stock)
-- ============================================================
INSERT INTO inventory_items (name, category, unit, quantity_on_hand, reorder_threshold)
SELECT * FROM (VALUES
  ('Liquid Detergent', 'Detergents & Chemicals', 'liters', 0, 10),
  ('Powder Detergent', 'Detergents & Chemicals', 'kg', 0, 10),
  ('Fabric Softener', 'Detergents & Chemicals', 'liters', 0, 5),
  ('Bleach', 'Detergents & Chemicals', 'liters', 0, 5),
  ('Stain Remover', 'Detergents & Chemicals', 'bottles', 0, 5),
  ('Starch Spray', 'Detergents & Chemicals', 'bottles', 0, 5),
  ('Poly Garment Bags', 'Packaging', 'pieces', 0, 100),
  ('Wire Hangers', 'Packaging', 'pieces', 0, 100),
  ('Laundry Claim Tags', 'Packaging', 'pieces', 0, 100)
) AS v(name, category, unit, quantity_on_hand, reorder_threshold)
WHERE NOT EXISTS (SELECT 1 FROM inventory_items);

COMMIT;
