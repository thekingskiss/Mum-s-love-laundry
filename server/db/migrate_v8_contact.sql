-- Mum's Love Laundry — v8 migration: contact form submissions.
-- Gives the public Contact page a real, structured support channel that
-- staff can review even when SMTP isn't configured (email is best-effort
-- on top of this, not the only record of the message).

BEGIN;

CREATE TABLE IF NOT EXISTS contact_messages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);

COMMIT;
