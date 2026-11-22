// Puts all the metrics together into ONE object.
// Both the README renderers (Node) and the website (browser) call buildDashboard().

import {
  TYPES, filterRows, totalContributions, totalsByType, dailyAverage, dayTotals,
  comparePeriods, deltaText, deltaTone, mostProductiveWeekday, mostProductiveMonth,
  groupByRepo, bucketSeries,
} from './metrics.js';
import { getPeriod, getChartRanges, addDays } from './periods.js';
import { calculateStreaks } from './streaks.js';
import { heatmapGrid } from './heatmap.js';
import { formatRange, formatNumber, formatAverage, formatMonthKey } from './format.js';

const PERIOD_TITLES = { day: 'Day', week: 'Week', month: 'Month', year: 'Year', custom: 'Custom range' };

// data:    { createdAt, login, rows: [...] }
// options: { period, custom: {start,end}, types: [...], today: 'YYYY-MM-DD' }
export function buildDashboard(data, options) {
  const today = options.today;
  const types = TYPES.filter((t) => (options.types || TYPES).includes(t)); // keep a fixed order
  const earliest = data.createdAt ? data.createdAt.slice(0, 10) : null;
  const rows = data.rows || [];

  // Step 1: which dates are we looking at?
  const range = getPeriod(options.period, today, options.custom || {}, earliest);
  const pick = (start, end) => filterRows(rows, start, end, types);

  // Step 2: current vs previous period
  const current = pick(range.start, range.end);
  const previous = pick(range.previous.start, range.previous.end);
  const totalNow = totalContributions(current);
  const totalBefore = totalContributions(previous);

  // Step 3: habit stats ignore the period filter (last 12 months; streaks use ALL history)
  const habitStart = addDays(today, -364);
  let firstDate = today;
  for (const row of rows) if (row.date < firstDate) firstDate = row.date;
  const streaks = calculateStreaks(dayTotals(pick(firstDate, today), firstDate, today), today);
  const habitRows = pick(habitStart, today);

  // Step 4: trend chart (at least 7 days, plus the same-length previous stretch)
  const chart = getChartRanges(range, earliest);
  const series = bucketSeries(pick(chart.start, chart.end), chart.start, chart.end, chart.size, types);
  const prevSeries = bucketSeries(pick(chart.previous.start, chart.previous.end), chart.previous.start, chart.previous.end, chart.size, types);

  // Step 5: heatmap — the selected range if it is long enough, otherwise the last 12 months
  const useSelected = range.length >= 84;
  const heatStart = useSelected ? range.start : habitStart;
  const heatEnd = useSelected ? range.end : today;
  const heatmap = heatmapGrid(pick(heatStart, heatEnd), heatStart, heatEnd);
  heatmap.isSelectedRange = useSelected && range.period === 'custom';

  return {
    types,
    today,
    login: data.login,
    range,
    labels: {
      title: PERIOD_TITLES[range.period],
      rangeText: formatRange(range.start, range.end),
      previousText: formatRange(range.previous.start, range.previous.end),
    },
    totals: {
      current: totalNow,
      previous: totalBefore,
      byType: { current: totalsByType(current), previous: totalsByType(previous) },
    },
    average: {
      current: dailyAverage(totalNow, range.length),
      previous: dailyAverage(totalBefore, range.length),
    },
    streaks,
    productive: { weekday: mostProductiveWeekday(habitRows), month: mostProductiveMonth(habitRows) },
    chart,
    series,
    prevSeries,
    heatmap,
    repos: groupByRepo(current),
  };
}

// The six stat cards, as plain data (used by the SVG renderer AND the website).
export function buildCards(d) {
  const cmpTotal = comparePeriods(d.totals.current, d.totals.previous);
  const cmpAvg = comparePeriods(d.average.current, d.average.previous);
  const s = d.streaks;
  const days = (n) => `${formatNumber(n)} ${n === 1 ? 'day' : 'days'}`;

  return [
    {
      id: 'total',
      label: 'Total contributions',
      value: formatNumber(d.totals.current),
      sub: `${deltaText(cmpTotal)} vs ${formatNumber(d.totals.previous)} before`,
      tone: deltaTone(cmpTotal),
      tip: [
        'Total contributions',
        `Current period: ${formatNumber(d.totals.current)}`,
        `Previous period: ${formatNumber(d.totals.previous)}`,
        `Change: ${cmpTotal.delta > 0 ? '+' : ''}${formatNumber(cmpTotal.delta)}`,
      ],
    },
    {
      id: 'average',
      label: 'Daily average',
      value: formatAverage(d.average.current),
      sub: `${deltaText(cmpAvg)} vs ${formatAverage(d.average.previous)} before`,
      tone: deltaTone(cmpAvg),
      tip: [
        'Daily average (zero days count)',
        `Current period: ${formatAverage(d.average.current)} per day`,
        `Previous period: ${formatAverage(d.average.previous)} per day`,
      ],
    },
    {
      id: 'current-streak',
      label: 'Current streak',
      value: days(s.current),
      sub: `Longest: ${days(s.longest)}`,
      tone: 'flat',
      tip: null,
    },
    {
      id: 'longest-streak',
      label: 'Longest streak',
      value: days(s.longest),
      sub: s.longestStart ? formatRange(s.longestStart, s.longestEnd) : 'No streak yet',
      tone: 'flat',
      tip: null,
    },
    {
      id: 'best-day',
      label: 'Most productive day',
      value: d.productive.weekday.weekday,
      sub: d.productive.weekday.total ? `${formatNumber(d.productive.weekday.total)} in the last 12 months` : 'No activity yet',
      tone: 'flat',
      tip: null,
    },
    {
      id: 'best-month',
      label: 'Most productive month',
      value: d.productive.month.label,
      sub: d.productive.month.total ? `${formatNumber(d.productive.month.total)} contributions` : 'No activity yet',
      tone: 'flat',
      tip: null,
    },
  ];
}

// Per-type numbers for the four small chips: [{ type, current, previous, text, tone }]
export function buildTypeChips(d) {
  return TYPES.map((type) => {
    const cmp = comparePeriods(d.totals.byType.current[type], d.totals.byType.previous[type]);
    return { type, enabled: d.types.includes(type), current: cmp.current, previous: cmp.previous, text: deltaText(cmp), tone: deltaTone(cmp) };
  });
}

export { formatMonthKey };
