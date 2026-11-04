const { Pool } = require('pg');
const getPgConfig = require('./pgConfig');

const pool = new Pool(getPgConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(1);
});

module.exports = pool;
