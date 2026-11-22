// Current streak and longest streak.
//
// `days` must contain EVERY day (oldest -> newest), including days with 0:
//   [{ date: '2026-11-01', total: 3 }, { date: '2026-11-02', total: 0 }, ...]
export function calculateStreaks(days, today) {
  if (days.length === 0) {
    return { current: 0, longest: 0, longestStart: null, longestEnd: null };
  }

  // Step 1: longest streak = walk forward and count consecutive active days.
  let longest = 0;
  let longestStart = null;
  let longestEnd = null;
  let running = 0;
  let runStart = null;
  for (const day of days) {
    if (day.total > 0) {
      if (running === 0) runStart = day.date;
      running += 1;
      // ">=" so that when two streaks tie, the most recent one wins
      if (running >= longest) {
        longest = running;
        longestStart = runStart;
        longestEnd = day.date;
      }
    } else {
      running = 0;
    }
  }

  // Step 2: current streak = walk backward from the newest day.
  let current = 0;
  let i = days.length - 1;
  // Grace rule: if today has no activity yet, the streak is still alive,
  // so we start counting from yesterday.
  if (days[i].date === today && days[i].total === 0) i -= 1;
  while (i >= 0 && days[i].total > 0) {
    current += 1;
    i -= 1;
  }

  return { current, longest, longestStart, longestEnd };
}
