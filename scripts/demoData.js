// Fake-but-realistic data so you can preview the dashboard without a token:
//   npm run demo
import { addDays } from '../core/periods.js';

// A tiny seeded random generator: same seed -> same "random" numbers every time.
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const REPOS = [
  'Muqtasid-007/web-app',
  'Muqtasid-007/cpp-practice',
  'Muqtasid-007/dsa-notes',
  'Muqtasid-007/portfolio',
  'Muqtasid-007/mini-projects',
  'Private repositories',
];

export function makeDemoData(today) {
  const random = makeRandom(2026);
  const rows = [];

  for (let back = 730; back >= 0; back--) {
    const date = addDays(today, -back);
    const weekday = (new Date(date + 'T00:00:00Z').getUTCDay() + 6) % 7; // Mon = 0
    const isWeekend = weekday >= 5;
    const wave = 0.55 + 0.35 * Math.sin(back / 23); // busy and quiet stretches
    const chance = (isWeekend ? 0.35 : 0.8) * wave + 0.15;
    const forcedActive = back <= 8 && back !== 0; // gives the demo a visible current streak
    if (!forcedActive && random() > chance) continue;

    const reposToday = 1 + Math.floor(random() * 3);
    for (let r = 0; r < reposToday; r++) {
      const repo = REPOS[Math.floor(random() * random() * REPOS.length)]; // favors the first repos
      rows.push({
        date,
        repo,
        commits: 1 + Math.floor(random() * 7),
        prs: random() < 0.25 ? 1 : 0,
        issues: random() < 0.12 ? 1 : 0,
        reviews: random() < 0.2 ? 1 + Math.floor(random() * 2) : 0,
      });
    }
  }

  // merge duplicate (date, repo) rows so the data looks like the real thing
  const merged = new Map();
  for (const row of rows) {
    const key = row.date + '|' + row.repo;
    if (!merged.has(key)) merged.set(key, { ...row });
    else for (const t of ['commits', 'prs', 'issues', 'reviews']) merged.get(key)[t] += row[t];
  }

  return {
    demo: true,
    generatedAt: new Date().toISOString(),
    login: 'Muqtasid-007',
    timezone: 'UTC',
    createdAt: addDays(today, -800) + 'T00:00:00Z',
    rows: [...merged.values()].sort((a, b) => a.date.localeCompare(b.date) || a.repo.localeCompare(b.repo)),
  };
}
