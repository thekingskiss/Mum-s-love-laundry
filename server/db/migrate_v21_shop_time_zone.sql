-- Mum's Love Laundry - v21 migration: run this database on Ghana time.
--
-- Analytics, the reminder jobs, and every "today" in SQL use the database's own
-- date. A server configured for another zone is hours out of step with the shop,
-- so the zone is set here, on this database only: other databases on the same
-- server keep theirs.
--
-- Columns without a time zone hold the local time of whichever zone wrote them,
-- so existing values are converted too. AT TIME ZONE uses the offset in force on
-- each value's own date, so daylight saving in the old zone is handled. On a
-- database already on UTC this changes no values, since Ghana is UTC all year.
--
-- Left alone on purpose:
--   users.reset_token_expires_at  short-lived, and only ever compared by the app
--   services.promo_starts_at/ends_at  dates an admin typed, not clock readings

BEGIN;

DO $$
DECLARE
  old_zone CONSTANT text := current_setting('TimeZone');
  shop_zone CONSTANT text := 'Africa/Accra';
  target text;
  table_name text;
  column_name text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'branches.created_at',
    'contact_messages.created_at',
    'contact_messages.read_at',
    'expenses.created_at',
    'garment_tags.created_at',
    'inventory_items.created_at',
    'inventory_items.updated_at',
    'inventory_transactions.created_at',
    'invoice_activity.created_at',
    'invoices.created_at',
    'invoices.last_reminder_sent_at',
    'invoices.voided_at',
    'laundry_items.created_at',
    'notifications.created_at',
    'notifications.read_at',
    'notifications.sent_at',
    'order_events.created_at',
    'orders.created_at',
    'orders.last_balance_reminder_sent_at',
    'orders.last_reminder_sent_at',
    'payments.created_at',
    'payments.paid_at',
    'service_pricing_history.changed_at',
    'service_zones.created_at',
    'users.created_at'
  ]
  LOOP
    table_name := split_part(target, '.', 1);
    column_name := split_part(target, '.', 2);
    EXECUTE format(
      'UPDATE %1$I SET %2$I = %2$I AT TIME ZONE %3$L AT TIME ZONE %4$L WHERE %2$I IS NOT NULL',
      table_name, column_name, old_zone, shop_zone
    );
  END LOOP;

  EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), shop_zone);
END $$;

COMMIT;
