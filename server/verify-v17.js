require('dotenv').config();

const { Client } = require('pg');
const client = new Client(require('./config/pgConfig')());

const columns = [
  'sms_order_updates',
  'email_order_updates',
  'pickup_reminders',
  'low_stock_alerts',
  'invoice_notifications',
  'birthday_discount_enabled',
  'auto_generate_invoice',
];

async function verify() {
  try {
    await client.connect();

    const result = await client.query(
      `
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'users'
          AND column_name = ANY($1)
        ORDER BY column_name;
      `,
      [columns]
    );

    console.table(result.rows);
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

verify();
