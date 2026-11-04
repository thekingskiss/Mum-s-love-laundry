-- Mum's Love Laundry - v18 migration: record storage-fee collections.
--
-- Late fees are charged on top of total_price, so the ledger needs its own
-- payment type for them. 'late_fee' rows count as money collected, but they
-- never reduce an order's balance_due.

BEGIN;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_type_check
  CHECK (payment_type IN ('deposit', 'partial', 'balance', 'full', 'refund', 'late_fee'));

COMMIT;
