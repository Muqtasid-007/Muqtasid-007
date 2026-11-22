// Small helpers that turn numbers and dates into readable text.
// Dates are always strings like '2026-11-22' (UTC).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function formatNumber(n) {
  return Number(n).toLocaleString('en-US');
}

export function formatAverage(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function parts(str) {
  const [y, m, d] = str.split('-').map(Number);
  return { y, m, d };
}

// 'Nov 3'
export function formatShort(str) {
  const { m, d } = parts(str);
  return `${MONTHS[m - 1]} ${d}`;
}

// 'Nov 3, 2026'
export function formatDate(str) {
  const { y, m, d } = parts(str);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// 'Tue, Nov 3, 2026'
export function formatWeekdayDate(str) {
  const day = new Date(str + 'T00:00:00Z').getUTCDay();
  return `${DAYS_SHORT[day]}, ${formatDate(str)}`;
}

// '2026-11' -> 'Nov 2026'
export function formatMonthKey(key) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatRange(start, end) {
  if (start === end) return formatDate(start);
  if (start.slice(0, 4) === end.slice(0, 4)) return `${formatShort(start)} – ${formatDate(end)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}
