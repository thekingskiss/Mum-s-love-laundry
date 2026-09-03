-- Mum's Love Laundry — v6 migration: staff-assigned pickup date.
-- Customers drop laundry off (drop_off_date); staff then assign a
-- pickup_date once the order is received, telling the customer when
-- it'll be ready to collect.

BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_date DATE;

COMMIT;
