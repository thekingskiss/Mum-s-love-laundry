-- Mum's Love Laundry — v17 migration: account notification and invoice preferences.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sms_order_updates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_order_updates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pickup_reminders BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS low_stock_alerts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoice_notifications BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS birthday_discount_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_generate_invoice BOOLEAN NOT NULL DEFAULT false;

COMMIT;
