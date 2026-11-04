require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const getPgConfig = require('./config/pgConfig');

const sqlPath = path.join(__dirname, 'db', 'migrate_v17_settings.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new Client(getPgConfig());

async function run() {
  try {
    await client.connect();
    await client.query(sql);
    console.log('Migration v17 applied successfully.');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
