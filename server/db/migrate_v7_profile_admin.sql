-- Mum's Love Laundry — v7 migration: customer profile settings
-- (username, avatar, language, currency preference) + supporting
-- currencies table for display-only price conversion.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_currency VARCHAR(10) NOT NULL DEFAULT 'GHS';
ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) NOT NULL DEFAULT 'light'
  CHECK (theme_preference IN ('light', 'dark'));

-- Backfill a unique username for existing users from their email local-part.
UPDATE users SET username = split_part(email, '@', 1) || '_' || id WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- ============================================================
-- currencies — admin-configurable, manual exchange rates relative
-- to GHS (the currency all orders are actually priced/stored in).
-- Display-only: does not change what's charged, only how prices render.
-- ============================================================
CREATE TABLE IF NOT EXISTS currencies (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  symbol VARCHAR(10) NOT NULL,
  rate_to_ghs DECIMAL(12, 6) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO currencies (code, name, symbol, rate_to_ghs)
SELECT * FROM (VALUES
  ('GHS', 'Ghanaian Cedi', 'GHS', 1.0),
  ('USD', 'US Dollar', '$', 0.065),
  ('EUR', 'Euro', '€', 0.060),
  ('GBP', 'British Pound', '£', 0.051)
) AS v(code, name, symbol, rate_to_ghs)
WHERE NOT EXISTS (SELECT 1 FROM currencies);

COMMIT;
