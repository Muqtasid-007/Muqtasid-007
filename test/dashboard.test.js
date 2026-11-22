// Run with:  npm test
// "Today" in the fixture is Sunday 2026-11-22 and has no activity yet.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { addDays, daysBetween, getPeriod, getChartRanges } from '../core/periods.js';
import { calculateStreaks } from '../core/streaks.js';
import {
  TYPES, filterRows, totalContributions, dailyAverage, dayTotals, comparePeriods, deltaText,
  mostProductiveWeekday, mostProductiveMonth, groupByRepo, bucketSeries,
} from '../core/metrics.js';
import { heatmapGrid, levelFor } from '../core/heatmap.js';
import { buildDashboard } from '../core/dashboard.js';
import { parseChunk, monthChunks } from '../scripts/fetch.js';
import { normalize } from '../scripts/normalize.js';
import { renderStatCards } from '../render/statCards.js';
import { renderTrendChart } from '../render/trendChart.js';
import { renderHeatmap } from '../render/heatmapChart.js';
import { renderRepoBars } from '../render/repoBars.js';

const data = JSON.parse(fs.readFileSync(new URL('./fixtures/daily-sample.json', import.meta.url), 'utf8'));
const TODAY = '2026-11-22';
const days = (list) => list.map(([date, total]) => ({ date, total }));

// ---- dates -------------------------------------------------------------------

test('calendar math handles leap years', () => {
  assert.equal(addDays('2028-02-28', 2), '2028-03-01'); // Feb 29 exists in 2028
  assert.equal(daysBetween('2027-03-01', '2028-03-01'), 366);
});

test('periods: week, custom one-day range, clamping and errors', () => {
  const week = getPeriod('week', TODAY);
  assert.deepEqual([week.start, week.end, week.length], ['2026-11-16', '2026-11-22', 7]);
  assert.deepEqual(week.previous, { start: '2026-11-09', end: '2026-11-15' });

  const one = getPeriod('custom', TODAY, { start: '2026-11-20', end: '2026-11-20' });
  assert.equal(one.length, 1);
  assert.deepEqual(one.previous, { start: '2026-11-19', end: '2026-11-19' });
  assert.equal(getChartRanges(one).start, '2026-11-14'); // chart shows 7 days for context

  assert.equal(getPeriod('custom', TODAY, { start: '2026-11-01', end: '2027-01-01' }).end, TODAY); // future clamped
  assert.throws(() => getPeriod('custom', TODAY, { start: '2026-11-05', end: '2026-11-01' }));
});

test('periods: range before account creation is clamped and flagged partial', () => {
  const year = getPeriod('year', TODAY, {}, '2026-06-01');
  assert.equal(year.start, '2026-06-01');
  assert.equal(year.partial, true);
});

// ---- streaks -----------------------------------------------------------------

test('streak continues across a month boundary', () => {
  const result = calculateStreaks(days([['2026-10-30', 1], ['2026-10-31', 1], ['2026-11-01', 1], ['2026-11-02', 0]]), '2026-11-02');
  assert.equal(result.longest, 3);
  assert.equal(result.longestStart, '2026-10-30');
  assert.equal(result.longestEnd, '2026-11-01');
});

test('current streak is not reset when today is still empty', () => {
  const result = calculateStreaks(days([['2026-11-20', 2], ['2026-11-21', 1], ['2026-11-22', 0]]), '2026-11-22');
  assert.equal(result.current, 2);
});

test('current streak is 0 after a real gap', () => {
  const result = calculateStreaks(days([['2026-11-19', 2], ['2026-11-20', 0], ['2026-11-21', 0], ['2026-11-22', 0]]), '2026-11-22');
  assert.equal(result.current, 0);
});

test('equal longest streaks: the most recent one wins', () => {
  const all = dayTotals(data.rows, '2026-10-30', TODAY);
  const result = calculateStreaks(all, TODAY);
  assert.equal(result.longest, 4);
  assert.equal(result.longestStart, '2026-11-18');
  assert.equal(result.current, 4);
});

// ---- metrics -----------------------------------------------------------------

test('daily average counts zero days', () => {
  assert.equal(dailyAverage(25, 30), 0.8);
  assert.equal(dailyAverage(0, 30), 0);
});

test('comparison: normal change, flat, and a previous total of 0', () => {
  assert.equal(deltaText(comparePeriods(11, 6)), '▲ +83%');
  assert.equal(deltaText(comparePeriods(4, 8)), '▼ −50%');
  assert.equal(deltaText(comparePeriods(5, 5)), '■ 0%');
  assert.equal(comparePeriods(5, 0).pct, null);
  assert.equal(deltaText(comparePeriods(5, 0)), 'New');
  assert.equal(deltaText(comparePeriods(0, 0)), '—');
});

test('type filter: only reviews', () => {
  const rows = filterRows(data.rows, '2026-10-24', TODAY, ['reviews']);
  assert.equal(totalContributions(rows), 3);
  const grid = heatmapGrid(rows, '2026-10-24', TODAY);
  assert.equal(grid.total, 3);
  assert.deepEqual(groupByRepo(rows).map((r) => r.repo), ['me/beta', 'me/alpha']);
});

test('most productive weekday and month (ties go to the earlier one)', () => {
  assert.deepEqual(mostProductiveWeekday(data.rows), { weekday: 'Tuesday', total: 6 });
  const month = mostProductiveMonth(data.rows);
  assert.equal(month.label, 'Nov 2026');
  assert.equal(month.total, 21);
  const tie = mostProductiveWeekday([
    { date: '2026-11-17', repo: 'x', commits: 2, prs: 0, issues: 0, reviews: 0 }, // Tuesday
    { date: '2026-11-16', repo: 'x', commits: 2, prs: 0, issues: 0, reviews: 0 }, // Monday
  ]);
  assert.equal(tie.weekday, 'Monday');
});

test('repository grouping sorts by total, then name', () => {
  const rows = filterRows(data.rows, '2026-10-24', TODAY);
  const list = groupByRepo(rows);
  assert.deepEqual(list.map((r) => [r.repo, r.total]), [['me/alpha', 20], ['me/beta', 3], ['Private repositories', 2]]);
});

test('buckets include empty days, weeks start on Monday', () => {
  const rows = filterRows(data.rows, '2026-10-24', TODAY);
  const daily = bucketSeries(rows, '2026-10-24', TODAY, 'day');
  assert.equal(daily.length, 30);
  assert.equal(daily[0].total, 0);
  const weekly = bucketSeries(rows, '2026-10-24', TODAY, 'week');
  assert.equal(weekly[0].key, '2026-10-19'); // a Monday
  assert.equal(weekly.reduce((sum, b) => sum + b.total, 0), 25);
});

test('heatmap levels follow the busiest day', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((c) => levelFor(c, 4)), [0, 1, 2, 3, 4]);
  const rows = filterRows(data.rows, '2026-11-16', TODAY);
  const grid = heatmapGrid(rows, '2026-11-16', TODAY);
  assert.equal(grid.weeks.length, 1);
  assert.equal(grid.weeks[0].filter((c) => c).length, 7);
});

// ---- the whole dashboard -----------------------------------------------------

test('buildDashboard: month and week numbers match the fixture', () => {
  const month = buildDashboard(data, { period: 'month', types: TYPES, today: TODAY });
  assert.equal(month.totals.current, 25);
  assert.equal(month.totals.previous, 0);
  assert.equal(month.average.current, 0.8);
  assert.equal(month.series.length, 30);

  const week = buildDashboard(data, { period: 'week', types: TYPES, today: TODAY });
  assert.equal(week.totals.current, 11);
  assert.equal(week.totals.previous, 6);
});

test('every renderer returns valid-looking SVG in both themes, with and without data', () => {
  const empty = { ...data, rows: [] };
  for (const source of [data, empty]) {
    const d = buildDashboard(source, { period: 'month', types: TYPES, today: TODAY });
    for (const theme of ['light', 'dark']) {
      for (const svg of [renderStatCards(d, theme), renderTrendChart(d, theme), renderHeatmap(d, theme), renderRepoBars(d, theme),
        renderTrendChart(d, theme, { interactive: true }), renderHeatmap(d, theme, { interactive: true }), renderRepoBars(d, theme, { interactive: true })]) {
        assert.ok(svg.startsWith('<svg ') && svg.endsWith('</svg>'));
        assert.ok(!svg.includes('NaN') && !svg.includes('undefined'));
      }
    }
  }
});

// ---- data layer & privacy ----------------------------------------------------

test('private repository names never leave parseChunk', () => {
  const answer = {
    commitContributionsByRepository: [{
      repository: { nameWithOwner: 'me/top-secret', isPrivate: true },
      contributions: { nodes: [{ occurredAt: '2026-11-20T00:00:00Z', commitCount: 3 }], pageInfo: { hasNextPage: false } },
    }],
    issueContributionsByRepository: [],
    pullRequestContributionsByRepository: [],
    pullRequestReviewContributionsByRepository: [],
  };
  const { items } = parseChunk(answer);
  assert.equal(items[0].repo, 'Private repositories');
  const saved = JSON.stringify(normalize(items, { login: 'me', createdAt: '2025-01-01T00:00:00Z' }));
  assert.ok(!saved.includes('top-secret'));
});

test('normalize merges items into one row per day per repo', () => {
  const items = [
    { at: '2026-11-20T10:00:00Z', repo: 'me/a', type: 'commits', count: 2 },
    { at: '2026-11-20T23:00:00Z', repo: 'me/a', type: 'commits', count: 1 },
    { at: '2026-11-20T12:00:00Z', repo: 'me/a', type: 'reviews', count: 1 },
  ];
  const { rows } = normalize(items, { login: 'me', createdAt: '2025-01-01T00:00:00Z' });
  assert.deepEqual(rows, [{ date: '2026-11-20', repo: 'me/a', commits: 3, prs: 0, issues: 0, reviews: 1 }]);
});

test('monthChunks covers every day exactly once', () => {
  const chunks = monthChunks('2026-09-15', '2026-11-22');
  assert.deepEqual(chunks, [
    { from: '2026-09-15', to: '2026-09-30' },
    { from: '2026-10-01', to: '2026-10-31' },
    { from: '2026-11-01', to: '2026-11-22' },
  ]);
});
