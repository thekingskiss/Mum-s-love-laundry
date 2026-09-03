-- Mum's Love Laundry — v15 migration: invoices.
--
-- An invoice is a frozen bill layered on top of an order — it snapshots the
-- order's line items at generation time (same philosophy as order_items
-- snapshotting laundry_items) and lets staff add ad hoc discount/fee/tax
-- lines on top. It does NOT duplicate the payments ledger: balance/status
-- are always computed live from `payments` (still keyed by order_id, same
-- as today), exactly the way order balances already work — see
-- NET_PAID_EXPR in paymentController.js.

BEGIN;

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 101;

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(20) UNIQUE NOT NULL,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  customer_email VARCHAR(255),
  due_date DATE NOT NULL,
  notes TEXT,
  subtotal DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  public_token VARCHAR(64) NOT NULL,
  voided_at TIMESTAMP,
  last_reminder_sent_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_public_token ON invoices(public_token);
-- Only one *active* invoice per order at a time — regenerating requires
-- voiding the old one first, so payment-to-invoice balance math never has
-- to guess which of several invoices a payment belongs to.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_order_active ON invoices(order_id) WHERE voided_at IS NULL;

CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  kind VARCHAR(20) NOT NULL DEFAULT 'item' CHECK (kind IN ('item', 'discount', 'fee', 'tax')),
  description VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_amount DECIMAL(10, 2) NOT NULL,
  line_total DECIMAL(10, 2) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Append-only audit trail + staff message thread for an invoice — modeled
-- directly on order_events.
CREATE TABLE IF NOT EXISTS invoice_activity (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('created', 'edited', 'sent', 'reminder_sent', 'voided', 'message')),
  actor_id INTEGER REFERENCES users(id),
  body TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_activity_invoice_id ON invoice_activity(invoice_id);

COMMIT;
