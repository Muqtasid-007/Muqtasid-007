// Runs the whole pipeline:  fetch -> normalize -> draw SVGs -> copy the website into dist/
//
//   npm run demo     (fake data, no token needed)
//   npm run build    (real data, needs GH_STATS_TOKEN and GH_LOGIN)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchContributions } from './fetch.js';
import { normalize } from './normalize.js';
import { makeDemoData } from './demoData.js';
import { buildDashboard } from '../core/dashboard.js';
import { TYPES } from '../core/metrics.js';
import { addDays } from '../core/periods.js';
import { renderStatCards } from '../render/statCards.js';
import { renderTrendChart } from '../render/trendChart.js';
import { renderHeatmap } from '../render/heatmapChart.js';
import { renderRepoBars } from '../render/repoBars.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const isDemo = process.argv.includes('--demo');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
const THEMES = ['light', 'dark'];
const PERIODS = ['day', 'week', 'month', 'year', 'custom'];
const TOTAL_STEPS = 5;

function step(n, message) {
  console.log(`\nStep ${n}/${TOTAL_STEPS}: ${message}`);
}

let filesWritten = 0;
function write(relativePath, content) {
  const full = path.join(DIST, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  filesWritten += 1;
}

// Custom range: manual run inputs > config.json > last 90 days
function pickCustomRange(today) {
  const start = process.env.RANGE_START || config.customRange?.start;
  const end = process.env.RANGE_END || config.customRange?.end;
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  if (start || end) {
    if (!isDate(start) || !isDate(end)) throw new Error('Custom range dates must look like YYYY-MM-DD (both start and end).');
    return { start, end, source: 'you chose it' };
  }
  return { start: addDays(today, -89), end: today, source: 'default: last 90 days' };
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`GitHub Contribution Dashboard build (${isDemo ? 'DEMO data' : 'real data'}), today is ${today} UTC`);

  // Step 1: get the data
  step(1, 'Getting contribution data');
  let data;
  if (isDemo) {
    data = makeDemoData(today);
    console.log(`  Made ${data.rows.length} demo rows.`);
  } else {
    const token = process.env.GH_STATS_TOKEN;
    const login = process.env.GH_LOGIN || config.login;
    if (!token || !login) {
      throw new Error('Missing GH_STATS_TOKEN or GH_LOGIN. Set them, or run "npm run demo" to try fake data.');
    }
    const raw = await fetchContributions({ login, token, years: config.historyYears, today, log: (m) => console.log('  ' + m) });
    data = normalize(raw.items, { login, createdAt: raw.createdAt });
    console.log(`  Got ${raw.items.length} items -> ${data.rows.length} daily rows.`);
  }

  // Step 2: save the data file (the website reads this)
  step(2, 'Saving data/daily.json');
  fs.rmSync(DIST, { recursive: true, force: true });
  write('data/daily.json', JSON.stringify(data));

  // Step 3: custom range
  step(3, 'Choosing the custom range');
  const custom = pickCustomRange(today);
  console.log(`  ${custom.start} to ${custom.end} (${custom.source})`);

  // Step 4: draw the SVGs
  step(4, 'Drawing SVG images');
  for (const period of PERIODS) {
    const d = buildDashboard(data, { period, custom, types: TYPES, today });
    console.log(`  ${period.padEnd(6)} ${d.labels.rangeText}: ${d.totals.current} contributions (previous: ${d.totals.previous})`);
    for (const theme of THEMES) {
      write(`svg/stats-${period}-${theme}.svg`, renderStatCards(d, theme));
      write(`svg/trend-${period}-${theme}.svg`, renderTrendChart(d, theme));
      write(`svg/repos-${period}-${theme}.svg`, renderRepoBars(d, theme));
    }
  }
  const yearView = buildDashboard(data, { period: 'year', types: TYPES, today });
  for (const theme of THEMES) write(`svg/heatmap-${theme}.svg`, renderHeatmap(yearView, theme));

  // Step 5: copy the website
  step(5, 'Copying the interactive website');
  fs.cpSync(path.join(ROOT, 'site'), DIST, { recursive: true });
  fs.cpSync(path.join(ROOT, 'core'), path.join(DIST, 'core'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'render'), path.join(DIST, 'render'), { recursive: true });

  console.log(`\nDone! ${filesWritten} files written to dist/ (SVGs are in dist/svg/).`);
  if (isDemo) console.log('Preview the website with:  npm run serve   then open http://localhost:8080');
}

main().catch((error) => {
  // Fail safe: the workflow stops here, so yesterday's images stay published.
  console.error('\nBuild failed: ' + error.message);
  process.exit(1);
});
