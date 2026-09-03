const pool = require('../config/db');
const { notifyUser } = require('./notify');
const { BIRTHDAY_DISCOUNT_RATE } = require('../utils/birthday');

// Sweeps every customer whose birthday (month + day) is today and who
// hasn't already been greeted this year, sends a birthday wish (email +
// SMS) mentioning the automatic discount, then marks them greeted for the
// year so a second run today — or tomorrow — never double-sends. Returns
// how many greetings were sent, for logging/manual-trigger feedback.
async function sendBirthdayGreetings() {
  const result = await pool.query(
    `SELECT id, email, phone_number, full_name
     FROM users
     WHERE date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
       AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
       AND (last_birthday_greeted_year IS NULL OR last_birthday_greeted_year != EXTRACT(YEAR FROM CURRENT_DATE))`
  );

  const discountPercent = Math.round(BIRTHDAY_DISCOUNT_RATE * 100);
  let greetingsSent = 0;

  for (const customer of result.rows) {
    await notifyUser(customer.id, {
      type: 'birthday',
      title: `Happy Birthday, ${customer.full_name.split(' ')[0]}!`,
      body: `Wishing you a wonderful birthday from all of us at Mum's Love Laundry! As our gift, any order you drop off today gets an automatic ${discountPercent}% discount.`,
      email: customer.email,
      phone: customer.phone_number,
    });

    await pool.query(
      'UPDATE users SET last_birthday_greeted_year = EXTRACT(YEAR FROM CURRENT_DATE) WHERE id = $1',
      [customer.id]
    );
    greetingsSent += 1;
  }

  return greetingsSent;
}

module.exports = { sendBirthdayGreetings };
