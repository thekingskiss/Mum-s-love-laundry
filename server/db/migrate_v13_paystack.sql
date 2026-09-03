-- Mum's Love Laundry — v13 migration: Paystack online payments.
-- A partial unique index on payments.reference stops a Paystack webhook and
-- the browser-redirect verify call (both racing to confirm the same
-- transaction) from crediting an order twice. Existing manually-recorded
-- payments with reference = NULL are unaffected — Postgres never treats
-- NULLs as equal, so they don't participate in the uniqueness check.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference_unique
  ON payments (reference) WHERE reference IS NOT NULL;

COMMIT;
