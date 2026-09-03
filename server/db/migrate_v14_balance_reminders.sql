-- Mum's Love Laundry — v14 migration: balance-due reminders.
--
-- Pickup reminders (last_reminder_sent_at) nudge customers to collect ready
-- laundry; this is the payment-side equivalent — a separate guard column so
-- an order with laundry ready AND a balance owed gets both reminders
-- independently, on their own schedules, without one suppressing the other.

BEGIN;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_balance_reminder_sent_at TIMESTAMP;

COMMIT;
