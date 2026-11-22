// Multi-line activity chart: one line per type, a thick Total line,
// and a dashed line for the previous period's total.
import { getTheme } from './theme.js';
import { svgOpen, text, tipAttr, niceScale } from './svgUtils.js';
import { formatNumber, formatWeekdayDate, formatDate, formatMonthKey } from '../core/format.js';

const SHORT = { commits: 'Commits', prs: 'PRs', issues: 'Issues', reviews: 'Reviews' };

function bucketTitle(bucket, size) {
  if (size === 'day') return formatWeekdayDate(bucket.key);
  if (size === 'week') return 'Week of ' + formatDate(bucket.key);
  return formatMonthKey(bucket.key.slice(0, 7));
}

// interactive: true  -> adds invisible hover areas with tooltips (website)
// interactive: false -> prints the peak value on each line instead (README)
export function renderTrendChart(d, themeName, { interactive = false, compare = true } = {}) {
  const t = getTheme(themeName);
  const W = 840, H = 320, L = 48, R = 24, T = 48, B = 40;
  const pw = W - L - R;
  const ph = H - T - B;
  const n = d.series.length;
  const size = d.chart.size;

  // the lines we draw
  const lines = d.types.map((k) => ({ key: k, label: SHORT[k], color: t[k], width: 2, values: d.series.map((b) => b[k]) }));
  if (d.types.length > 1) {
    lines.push({ key: 'total', label: 'Total', color: t.text, width: 3, values: d.series.map((b) => b.total) });
  }
  const prevValues = d.prevSeries.map((b) => b.total).slice(0, n);
  const showPrev = compare && prevValues.length > 0;

  // scale
  let maxValue = 0;
  for (const line of lines) for (const v of line.values) maxValue = Math.max(maxValue, v);
  if (showPrev) for (const v of prevValues) maxValue = Math.max(maxValue, v);
  const scale = niceScale(maxValue);
  const x = (i) => (n === 1 ? L + pw / 2 : L + (i * pw) / (n - 1));
  const y = (v) => T + ph - (v / scale.max) * ph;
  const pathOf = (vals) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const hasData = maxValue > 0;
  const total = d.series.reduce((sum, b) => sum + b.total, 0);
  let out = svgOpen(W, H, 'Contribution activity chart', `Line chart of contributions per ${size}. Total ${total}.`);

  // grid lines + Y labels
  for (let k = 0; k <= 4; k++) {
    const gy = y(k * scale.step);
    out += `<line x1="${L}" y1="${gy}" x2="${L + pw}" y2="${gy}" stroke="${t.border}" stroke-width="1"/>`;
    out += text(L - 8, gy + 4, formatNumber(k * scale.step), { size: 12, fill: t.muted, anchor: 'end' });
  }

  // X labels (at most 8)
  const every = Math.ceil(n / 8);
  for (let i = 0; i < n; i += every) {
    out += text(x(i), H - 14, d.series[i].label, { size: 12, fill: t.muted, anchor: 'middle' });
  }

  if (!hasData) {
    out += text(L + pw / 2, T + ph / 2, 'No activity in this period', { size: 14, fill: t.muted, anchor: 'middle' });
  }

  // previous period (dashed, drawn first so it sits behind)
  if (showPrev) {
    out += `<path d="${pathOf(prevValues)}" fill="none" stroke="${t.muted}" stroke-width="2" stroke-dasharray="5 4" opacity="0.8"/>`;
  }

  // current lines
  for (const line of lines) {
    out += `<path d="${pathOf(line.values)}" fill="none" stroke="${line.color}" stroke-width="${line.width}" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (n <= 31) {
      line.values.forEach((v, i) => {
        out += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${line.color}"/>`;
      });
    }
  }

  // README edition: print the highest point of each line
  if (!interactive && hasData) {
    const placed = [];
    for (const line of lines) {
      const peak = Math.max(...line.values);
      if (peak <= 0) continue;
      const i = line.values.indexOf(peak);
      const px = x(i);
      const py = y(peak) - 8;
      if (placed.some((p) => Math.abs(p.x - px) < 30 && Math.abs(p.y - py) < 16)) continue; // avoid overlaps
      placed.push({ x: px, y: py });
      out += text(px, py, formatNumber(peak), { size: 12, weight: 700, fill: line.color, anchor: 'middle', halo: t.bg });
    }
  }

  // legend
  let lx = L;
  const legendItem = (color, width, dash, label) => {
    out += `<line x1="${lx}" y1="20" x2="${lx + 18}" y2="20" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${dash ? ' stroke-dasharray="4 3"' : ''}/>`;
    out += text(lx + 24, 24, label, { size: 12, fill: t.text });
    lx += 24 + label.length * 7 + 18;
  };
  for (const line of lines) legendItem(line.color, line.width, false, line.label);
  if (showPrev) legendItem(t.muted, 2, true, 'Previous period');

  // website edition: one invisible hover area per bucket
  if (interactive) {
    const step = n === 1 ? pw : pw / (n - 1);
    for (let i = 0; i < n; i++) {
      const b = d.series[i];
      const left = Math.max(L, x(i) - step / 2);
      const right = Math.min(L + pw, x(i) + step / 2);
      const tip = [bucketTitle(b, size)];
      for (const k of d.types) tip.push(`${t[k]}|${SHORT[k]}: ${formatNumber(b[k])}`);
      tip.push(`Total: ${formatNumber(b.total)}`);
      if (showPrev && d.prevSeries[i]) tip.push(`Previous period: ${formatNumber(d.prevSeries[i].total)}`);
      if (i > 0) {
        const diff = b.total - d.series[i - 1].total;
        tip.push(`Change vs previous ${size}: ${diff > 0 ? '+' : ''}${formatNumber(diff)}`);
      }
      out += `<g class="bucket"><line class="guide" x1="${x(i)}" y1="${T}" x2="${x(i)}" y2="${T + ph}" stroke="${t.muted}" stroke-dasharray="3 3" opacity="0"/>`;
      out += `<rect class="hit" x="${left}" y="${T}" width="${right - left}" height="${ph}" fill="transparent" data-tip="${tipAttr(tip)}"/></g>`;
    }
  }

  return out + '</svg>';
}
