require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const getPgConfig = require('../config/pgConfig');

const BASELINE_VERSION = 13;
const BASELINE_NAME = 'baseline_init.sql';
const MIGRATIONS = [
  { version: 14, filename: 'migrate_v14_balance_reminders.sql' },
  { version: 15, filename: 'migrate_v15_invoices.sql' },
  { version: 16, filename: 'migrate_v16_branches.sql' },
  { version: 17, filename: 'migrate_v17_settings.sql' },
  { version: 18, filename: 'migrate_v18_late_fee_payments.sql' },
];
const LOCK_NAMESPACE = 187003;
const LOCK_ID = 1;

const client = new Client(getPgConfig());

function checksum(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

function withoutTransaction(sql) {
  return sql
    .replace(/(^|\r?\n)\s*BEGIN;\s*/i, '$1')
    .replace(/\r?\n\s*COMMIT;\s*$/i, '');
}

function readSql(filename) {
  return fs.readFileSync(path.join(__dirname, filename), 'utf8');
}

function parseBaselineArg() {
  const arg = process.argv.slice(2).find((value) => value.startsWith('--baseline='));
  if (!arg) return null;
  const version = Number(arg.slice('--baseline='.length));
  if (![13, 14, 15, 16, 17].includes(version)) {
    throw new Error('--baseline must be one of 13, 14, 15, 16, or 17.');
  }
  return version;
}

async function assertBaselineShape(version) {
  const result = await client.query(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'"
  );
  const available = new Set(result.rows.map((row) => row.table_name + '.' + row.column_name));
  const required = [
    'users.id', 'users.date_of_birth', 'orders.id', 'orders.storage_location',
    'payments.order_id', 'payments.reference', 'laundry_items.id', 'inventory_items.id',
  ];
  if (version >= 14) required.push('orders.last_balance_reminder_sent_at');
  if (version >= 15) required.push('invoices.id');
  if (version >= 16) required.push('invoices.branch_id', 'branches.id', 'orders.branch_id', 'daily_capacity.branch_id');
  if (version >= 17) {
    required.push(
      'users.sms_order_updates', 'users.email_order_updates', 'users.pickup_reminders',
      'users.low_stock_alerts', 'users.invoice_notifications',
      'users.birthday_discount_enabled', 'users.auto_generate_invoice'
    );
  }
  const missing = required.filter((key) => !available.has(key));
  if (missing.length) {
    throw new Error(
      'The database does not match the requested v' + version + ' baseline. Missing: ' + missing.join(', ') +
      '. Do not baseline this database; migrate it from its actual starting schema first.'
    );
  }
}

async function recordBaseline(version, initSql) {
  await assertBaselineShape(version);
  await client.query('BEGIN');
  try {
    await client.query(
      'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
      [BASELINE_VERSION, BASELINE_NAME, checksum(initSql)]
    );
    for (const migration of MIGRATIONS.filter((item) => item.version <= version)) {
      const sql = readSql(migration.filename);
      await client.query(
        'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
        [migration.version, migration.filename, checksum(sql)]
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function applyMigration(migration) {
  const sql = readSql(migration.filename);
  const expectedChecksum = checksum(sql);
  const existing = await client.query(
    'SELECT filename, checksum FROM schema_migrations WHERE version = $1',
    [migration.version]
  );
  if (existing.rows.length) {
    const row = existing.rows[0];
    if (row.filename !== migration.filename || row.checksum !== expectedChecksum) {
      throw new Error(
        'Migration v' + migration.version + ' differs from its recorded checksum. Restore the original file or create a new migration.'
      );
    }
    return false;
  }

  await client.query('BEGIN');
  try {
    await client.query(withoutTransaction(sql));
    await client.query(
      'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
      [migration.version, migration.filename, expectedChecksum]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
  return true;
}

async function run() {
  let locked = false;
  try {
    await client.connect();
    await client.query('SELECT pg_advisory_lock($1, $2)', [LOCK_NAMESPACE, LOCK_ID]);
    locked = true;
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (' +
      'version INTEGER PRIMARY KEY, filename TEXT NOT NULL, checksum CHAR(64) NOT NULL, ' +
      'applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP)'
    );

    const initSql = readSql('init.sql');
    const history = await client.query('SELECT version FROM schema_migrations ORDER BY version');
    if (history.rows.length === 0) {
      const existingSchema = await client.query("SELECT to_regclass('public.users') AS users_table");
      const usersTableExists = Boolean(existingSchema.rows[0].users_table);
      const requestedBaseline = parseBaselineArg();
      if (usersTableExists) {
        if (requestedBaseline === null) {
          throw new Error(
            'This database already has an application schema but no migration history. ' +
            'After verifying its schema, rerun with --baseline=13, --baseline=14, --baseline=15, --baseline=16, or --baseline=17.'
          );
        }
        await recordBaseline(requestedBaseline, initSql);
        console.log('Recorded legacy database baseline v' + requestedBaseline + '.');
      } else {
        if (requestedBaseline !== null) {
          throw new Error('Cannot baseline an empty database. Omit --baseline to initialize it.');
        }
        await client.query('BEGIN');
        try {
          await client.query(withoutTransaction(initSql));
          await client.query(
            'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
            [BASELINE_VERSION, BASELINE_NAME, checksum(initSql)]
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
        console.log('Initialized schema baseline v13.');
      }
    }

    const baseline = await client.query(
      'SELECT checksum FROM schema_migrations WHERE version = $1 AND filename = $2',
      [BASELINE_VERSION, BASELINE_NAME]
    );
    if (baseline.rows.length !== 1 || baseline.rows[0].checksum !== checksum(initSql)) {
      throw new Error('Migration history is missing or has an invalid init.sql baseline record.');
    }

    for (const migration of MIGRATIONS) {
      if (await applyMigration(migration)) {
        console.log('Applied v' + migration.version + ': ' + migration.filename);
      } else {
        console.log('Already applied v' + migration.version + ': ' + migration.filename);
      }
    }
    console.log('Database is up to date.');
  } catch (error) {
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_NAMESPACE, LOCK_ID]);
      } catch {}
    }
    try {
      await client.end();
    } catch {}
  }
}

run();
