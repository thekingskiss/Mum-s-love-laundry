-- Mum's Love Laundry — v25 migration: attachments on admin messages.
-- Staff can now send audio, video, images and documents with a message. Each
-- notification keeps a small JSON list of the files that went with it:
--   [{ "kind": "image|audio|video|document", "name": "...", "mime": "...", "size": 123, "url": "..." }]

BEGIN;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
