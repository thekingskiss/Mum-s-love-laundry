-- Mum's Love Laundry — migration from v2.0 schema to v3.0 (staff roles,
-- expanded order lifecycle, zones/pricing/capacity/garments/notifications).
-- Safe to run against the live v2.0 database; preserves existing data.
-- Run with: psql -U <DB_USER> -h 127.0.0.1 -d mums_love_laundry -f server/db/migrate_v3.sql

BEGIN;

-- ============================================================
-- users.role — widen the allowed set, map legacy 'admin' -> 'administrator'
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'administrator' WHERE role = 'admin';
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'laundry_staff', 'delivery_staff', 'administrator', 'super_admin'));

-- ============================================================
-- service_zones
-- ============================================================
CREATE TABLE IF NOT EXISTS service_zones (
  id SERIAL PRIMARY KEY,
  zone_name VARCHAR(100) UNIQUE NOT NULL,
  allows_pickup BOOLEAN NOT NULL DEFAULT true,
  allows_delivery BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO service_zones (zone_name)
SELECT * FROM (VALUES
  ('Koforidua'), ('Akropong'), ('Nkawkaw'), ('Mpraeso'),
  ('Suhum'), ('Akim Oda'), ('Nsawam'), ('New Tafo'), ('Eastern Region')
) AS v(zone_name)
WHERE NOT EXISTS (SELECT 1 FROM service_zones);

-- ============================================================
-- services — pricing columns
-- ============================================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS pricing_unit VARCHAR(20) NOT NULL DEFAULT 'flat';
ALTER TABLE services DROP CONSTRAINT IF EXISTS services_pricing_unit_check;
ALTER TABLE services ADD CONSTRAINT services_pricing_unit_check CHECK (pricing_unit IN ('flat', 'per_kg'));
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_per_kg DECIMAL(10, 2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS promo_price DECIMAL(10, 2);
ALTER TABLE services ADD COLUMN IF NOT EXISTS promo_starts_at TIMESTAMP;
ALTER TABLE services ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS service_pricing_history (
  id SERIAL PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  changed_by INTEGER REFERENCES users(id),
  old_base_price DECIMAL(10, 2),
  new_base_price DECIMAL(10, 2),
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- daily_capacity
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_capacity (
  id SERIAL PRIMARY KEY,
  capacity_date DATE UNIQUE NOT NULL,
  max_orders INTEGER NOT NULL DEFAULT 50,
  current_orders INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- orders — new columns, backfill, then widen status
-- ============================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_zone VARCHAR(100);
UPDATE orders o SET location_zone = u.location_zone
  FROM users u WHERE u.id = o.user_id AND o.location_zone IS NULL;
ALTER TABLE orders ALTER COLUMN location_zone SET NOT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_kg DECIMAL(6, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_staff_id INTEGER REFERENCES users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;

UPDATE orders SET status = 'order_received' WHERE status = 'pending';
UPDATE orders SET status = 'in_washing' WHERE status = 'washing';
UPDATE orders SET status = 'ironing_process' WHERE status = 'ironing';

ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'order_received';
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'order_received', 'pickup_scheduled', 'pickup_completed', 'in_washing',
    'ironing_process', 'quality_check', 'ready_for_delivery', 'out_for_delivery',
    'completed', 'delivery_failed', 'cancelled'
  ));

CREATE INDEX IF NOT EXISTS idx_orders_assigned_staff ON orders(assigned_staff_id);

-- ============================================================
-- order_events
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

-- Backfill one synthetic "created" event per existing order so history isn't empty.
INSERT INTO order_events (order_id, from_status, to_status, created_at)
SELECT id, NULL, status, created_at FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id);

-- ============================================================
-- garment_tags
-- ============================================================
CREATE TABLE IF NOT EXISTS garment_tags (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tag_code VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255),
  damage_notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'tagged' CHECK (status IN ('tagged', 'in_process', 'ready', 'delivered', 'damaged')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_garment_tags_order_id ON garment_tags(order_id);

-- ============================================================
-- notifications
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

COMMIT;
