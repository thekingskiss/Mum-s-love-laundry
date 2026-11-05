-- Mum's Love Laundry - v22 migration: more colour themes.
--
-- theme_preference was limited to 'light' and 'dark'. It now also accepts the
-- neutral, elevated-dark and high-contrast themes, plus 'system', which follows
-- the device's own light/dark and contrast settings. 'contrast-dark' needs more
-- than the old 10 characters, so the column is widened too.
--
-- The old check constraint was declared inline, so its name was generated; it
-- is found by definition rather than assumed.

BEGIN;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'users'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%theme_preference%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE users ALTER COLUMN theme_preference TYPE VARCHAR(20);

ALTER TABLE users ADD CONSTRAINT users_theme_preference_check
  CHECK (theme_preference IN (
    'light', 'gray', 'dark', 'graphite', 'midnight', 'contrast', 'contrast-dark', 'system'
  ));

COMMIT;
