-- Mum's Love Laundry — v9 migration: late-pickup fee policy support.
-- Fees themselves are computed live from order_events timestamps (no fee
-- column needed) — this just tracks the last reminder send so the daily
-- pickup-reminder job doesn't email/SMS a customer twice in one day.

BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMP;

COMMIT;
