// Builds the heatmap grid: columns = weeks (Monday first), rows = 7 weekdays.
import { addDays, weekStartOf } from './periods.js';
import { rowTotal } from './metrics.js';

// level 0..4, based on how close the day is to the busiest day in the range
export function levelFor(count, max) {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

// rows must already be filtered to start..end (and to the chosen types)
export function heatmapGrid(rows, start, end) {
  // add up each day (and keep the per-type numbers for tooltips)
  const byDate = {};
  for (const row of rows) {
    if (!byDate[row.date]) byDate[row.date] = { commits: 0, prs: 0, issues: 0, reviews: 0, total: 0 };
    const day = byDate[row.date];
    day.commits += row.commits || 0;
    day.prs += row.prs || 0;
    day.issues += row.issues || 0;
    day.reviews += row.reviews || 0;
    day.total += rowTotal(row);
  }

  let max = 0;
  let total = 0;
  for (const date in byDate) {
    if (date < start || date > end) continue;
    max = Math.max(max, byDate[date].total);
    total += byDate[date].total;
  }

  const weeks = [];
  for (let monday = weekStartOf(start); monday <= end; monday = addDays(monday, 7)) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i);
      if (date < start || date > end) {
        week.push(null); // outside the range: draw nothing
      } else {
        const day = byDate[date] || { commits: 0, prs: 0, issues: 0, reviews: 0, total: 0 };
        week.push({ date, count: day.total, level: levelFor(day.total, max), byType: day });
      }
    }
    weeks.push(week);
  }
  return { weeks, max, total, start, end };
}
