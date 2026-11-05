import { describe, expect, it } from 'vitest';
import { countChange, labelledDays, niceCeiling, percentChange, weekTotals } from './adminOverview';

const trend = Array.from({ length: 14 }, (_, index) => ({
  date: `2026-11-${String(index + 1).padStart(2, '0')}`,
  revenue: index < 7 ? 10 : 20,
}));

describe('niceCeiling', () => {
  it.each([
    [0, 0],
    [7, 8],
    [40, 40],
    [610, 800],
    [100, 100],
    [101, 200],
    [1800, 2000],
  ])('rounds %d up to %d', (value, expected) => {
    expect(niceCeiling(value)).toBe(expected);
  });
});

describe('percentChange', () => {
  it('reports the direction and size of a change', () => {
    expect(percentChange(150, 100)).toEqual({ direction: 'up', label: '50%' });
    expect(percentChange(50, 100)).toEqual({ direction: 'down', label: '50%' });
    expect(percentChange(100, 100)).toEqual({ direction: 'flat', label: 'No change' });
  });

  it('has nothing to report when the earlier figure is zero', () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});

describe('countChange', () => {
  it('reports the difference', () => {
    expect(countChange(5, 2)).toEqual({ direction: 'up', label: '3' });
    expect(countChange(0, 2)).toEqual({ direction: 'down', label: '2' });
    expect(countChange(2, 2)).toEqual({ direction: 'flat', label: 'No change' });
  });
});

describe('weekTotals', () => {
  it('splits the trend into two weeks', () => {
    expect(weekTotals(trend)).toEqual({ lastWeek: 70, thisWeek: 140 });
  });
});

describe('labelledDays', () => {
  it('labels both Mondays, the last day and today', () => {
    expect(labelledDays(trend, trend[10].date)).toEqual([0, 7, 10, 13]);
  });

  it('drops a date that would collide with today', () => {
    expect(labelledDays(trend, trend[8].date)).toEqual([0, 8, 13]);
    expect(labelledDays(trend, trend[12].date)).toEqual([0, 7, 12]);
  });
});
