// A round number at or just above `value`, for a chart's top gridline. Each step
// halves cleanly, since the chart also draws a gridline at the midpoint.
export function niceCeiling(value) {
  if (!(value > 0)) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 4, 5, 8, 10].find((candidate) => value <= candidate * magnitude);
  return step * magnitude;
}

// Percentage change for a money figure. Returns null when there's nothing to
// compare against, since a change from zero has no meaningful percentage.
export function percentChange(current, previous) {
  if (!(previous > 0)) return null;
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    direction: percent > 0 ? 'up' : percent < 0 ? 'down' : 'flat',
    label: percent === 0 ? 'No change' : `${Math.abs(percent)}%`,
  };
}

// Change in a whole-number count, such as orders today against yesterday.
export function countChange(current, previous) {
  const difference = current - previous;
  return {
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat',
    label: difference === 0 ? 'No change' : String(Math.abs(difference)),
  };
}

// Splits the two-week trend into last week (first 7 days) and this week.
export function weekTotals(trend) {
  const total = (days) => days.reduce((sum, day) => sum + day.revenue, 0);
  return { lastWeek: total(trend.slice(0, 7)), thisWeek: total(trend.slice(7)) };
}

// Which days get an x-axis label: the two Mondays, the last day, and today.
// A date too close to "Today" is dropped so the labels can't overlap.
export function labelledDays(trend, today) {
  const todayIndex = trend.findIndex((day) => day.date === today);
  return trend
    .map((_, index) => index)
    .filter((index) => {
      if (index === todayIndex) return true;
      if (![0, 7, trend.length - 1].includes(index)) return false;
      return todayIndex === -1 || Math.abs(index - todayIndex) > 2;
    });
}
