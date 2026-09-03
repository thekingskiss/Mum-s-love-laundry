import { describe, it, expect } from 'vitest';
import { isBirthday, calculateBirthdayDiscount, BIRTHDAY_DISCOUNT_RATE } from '../utils/birthday';

describe('isBirthday', () => {
  it('is false when there is no date of birth', () => {
    expect(isBirthday(null, '2026-03-14')).toBe(false);
  });

  it('is false when month/day do not match', () => {
    expect(isBirthday('1995-03-14', '2026-03-15')).toBe(false);
  });

  it('is true when month/day match, regardless of birth year', () => {
    expect(isBirthday('1995-03-14', '2026-03-14')).toBe(true);
  });

  it('handles a Date object for date_of_birth the same way a string would be', () => {
    expect(isBirthday(new Date('1995-03-14T00:00:00.000Z'), '2026-03-14')).toBe(true);
  });
});

describe('calculateBirthdayDiscount', () => {
  it('applies no discount when date_of_birth is null', () => {
    const result = calculateBirthdayDiscount(100, null, '2026-03-14');
    expect(result).toEqual({ applies: false, discountAmount: 0, total: 100 });
  });

  it('applies no discount when the drop-off date is not the birthday', () => {
    const result = calculateBirthdayDiscount(100, '1995-03-14', '2026-03-15');
    expect(result.applies).toBe(false);
    expect(result.discountAmount).toBe(0);
    expect(result.total).toBe(100);
  });

  it('applies exactly 5% off when the drop-off date is the birthday', () => {
    const result = calculateBirthdayDiscount(100, '1995-03-14', '2026-03-14');
    expect(result.applies).toBe(true);
    expect(result.discountAmount).toBe(5);
    expect(result.total).toBe(95);
  });

  it('rounds the discount to the nearest cent', () => {
    const result = calculateBirthdayDiscount(33.33, '1995-03-14', '2026-03-14');
    expect(result.discountAmount).toBe(1.67);
  });

  it('matches BIRTHDAY_DISCOUNT_RATE', () => {
    expect(BIRTHDAY_DISCOUNT_RATE).toBe(0.05);
  });
});
