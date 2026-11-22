// The "pure math" of the dashboard: no network, no files, no DOM.
// Because of that it runs in Node (for the README SVGs) and in the browser (for the website).
//
// A "row" looks like: { date: '2026-11-20', repo: 'me/project', commits: 4, prs: 1, issues: 0, reviews: 2 }

import { addDays, weekStartOf, weekdayIndex } from './periods.js';
import { WEEKDAYS, formatShort, formatMonthKey } from './format.js';

export const TYPES = ['commits', 'prs', 'issues', 'reviews'];
export const TYPE_LABELS = {
  commits: 'Commits',
  prs: 'Pull Requests',
  issues: 'Issues',
  reviews: 'Reviews',
};

// Sum of the four types in one row.
export function rowTotal(row) {
  return (row.commits || 0) + (row.prs || 0) + (row.issues || 0) + (row.reviews || 0);
}

// Keep rows inside start..end and set every UNSELECTED type to 0.
// After this, every other function automatically respects the type filter.
export function filterRows(rows, start, end, types = TYPES) {
  const result = [];
  for (const row of rows) {
    if (row.date < start || row.date > end) continue;
    const copy = { date: row.date, repo: row.repo };
    for (const t of TYPES) copy[t] = types.includes(t) ? row[t] || 0 : 0;
    result.push(copy);
  }
  return result;
}

export function totalContributions(rows) {
  let sum = 0;
  for (const row of rows) sum += rowTotal(row);
  return sum;
}

export function totalsByType(rows) {
  const totals = { commits: 0, prs: 0, issues: 0, reviews: 0 };
  for (const row of rows) for (const t of TYPES) totals[t] += row[t] || 0;
  return totals;
}

// Zero days count too: total / number of days, rounded to 1 decimal.
export function dailyAverage(total, days) {
  if (days <= 0) return 0;
  return Math.round((total / days) * 10) / 10;
}

// One entry for EVERY day in start..end (missing days become 0).
export function dayTotals(rows, start, end) {
  const map = {};
  for (const row of rows) map[row.date] = (map[row.date] || 0) + rowTotal(row);
  const days = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push({ date: d, total: map[d] || 0 });
  return days;
}

// ---- Current vs previous period ----------------------------------------

export function comparePeriods(current, previous) {
  const delta = current - previous;
  const pct = previous > 0 ? Math.round((delta / previous) * 100) : null; // null = no baseline
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return { current, previous, delta, pct, direction };
}

// '▲ +12%', '▼ −8%', '■ 0%', 'New' (previous was 0) or '—' (both 0)
export function deltaText(cmp) {
  if (cmp.previous === 0) return cmp.current > 0 ? 'New' : '—';
  const arrow = { up: '▲', down: '▼', flat: '■' }[cmp.direction];
  const sign = cmp.direction === 'up' ? '+' : cmp.direction === 'down' ? '−' : '';
  return `${arrow} ${sign}${Math.abs(cmp.pct)}%`;
}

// 'up' | 'down' | 'flat' — used to pick a color.
export function deltaTone(cmp) {
  if (cmp.previous === 0) return cmp.current > 0 ? 'up' : 'flat';
  return cmp.direction;
}

// ---- Habit stats (most productive day / month) ----------------------------

// Which weekday has the most contributions? Ties go to the earlier weekday (Monday first).
export function mostProductiveWeekday(rows) {
  const sums = [0, 0, 0, 0, 0, 0, 0];
  for (const row of rows) sums[weekdayIndex(row.date)] += rowTotal(row);
  let best = 0;
  for (let i = 1; i < 7; i++) if (sums[i] > sums[best]) best = i;
  if (sums[best] === 0) return { weekday: '—', total: 0 };
  return { weekday: WEEKDAYS[best], total: sums[best] };
}

// Which calendar month has the most contributions? Ties go to the earlier month.
export function mostProductiveMonth(rows) {
  const sums = {};
  for (const row of rows) {
    const key = row.date.slice(0, 7);
    sums[key] = (sums[key] || 0) + rowTotal(row);
  }
  const keys = Object.keys(sums).sort();
  let bestKey = null;
  for (const key of keys) if (bestKey === null || sums[key] > sums[bestKey]) bestKey = key;
  if (bestKey === null || sums[bestKey] === 0) return { key: null, label: '—', total: 0 };
  return { key: bestKey, label: formatMonthKey(bestKey), total: sums[bestKey] };
}

// ---- Repository breakdown ----------------------------------------------------

export function groupByRepo(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.repo)) map.set(row.repo, { repo: row.repo, commits: 0, prs: 0, issues: 0, reviews: 0, total: 0 });
    const entry = map.get(row.repo);
    for (const t of TYPES) entry[t] += row[t] || 0;
    entry.total += rowTotal(row);
  }
  const list = [...map.values()].filter((r) => r.total > 0);
  list.sort((a, b) => b.total - a.total || a.repo.localeCompare(b.repo));
  return list;
}

// ---- Trend chart buckets ------------------------------------------------------

function bucketKey(date, size) {
  if (size === 'week') return weekStartOf(date);
  if (size === 'month') return date.slice(0, 7) + '-01';
  return date;
}

function bucketLabel(key, size) {
  if (size === 'month') return formatMonthKey(key.slice(0, 7));
  return formatShort(key);
}

// Groups rows into day / week / month buckets. Empty buckets are included as 0.
export function bucketSeries(rows, start, end, size, types = TYPES) {
  const buckets = [];
  const index = {};

  // 1) create every bucket, in order
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const key = bucketKey(d, size);
    if (index[key] === undefined) {
      index[key] = buckets.length;
      buckets.push({ key, label: bucketLabel(key, size), commits: 0, prs: 0, issues: 0, reviews: 0, total: 0 });
    }
  }

  // 2) drop each row into its bucket
  for (const row of rows) {
    const i = index[bucketKey(row.date, size)];
    if (i === undefined) continue;
    for (const t of types) {
      buckets[i][t] += row[t] || 0;
      buckets[i].total += row[t] || 0;
    }
  }
  return buckets;
}
