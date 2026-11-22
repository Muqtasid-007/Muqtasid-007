// Contribution heatmap: weeks as columns, Monday..Sunday as rows.
import { getTheme } from './theme.js';
import { svgOpen, text, tipAttr, esc } from './svgUtils.js';
import { TYPES } from '../core/metrics.js';
import { formatNumber, formatWeekdayDate, formatRange } from '../core/format.js';

const TYPE_NAMES = { commits: 'Commits', prs: 'Pull requests', issues: 'Issues', reviews: 'Reviews' };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function renderHeatmap(d, themeName, { interactive = false } = {}) {
  const t = getTheme(themeName);
  const { weeks } = d.heatmap;
  const W = 840, LEFT = 34, TOP = 52;
  const cols = weeks.length;
  const pitch = Math.min(14, Math.floor((W - LEFT - 8) / cols)); // cell + gap
  const size = pitch - 3;
  const H = TOP + 7 * pitch + 36;

  const title = d.heatmap.isSelectedRange ? 'Contribution heatmap (selected range)' : 'Contribution heatmap (last 12 months)';
  let out = svgOpen(W, H, title, `${formatNumber(d.heatmap.total)} contributions from ${formatRange(d.heatmap.start, d.heatmap.end)}.`);

  out += text(0, 18, title, { size: 15, weight: 700, fill: t.text });
  out += text(W, 18, `${formatNumber(d.heatmap.total)} contributions, ${formatRange(d.heatmap.start, d.heatmap.end)}`, { size: 12, fill: t.muted, anchor: 'end' });

  // month labels (skip a label if it would crowd the previous one)
  const labels = [];
  let lastMonth = null;
  weeks.forEach((week, i) => {
    const first = week.find((c) => c);
    if (!first) return;
    const month = Number(first.date.slice(5, 7));
    if (month !== lastMonth) {
      if (labels.length && i - labels[labels.length - 1].i < 3) labels.pop();
      labels.push({ i, name: MONTH_NAMES[month - 1] });
      lastMonth = month;
    }
  });
  for (const l of labels) out += text(LEFT + l.i * pitch, TOP - 8, l.name, { size: 12, fill: t.muted });

  // weekday labels
  [['Mon', 0], ['Wed', 2], ['Fri', 4]].forEach(([name, row]) => {
    out += text(0, TOP + row * pitch + size - 1, name, { size: 12, fill: t.muted });
  });

  // the cells
  if (interactive) out += `<g tabindex="0" role="group" aria-label="Contribution heatmap. Use the arrow keys to move between days.">`;
  weeks.forEach((week, col) => {
    week.forEach((cell, row) => {
      if (!cell) return;
      const label = `${cell.count === 0 ? 'No contributions' : cell.count + (cell.count === 1 ? ' contribution' : ' contributions')} on ${formatWeekdayDate(cell.date)}`;
      let inner = '';
      let attrs = '';
      if (interactive) {
        const tip = [formatWeekdayDate(cell.date), cell.count === 0 ? 'No contributions' : `${formatNumber(cell.count)} ${cell.count === 1 ? 'contribution' : 'contributions'}`];
        for (const k of TYPES) if (cell.byType[k] > 0) tip.push(`${t[k]}|${TYPE_NAMES[k]}: ${cell.byType[k]}`);
        attrs = ` data-tip="${tipAttr(tip)}"`;
      } else {
        inner = `<title>${esc(label)}</title>`; // native tooltip when the SVG is opened directly
      }
      out += `<rect class="cell" data-col="${col}" data-row="${row}" data-date="${cell.date}" data-count="${cell.count}" data-level="${cell.level}"${attrs} ` +
        `x="${LEFT + col * pitch}" y="${TOP + row * pitch}" width="${size}" height="${size}" rx="2" fill="${t.heat[cell.level]}">${inner}</rect>`;
    });
  });
  if (interactive) out += '</g>';

  // legend (bottom right)
  const ly = TOP + 7 * pitch + 22;
  const moreX = W - 8;
  const squaresEnd = moreX - 36;
  const squaresStart = squaresEnd - 5 * (size + 3) + 3;
  out += text(moreX, ly + size - 1, 'More', { size: 12, fill: t.muted, anchor: 'end' });
  for (let level = 0; level < 5; level++) {
    out += `<rect x="${squaresStart + level * (size + 3)}" y="${ly}" width="${size}" height="${size}" rx="2" fill="${t.heat[level]}"/>`;
  }
  out += text(squaresStart - 6, ly + size - 1, 'Less', { size: 12, fill: t.muted, anchor: 'end' });

  return out + '</svg>';
}
