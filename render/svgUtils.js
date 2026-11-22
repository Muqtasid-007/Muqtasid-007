// Tiny helpers for building SVG text. No libraries needed.

export const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

// Make text safe to put inside SVG/HTML.
export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Tooltip text lives in a data-tip attribute, one line per row.
// A line like '#2da44e|Commits: 4' gets a colored dot; any other line is plain text.
export function tipAttr(lines) {
  return esc(lines.join('\n')).replace(/\n/g, '&#10;');
}

export function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

export function text(x, y, content, { size = 12, weight = 400, fill = '#000', anchor = 'start', halo = null } = {}) {
  const outline = halo ? ` stroke="${halo}" stroke-width="4" stroke-linejoin="round" paint-order="stroke"` : '';
  return `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${outline}>${esc(content)}</text>`;
}

// Opening <svg> tag + accessible title/description.
export function svgOpen(width, height, title, desc) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
    `font-family="${FONT}" role="img" aria-label="${esc(title)}">` +
    `<title>${esc(title)}</title><desc>${esc(desc)}</desc>`
  );
}

// Picks a "nice" top value for the Y axis so the grid lines land on round numbers.
// Always gives 4 equal steps (5 grid lines including 0).
export function niceScale(maxValue) {
  if (maxValue <= 4) return { max: 4, step: 1 };
  const raw = maxValue / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const frac = raw / pow;
  const nice = [1, 2, 3, 4, 5, 6, 8, 10].find((c) => c >= frac) || 10;
  const step = nice * pow;
  return { max: step * 4, step };
}
