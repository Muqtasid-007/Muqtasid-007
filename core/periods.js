// Date math for the Day / Week / Month / Year / Custom filters.
// Every date is a 'YYYY-MM-DD' string in UTC, and every range is INCLUSIVE.
// We always use real calendar dates (never "365 * 24 * 60 * 60 * 1000" shortcuts).

const DAY_MS = 86400000;

export function toDate(str) {
  return new Date(str + 'T00:00:00Z');
}

export function toStr(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(str, n) {
  const d = toDate(str);
  d.setUTCDate(d.getUTCDate() + n);
  return toStr(d);
}

// How many days from a to b (b - a).
export function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / DAY_MS);
}

// How many days are in the inclusive range start..end.
export function dayCount(start, end) {
  return daysBetween(start, end) + 1;
}

// Monday = 0 ... Sunday = 6
export function weekdayIndex(str) {
  return (toDate(str).getUTCDay() + 6) % 7;
}

// The Monday of the week that contains this date.
export function weekStartOf(str) {
  return addDays(str, -weekdayIndex(str));
}

// Works out the range for a filter, plus the "previous period" of the same length.
//   period:   'day' | 'week' | 'month' | 'year' | 'custom'
//   today:    'YYYY-MM-DD'
//   custom:   { start, end } (only for 'custom')
//   earliest: account creation date (optional)
export function getPeriod(period, today, custom = {}, earliest = null) {
  let start;
  let end = today;

  if (period === 'day') start = today;
  else if (period === 'week') start = addDays(today, -6);
  else if (period === 'month') start = addDays(today, -29);
  else if (period === 'year') start = addDays(today, -364);
  else if (period === 'custom') {
    start = custom.start;
    end = custom.end;
    if (!start || !end) throw new Error('Custom range needs both a start and an end date.');
  } else {
    throw new Error('Unknown period: ' + period);
  }

  if (end > today) end = today; // never look into the future
  let clamped = false;
  if (earliest && start < earliest) {
    start = earliest; // nothing exists before the account was created
    clamped = true;
  }
  if (start > end) throw new Error('Start date must be on or before the end date.');

  const length = dayCount(start, end);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(length - 1));
  const partial = clamped || (earliest ? prevStart < earliest : false);

  return { period, start, end, length, previous: { start: prevStart, end: prevEnd }, partial };
}

// How wide should each point on the trend chart be?
export function bucketSizeFor(length) {
  if (length <= 45) return 'day';
  if (length <= 400) return 'week';
  return 'month';
}

// The chart needs at least 7 days to draw a line, so a Day filter
// shows the 7 days that end on the selected day (for context).
export function getChartRanges(range, earliest = null) {
  let start = range.start;
  if (range.length < 7) start = addDays(range.end, -6);
  if (earliest && start < earliest) start = earliest;
  const length = dayCount(start, range.end);
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(length - 1));
  return { start, end: range.end, length, previous: { start: prevStart, end: prevEnd }, size: bucketSizeFor(length) };
}
