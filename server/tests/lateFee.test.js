import { describe, it, expect } from 'vitest';
import { calculateLateFee, FREE_PICKUP_DAYS, LATE_FEE_PER_DAY } from '../utils/lateFee';

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

describe('calculateLateFee', () => {
  it('charges nothing when there is no ready_for_pickup timestamp', () => {
    expect(calculateLateFee(null)).toEqual({ daysReady: 0, daysOverdue: 0, fee: 0 });
  });

  it('charges nothing within the free pickup window', () => {
    const result = calculateLateFee(daysAgo(3));
    expect(result.daysReady).toBe(3);
    expect(result.daysOverdue).toBe(0);
    expect(result.fee).toBe(0);
  });

  it('charges nothing on exactly the last free day', () => {
    const result = calculateLateFee(daysAgo(FREE_PICKUP_DAYS));
    expect(result.daysOverdue).toBe(0);
    expect(result.fee).toBe(0);
  });

  it('accrues the daily fee once past the free window', () => {
    const result = calculateLateFee(daysAgo(FREE_PICKUP_DAYS + 2));
    expect(result.daysOverdue).toBe(2);
    expect(result.fee).toBe(2 * LATE_FEE_PER_DAY);
  });

  it('freezes the fee as of a given completed_at instead of "now"', () => {
    const readyAt = daysAgo(30);
    const completedAt = new Date(readyAt.getTime() + 10 * 24 * 60 * 60 * 1000); // picked up 10 days after ready
    const result = calculateLateFee(readyAt, completedAt);
    expect(result.daysReady).toBe(10);
    expect(result.daysOverdue).toBe(10 - FREE_PICKUP_DAYS);
    expect(result.fee).toBe((10 - FREE_PICKUP_DAYS) * LATE_FEE_PER_DAY);
  });
});
