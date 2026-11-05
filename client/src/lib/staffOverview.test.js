import { describe, it, expect } from 'vitest';
import { summarizeOrders } from './staffOverview';

const TODAY = '2026-11-05';

function order(id, status, overrides = {}) {
  return { id, status, pickup_date: null, payment_status: 'paid', balance_due: '0.00', ...overrides };
}

describe('summarizeOrders', () => {
  it('returns zeroes for an empty list', () => {
    const summary = summarizeOrders([], TODAY);
    expect(summary.activeCount).toBe(0);
    expect(summary.owingTotal).toBe(0);
    expect(summary.pickups).toEqual([]);
    expect(summary.recent).toEqual([]);
  });

  it('leaves completed and cancelled orders out of the active figures', () => {
    const summary = summarizeOrders(
      [order(1, 'in_washing'), order(2, 'ready_for_pickup'), order(3, 'completed'), order(4, 'cancelled')],
      TODAY
    );
    expect(summary.activeCount).toBe(2);
    expect(summary.readyCount).toBe(1);
    expect(summary.stages.find((stage) => stage.status === 'in_washing').count).toBe(1);
    expect(summary.stages.some((stage) => stage.status === 'completed')).toBe(false);
  });

  it('separates overdue pickups from those due today and ignores future ones', () => {
    const summary = summarizeOrders(
      [
        order(1, 'in_washing', { pickup_date: '2026-11-05' }),
        order(2, 'in_washing', { pickup_date: '2026-09-12T00:00:00.000Z' }),
        order(3, 'in_washing', { pickup_date: '2026-11-06' }),
        order(4, 'completed', { pickup_date: '2026-09-01' }),
      ],
      TODAY
    );
    expect(summary.overdueCount).toBe(1);
    expect(summary.dueTodayCount).toBe(1);
    expect(summary.pickups.map((item) => item.id)).toEqual([2, 1]);
  });

  it('counts unpaid and part-paid orders, including completed ones, but not cancelled', () => {
    const summary = summarizeOrders(
      [
        order(1, 'in_washing', { payment_status: 'unpaid', balance_due: '80.00' }),
        order(2, 'completed', { payment_status: 'partial', balance_due: '20.50' }),
        order(3, 'cancelled', { payment_status: 'unpaid', balance_due: '99.00' }),
        order(4, 'in_washing'),
      ],
      TODAY
    );
    expect(summary.owingCount).toBe(2);
    expect(summary.owingTotal).toBeCloseTo(100.5);
  });

  it('caps both lists at five and reports how many pickups were left out', () => {
    const orders = Array.from({ length: 7 }, (_, index) =>
      order(index + 1, 'in_washing', { pickup_date: '2026-11-01' })
    );
    const summary = summarizeOrders(orders, TODAY);
    expect(summary.pickups).toHaveLength(5);
    expect(summary.morePickups).toBe(2);
    expect(summary.recent.map((item) => item.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
