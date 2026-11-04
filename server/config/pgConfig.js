require('dotenv').config();

// Supabase and local PostgreSQL both use the PostgreSQL wire protocol.
// Prefer DATABASE_URL for hosted providers; keep split variables for local use.
function getPgConfig() {
  const hostedUrl = process.env.DATABASE_URL;
  const sslEnabled = process.env.DB_SSL === 'true' || (Boolean(hostedUrl) && process.env.DB_SSL !== 'false');
  const ssl = sslEnabled
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined;

  if (hostedUrl) {
    return { connectionString: hostedUrl, ...(ssl ? { ssl } : {}) };
  }

  return {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
    ...(ssl ? { ssl } : {}),
  };
}

module.exports = getPgConfig;
