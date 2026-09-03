-- Mum's Love Laundry — v16 migration: multi-branch support.
--
-- Every existing row gets backfilled onto one "Main Branch" so nothing
-- currently running breaks. laundry_staff/administrator are scoped to a
-- branch going forward; super_admin keeps branch_id = NULL, meaning
-- "all branches" (enforced in application code, not the schema).
-- Customers (role = 'customer') are never branch-bound — they pick a
-- branch per order, not per account.

BEGIN;

CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255),
  phone VARCHAR(50),
  email VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO branches (name)
  SELECT 'Main Branch' WHERE NOT EXISTS (SELECT 1 FROM branches);

ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE daily_capacity ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES branches(id);

UPDATE users SET branch_id = (SELECT id FROM branches ORDER BY id LIMIT 1)
  WHERE role IN ('laundry_staff', 'administrator') AND branch_id IS NULL;
UPDATE orders SET branch_id = (SELECT id FROM branches ORDER BY id LIMIT 1) WHERE branch_id IS NULL;
UPDATE daily_capacity SET branch_id = (SELECT id FROM branches ORDER BY id LIMIT 1) WHERE branch_id IS NULL;
UPDATE invoices i SET branch_id = o.branch_id FROM orders o WHERE o.id = i.order_id AND i.branch_id IS NULL;

ALTER TABLE orders ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE daily_capacity ALTER COLUMN branch_id SET NOT NULL;

-- capacity_date used to be globally unique; now it's unique per branch, so
-- two branches can each have their own cap for the same date.
ALTER TABLE daily_capacity DROP CONSTRAINT IF EXISTS daily_capacity_capacity_date_key;
ALTER TABLE daily_capacity ADD CONSTRAINT daily_capacity_date_branch_unique UNIQUE (capacity_date, branch_id);

CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_branch_id ON inventory_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_invoices_branch_id ON invoices(branch_id);

COMMIT;
