-- Mum's Love Laundry — v4 migration: itemized per-garment pricing,
-- replacing the flat 4-service pricing model with the shop's real price list.

BEGIN;

-- ============================================================
-- laundry_items — the real, physical price list
-- ============================================================
CREATE TABLE IF NOT EXISTS laundry_items (
  id SERIAL PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  item_name VARCHAR(150) UNIQUE NOT NULL,
  unit_price DECIMAL(10, 2),
  price_min DECIMAL(10, 2),
  price_max DECIMAL(10, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (unit_price IS NOT NULL AND price_min IS NULL AND price_max IS NULL) OR
    (unit_price IS NULL AND price_min IS NOT NULL AND price_max IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_laundry_items_category ON laundry_items(category);

-- ============================================================
-- order_items — a cart of items per order, snapshotted at order time
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  laundry_item_id INTEGER REFERENCES laundry_items(id),
  item_name VARCHAR(150) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  is_price_estimated BOOLEAN NOT NULL DEFAULT false,
  line_total DECIMAL(10, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Orders no longer require a single service_id — pricing now comes from
-- the order_items cart. Column kept (nullable) for backward compatibility.
ALTER TABLE orders ALTER COLUMN service_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN estimated_kg DROP NOT NULL;

-- ============================================================
-- Seed the real price list
-- ============================================================
INSERT INTO laundry_items (category, item_name, unit_price, price_min, price_max)
SELECT * FROM (VALUES
  -- Everyday Wear
  ('Everyday Wear', 'Shirt', 10.00, NULL, NULL),
  ('Everyday Wear', 'T-shirt', 8.00, NULL, NULL),
  ('Everyday Wear', 'Polo Shirt', 8.00, NULL, NULL),
  ('Everyday Wear', 'Jeans', 15.00, NULL, NULL),
  ('Everyday Wear', 'Trousers', 10.00, NULL, NULL),
  ('Everyday Wear', 'Shorts', 8.00, NULL, NULL),
  ('Everyday Wear', 'Jacket', 20.00, NULL, NULL),
  ('Everyday Wear', 'Hoodie', 15.00, NULL, NULL),
  ('Everyday Wear', 'Sweater', 15.00, NULL, NULL),
  ('Everyday Wear', 'Underwear', 3.00, NULL, NULL),
  ('Everyday Wear', 'Blouse', 5.00, NULL, NULL),
  ('Everyday Wear', 'Tunic', 20.00, NULL, NULL),
  ('Everyday Wear', 'Leggings', 5.00, NULL, NULL),
  ('Everyday Wear', 'African Print (Top & Skirt)', 15.00, NULL, NULL),
  ('Everyday Wear', 'Pajamas', 10.00, NULL, NULL),
  ('Everyday Wear', 'Nighties', 10.00, NULL, NULL),
  ('Everyday Wear', 'Singlet', 3.00, NULL, NULL),
  ('Everyday Wear', 'Track Suit', 15.00, NULL, NULL),
  ('Everyday Wear', 'Office Dress (Female)', 10.00, NULL, NULL),
  ('Everyday Wear', 'Men Cloth', 35.00, NULL, NULL),
  ('Everyday Wear', 'Sneakers', 25.00, NULL, NULL),

  -- Bedding & Linens
  ('Bedding & Linens', 'Bedsheet with Pillowcase', 25.00, NULL, NULL),
  ('Bedding & Linens', 'Bedsheet without Pillowcase', 20.00, NULL, NULL),
  ('Bedding & Linens', 'Bedsheet (King)', 30.00, NULL, NULL),
  ('Bedding & Linens', 'Bedsheet (Queen)', 25.00, NULL, NULL),
  ('Bedding & Linens', 'Bedsheet (Double)', 20.00, NULL, NULL),
  ('Bedding & Linens', 'Bedsheet (Single)', 15.00, NULL, NULL),
  ('Bedding & Linens', 'Pillow Case', 5.00, NULL, NULL),
  ('Bedding & Linens', 'Duvet Cover (Double)', 40.00, NULL, NULL),
  ('Bedding & Linens', 'Duvet Cover (Queen)', 50.00, NULL, NULL),
  ('Bedding & Linens', 'Duvet Cover (King)', 80.00, NULL, NULL),
  ('Bedding & Linens', 'Blanket (Student)', 15.00, NULL, NULL),
  ('Bedding & Linens', 'Blanket (Double)', 20.00, NULL, NULL),
  ('Bedding & Linens', 'Blanket (Queen)', 25.00, NULL, NULL),
  ('Bedding & Linens', 'Blanket (King)', 30.00, NULL, NULL),
  ('Bedding & Linens', 'Comforter (Student)', 20.00, NULL, NULL),
  ('Bedding & Linens', 'Comforter (Double)', 30.00, NULL, NULL),
  ('Bedding & Linens', 'Comforter (Queen)', 40.00, NULL, NULL),
  ('Bedding & Linens', 'Comforter (King)', 80.00, NULL, NULL),

  -- Towels & Household
  ('Towels & Household', 'Towel XL', 30.00, NULL, NULL),
  ('Towels & Household', 'Towel Large', 25.00, NULL, NULL),
  ('Towels & Household', 'Towel Medium', 20.00, NULL, NULL),
  ('Towels & Household', 'Towel Small', 10.00, NULL, NULL),
  ('Towels & Household', 'Face Towel', 2.00, NULL, NULL),
  ('Towels & Household', 'Table Cloth', 10.00, NULL, NULL),
  ('Towels & Household', 'Curtains (Short)', 10.00, NULL, NULL),
  ('Towels & Household', 'Curtains (Long)', 15.00, NULL, NULL),
  ('Towels & Household', 'Bathroom Mat', NULL, 10.00, 20.00),
  ('Towels & Household', 'Sofa Covers', NULL, 30.00, 50.00),
  ('Towels & Household', 'Car Seat Covers', NULL, 20.00, 30.00),

  -- Formal & Traditional Wear
  ('Formal & Traditional Wear', 'Suit', 30.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Smock (Sleeveless)', 30.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Smock (With Sleeves)', 35.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kaftan', 20.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kaftan (Long)', 25.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kaftan (3 Pieces)', 30.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kaftan (2 Piece)', 20.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Jarabier', 15.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kente Cloth (Men''s)', 40.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Uniform', 15.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Dress Lace', 20.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Kaba Lace', 30.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Wedding Dress (Large)', 150.00, NULL, NULL),
  ('Formal & Traditional Wear', 'Wedding Dress (Small)', NULL, 100.00, 120.00)
) AS v(category, item_name, unit_price, price_min, price_max)
WHERE NOT EXISTS (SELECT 1 FROM laundry_items);

COMMIT;
