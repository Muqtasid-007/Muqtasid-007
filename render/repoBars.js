// Repository breakdown: top 8 repos as stacked bars (one color per type).
import { getTheme } from './theme.js';
import { svgOpen, text, tipAttr, truncate } from './svgUtils.js';
import { TYPES } from '../core/metrics.js';
import { formatNumber } from '../core/format.js';

const TYPE_NAMES = { commits: 'Commits', prs: 'Pull requests', issues: 'Issues', reviews: 'Reviews' };

export function renderRepoBars(d, themeName, { interactive = false } = {}) {
  const t = getTheme(themeName);
  const W = 840, NAME_W = 220, BAR_X = 232, BAR_MAX = 440, ROW = 28, TOP = 40;

  // top 8, everything else merged into one "Other" row
  const rows = d.repos.slice(0, 8);
  const rest = d.repos.slice(8);
  if (rest.length) {
    const other = { repo: `Other (${rest.length} repos)`, commits: 0, prs: 0, issues: 0, reviews: 0, total: 0 };
    for (const r of rest) for (const k of [...TYPES, 'total']) other[k] += r[k];
    rows.push(other);
  }

  const H = TOP + Math.max(rows.length, 1) * ROW + 12;
  const grandTotal = d.repos.reduce((sum, r) => sum + r.total, 0);
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));

  let out = svgOpen(W, H, `Repository breakdown, ${d.labels.title}`, `${d.repos.length} repositories with activity, ${grandTotal} contributions in total.`);
  out += text(0, 18, `Top repositories: ${d.labels.title}`, { size: 15, weight: 700, fill: t.text });
  out += text(W, 18, `${d.repos.length} ${d.repos.length === 1 ? 'repository' : 'repositories'}, ${formatNumber(grandTotal)} contributions`, { size: 12, fill: t.muted, anchor: 'end' });

  if (rows.length === 0) {
    out += text(0, TOP + 18, 'No repository activity in this period', { size: 13, fill: t.muted });
  }

  rows.forEach((r, i) => {
    const y = TOP + i * ROW;
    out += text(0, y + 18, truncate(r.repo, 28), { size: 13, fill: t.text });

    let x = BAR_X;
    for (const k of d.types) {
      if (r[k] <= 0) continue;
      const w = Math.max(2, (r[k] / maxTotal) * BAR_MAX);
      out += `<rect x="${x.toFixed(1)}" y="${y + 4}" width="${w.toFixed(1)}" height="16" rx="3" fill="${t[k]}"/>`;
      x += w;
    }
    out += text(x + 8, y + 18, formatNumber(r.total), { size: 12, weight: 700, fill: t.text });

    if (interactive) {
      const tip = [r.repo];
      for (const k of d.types) if (r[k] > 0) tip.push(`${t[k]}|${TYPE_NAMES[k]}: ${formatNumber(r[k])}`);
      tip.push(`Total: ${formatNumber(r.total)}`, `Share: ${grandTotal ? Math.round((r.total / grandTotal) * 100) : 0}%`);
      out += `<rect class="hit" x="0" y="${y}" width="${W}" height="${ROW}" fill="transparent" data-tip="${tipAttr(tip)}"/>`;
    }
  });

  return out + '</svg>';
}
