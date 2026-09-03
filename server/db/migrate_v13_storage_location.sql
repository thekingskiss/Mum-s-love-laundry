-- Adds physical storage-location tracking so staff can record which shelf/
-- area an order's laundry is placed in once it's ready for pickup.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS storage_location VARCHAR(20)
  CHECK (storage_location IN ('Shelf 1', 'Area 2', 'Area 3', 'Area 4'));
