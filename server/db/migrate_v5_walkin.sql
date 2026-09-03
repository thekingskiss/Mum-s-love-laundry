-- Mum's Love Laundry — v5 migration: walk-in drop-off model.
-- Removes pickup/delivery from the order lifecycle, roles, and zones —
-- customers now bring laundry in and collect it in person.

BEGIN;

-- ============================================================
-- orders — rename pickup_date to drop_off_date, drop per-order zone,
-- collapse the old 11-state lifecycle into a 7-state walk-in one.
-- ============================================================
ALTER TABLE orders RENAME COLUMN pickup_date TO drop_off_date;

UPDATE orders SET status = 'order_received' WHERE status IN ('pickup_scheduled', 'pickup_completed');
UPDATE orders SET status = 'ready_for_pickup' WHERE status IN ('ready_for_delivery', 'out_for_delivery');
UPDATE orders SET status = 'cancelled' WHERE status = 'delivery_failed';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN (
    'order_received', 'in_washing', 'ironing_process', 'quality_check',
    'ready_for_pickup', 'completed', 'cancelled'
  ));

ALTER TABLE orders DROP COLUMN IF EXISTS location_zone;

-- ============================================================
-- users.role — drop delivery_staff (no deliveries to make)
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'laundry_staff' WHERE role = 'delivery_staff';
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('customer', 'laundry_staff', 'administrator', 'super_admin'));

-- ============================================================
-- service_zones — no longer gate pickup/delivery availability;
-- kept only as an informational "where our customers are from" list.
-- ============================================================
ALTER TABLE service_zones DROP COLUMN IF EXISTS allows_pickup;
ALTER TABLE service_zones DROP COLUMN IF EXISTS allows_delivery;

COMMIT;
