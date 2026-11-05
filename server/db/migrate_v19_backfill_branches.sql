-- Mum's Love Laundry - v19 migration: give every inventory item and expense a branch.
--
-- v16 added branch_id to these tables but never filled it in, so rows from
-- before v16 (including the starter inventory) were only visible to a
-- super_admin. They go to the first branch, the same rule v16 used for orders.
-- The app already requires a branch when creating these rows, so the column
-- can be required from here on.

BEGIN;

UPDATE inventory_items SET branch_id = (SELECT id FROM branches ORDER BY id LIMIT 1) WHERE branch_id IS NULL;
UPDATE expenses SET branch_id = (SELECT id FROM branches ORDER BY id LIMIT 1) WHERE branch_id IS NULL;

ALTER TABLE inventory_items ALTER COLUMN branch_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN branch_id SET NOT NULL;

COMMIT;
