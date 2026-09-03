-- Mum's Love Laundry — v12 migration: birthday capture, birthday
-- greetings, and an automatic 5% birthday discount on orders.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_birthday_greeted_year INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

COMMIT;
