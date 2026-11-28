// Stat cards (README Edition): 6 cards + 4 type chips, drawn as SVG.
import { getTheme } from './theme.js';
import { svgOpen, text } from './svgUtils.js';
import { buildCards, buildTypeChips } from '../core/dashboard.js';
import { TYPE_LABELS } from '../core/metrics.js';
import { formatNumber } from '../core/format.js';

export function renderStatCards(d, themeName) {
  const t = getTheme(themeName);
  const cards = buildCards(d);
  const chips = buildTypeChips(d);
  const W = 840, H = 328;
  const CARD_W = 264, CARD_H = 92, GAP_X = 24, GAP_Y = 16, TOP = 52;

  const desc =
    `${d.labels.title} ${d.labels.rangeText}: ${formatNumber(d.totals.current)} contributions, ` +
    `daily average ${d.average.current}, current streak ${d.streaks.current} days, longest streak ${d.streaks.longest} days.`;

  let out = svgOpen(W, H, `Contribution stats, ${d.labels.title}`, desc);

  // header
  out += text(0, 18, `${d.labels.title}: ${d.labels.rangeText}`, { size: 15, weight: 700, fill: t.text });
  out += text(0, 38, `Compared with ${d.labels.previousText}`, { size: 12, fill: t.muted });

  // the six cards (3 columns x 2 rows)
  cards.forEach((card, i) => {
    const x = (i % 3) * (CARD_W + GAP_X);
    const y = TOP + Math.floor(i / 3) * (CARD_H + GAP_Y);
    const subColor = card.tone === 'up' ? t.up : card.tone === 'down' ? t.down : t.muted;
    out += `<rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="8" fill="${t.card}" stroke="${t.border}"/>`;
    out += text(x + 16, y + 26, card.label, { size: 12, fill: t.muted });
    out += text(x + 16, y + 58, card.value, { size: card.value.length > 9 ? 22 : 28, weight: 700, fill: t.text });
    out += text(x + 16, y + 80, card.sub, { size: 12, fill: subColor });
  });

  // the four type chips
  const chipY = TOP + 2 * CARD_H + GAP_Y + 16;
  const chipW = (W - 3 * 12) / 4;
  chips.forEach((chip, i) => {
    const x = i * (chipW + 12);
    const toneColor = chip.tone === 'up' ? t.up : chip.tone === 'down' ? t.down : t.muted;
    out += `<rect x="${x}" y="${chipY}" width="${chipW}" height="52" rx="8" fill="${t.card}" stroke="${t.border}"/>`;
    out += `<circle cx="${x + 16}" cy="${chipY + 17}" r="5" fill="${t[chip.type]}"/>`;
    out += text(x + 28, chipY + 21, TYPE_LABELS[chip.type], { size: 12, fill: t.muted });
    out += text(x + 16, chipY + 43, formatNumber(chip.current), { size: 18, weight: 700, fill: t.text });
    out += text(x + chipW - 12, chipY + 43, chip.text, { size: 12, fill: toneColor, anchor: 'end' });
  });

  return out + '</svg>';
}
