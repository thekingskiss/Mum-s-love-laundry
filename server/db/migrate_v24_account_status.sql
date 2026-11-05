-- Mum's Love Laundry - v24 migration: account status and password-change tracking.
--
-- is_active lets an administrator switch an account off (a former employee, say)
-- without deleting the orders, payments and audit entries that point at it.
-- The API checks it on every request, so switching an account off takes effect
-- at once instead of when the person's 7-day login token expires.
--
-- password_changed_at lets the API refuse tokens issued before the last password
-- change or reset, so a leaked or stolen login stops working once the real owner
-- changes their password.

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

COMMIT;
