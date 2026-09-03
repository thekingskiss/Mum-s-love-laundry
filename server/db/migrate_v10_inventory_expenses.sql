-- Mum's Love Laundry — v10 migration: inventory tracking for laundry
-- essentials (with low-stock alerting) and a simple expense ledger, both
-- feeding into extended sales analytics (daily/monthly/yearly + net).

BEGIN;

-- ============================================================
-- inventory_items — laundry essentials (detergent, poly bags, hangers,
-- etc.) with a running quantity_on_hand and a reorder_threshold that
-- flags an item as low-stock once quantity_on_hand drops to or below it.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'General',
  unit VARCHAR(30) NOT NULL DEFAULT 'pieces',
  quantity_on_hand DECIMAL(10, 2) NOT NULL DEFAULT 0,
  reorder_threshold DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- inventory_transactions — audit trail of every stock change (restock,
-- usage, wastage/damage, correction). quantity_on_hand on the parent row
-- is a running total kept in sync whenever a transaction is recorded.
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  change_qty DECIMAL(10, 2) NOT NULL,
  reason VARCHAR(255),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);

-- ============================================================
-- expenses — simple operating-expense ledger (utilities, supplies,
-- wages, rent, maintenance, etc.), entered by admins.
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  expense_date DATE NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- Seed a starter list of common laundry essentials. Quantities start at 0
-- since we don't know actual current stock — the admin records real counts
-- via Staff -> Inventory -> Adjust Stock. Thresholds are reasonable defaults.
INSERT INTO inventory_items (name, category, unit, quantity_on_hand, reorder_threshold)
SELECT * FROM (VALUES
  ('Liquid Detergent', 'Detergents & Chemicals', 'liters', 0, 10),
  ('Powder Detergent', 'Detergents & Chemicals', 'kg', 0, 10),
  ('Fabric Softener', 'Detergents & Chemicals', 'liters', 0, 5),
  ('Bleach', 'Detergents & Chemicals', 'liters', 0, 5),
  ('Stain Remover', 'Detergents & Chemicals', 'bottles', 0, 5),
  ('Starch Spray', 'Detergents & Chemicals', 'bottles', 0, 5),
  ('Poly Garment Bags', 'Packaging', 'pieces', 0, 100),
  ('Wire Hangers', 'Packaging', 'pieces', 0, 100),
  ('Laundry Claim Tags', 'Packaging', 'pieces', 0, 100)
) AS v(name, category, unit, quantity_on_hand, reorder_threshold)
WHERE NOT EXISTS (SELECT 1 FROM inventory_items);

COMMIT;
