import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_DB, PASSWORD, USERS, serverEnv } from './env.js';

// Builds a fresh database for the run: drop and recreate it, apply every
// migration, then add one account per role. The server's own dependencies
// (pg, bcryptjs, dotenv) are reused so nothing is installed twice.
//
// This runs BEFORE Playwright (see the "test" script in package.json), not as a
// Playwright globalSetup: Playwright starts its web servers first, and the API's
// health check needs this database to exist.
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server');
const serverRequire = createRequire(path.join(serverDir, 'package.json'));

async function prepareDatabase() {
  // The one safety rule: this script drops a database, so it may only ever
  // drop one that is clearly meant for tests.
  if (!/_e2e$/.test(E2E_DB)) throw new Error(`Refusing to reset "${E2E_DB}": a test database name must end in _e2e.`);

  serverRequire('dotenv').config({ path: path.join(serverDir, '.env') });
  const { Client } = serverRequire('pg');
  const bcrypt = serverRequire('bcryptjs');

  const connection = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  };

  // 1. A clean database.
  const admin = new Client({ ...connection, database: 'postgres' });
  await admin.connect();
  try {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [E2E_DB]);
    await admin.query(`DROP DATABASE IF EXISTS "${E2E_DB}"`);
    await admin.query(`CREATE DATABASE "${E2E_DB}"`);
  } finally {
    await admin.end();
  }

  // 2. The real schema, through the real migration runner.
  execFileSync(process.execPath, ['db/migrate.js'], {
    cwd: serverDir,
    env: { ...process.env, ...serverEnv() },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  // 3. One account per role.
  const db = new Client({ ...connection, database: E2E_DB });
  await db.connect();
  try {
    const branch = (await db.query('SELECT id FROM branches ORDER BY id LIMIT 1')).rows[0];
    const zone = (await db.query('SELECT zone_name FROM service_zones ORDER BY id LIMIT 1')).rows[0];
    if (!branch || !zone) throw new Error('The migrations did not create a branch and a service zone.');

    const hash = await bcrypt.hash(PASSWORD, 4); // low cost: these accounts only exist for the run
    for (const user of Object.values(USERS)) {
      const username = user.email.split('@')[0];
      const branchId = user.role === 'laundry_staff' || user.role === 'administrator' ? branch.id : null;
      await db.query(
        `INSERT INTO users (email, password_hash, username, full_name, phone_number, location_zone, role, branch_id)
         VALUES ($1, $2, $3, $4, '+233200000000', $5, $6, $7)`,
        [user.email, hash, username, user.name, zone.zone_name, user.role, branchId]
      );
    }
  } finally {
    await db.end();
  }
}

prepareDatabase()
  .then(() => console.log(`Test database "${E2E_DB}" is ready.`))
  .catch((error) => {
    console.error(`Could not prepare the test database: ${error.message}`);
    process.exit(1);
  });
