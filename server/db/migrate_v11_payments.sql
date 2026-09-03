-- Mum's Love Laundry — v11 migration: payment ledger.
--
-- There's no online payment gateway — customers pay in person (cash or
-- Mobile Money) either as a deposit at drop-off, the balance later, or the
-- full amount whenever it's convenient (before or after pickup). Staff
-- record each payment as it happens; the running balance is always
-- computed from the sum of a order's payments, never stored redundantly.

BEGIN;

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

COMMIT;
