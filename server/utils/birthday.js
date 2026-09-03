// Birthday policy: an order dropped off on the customer's birthday
// (month + day match, any year) gets a flat 5% off the item subtotal.
const BIRTHDAY_DISCOUNT_RATE = 0.05;

function isBirthday(dateOfBirth, onDate) {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  const target = new Date(onDate);
  return dob.getUTCMonth() === target.getUTCMonth() && dob.getUTCDate() === target.getUTCDate();
}

// `dropOffDate` is a 'YYYY-MM-DD' string (as stored/passed for orders) or a
// Date — compared against `dateOfBirth` for a month/day match, independent
// of birth year vs. order year.
function calculateBirthdayDiscount(subtotal, dateOfBirth, dropOffDate) {
  const applies = isBirthday(dateOfBirth, dropOffDate);
  const discountAmount = applies ? Math.round(subtotal * BIRTHDAY_DISCOUNT_RATE * 100) / 100 : 0;
  return { applies, discountAmount, total: subtotal - discountAmount };
}

module.exports = { BIRTHDAY_DISCOUNT_RATE, isBirthday, calculateBirthdayDiscount };
