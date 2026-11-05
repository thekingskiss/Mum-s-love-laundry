-- Mum's Love Laundry - v20 migration: audit log.
--
-- A record of who changed what for sensitive actions (staff accounts, branches,
-- pricing, voided invoices, deleted expenses), readable by a super_admin.
-- actor_email is a snapshot, so an entry still names its author if the account
-- is later changed or removed.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255) NOT NULL,
  actor_role VARCHAR(20) NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50),
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

COMMIT;
