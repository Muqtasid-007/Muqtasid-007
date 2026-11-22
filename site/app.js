// The interactive website. The idea is simple:
//   1) every control changes the `state` object
//   2) render() rebuilds everything from `state`
// No framework, and no hidden logic anywhere else.

import { buildDashboard, buildCards, buildTypeChips } from './core/dashboard.js';
import { TYPES, TYPE_LABELS } from './core/metrics.js';
import { addDays } from './core/periods.js';
import { formatNumber, formatDate } from './core/format.js';
import { esc, tipAttr } from './render/svgUtils.js';
import { getTheme } from './render/theme.js';
import { renderTrendChart } from './render/trendChart.js';
import { renderHeatmap } from './render/heatmapChart.js';
import { renderRepoBars } from './render/repoBars.js';

const $ = (id) => document.getElementById(id);
const PERIODS = ['day', 'week', 'month', 'year', 'custom'];
const THEME_ORDER = ['auto', 'light', 'dark'];

let data = null;
let today = null;
let earliest = null;
let tableSort = { key: 'total', dir: 'desc' };

const state = {
  period: 'month',
  from: null,
  to: null,
  types: [...TYPES],
  compare: true,
  theme: 'auto',
};

// ---------------------------------------------------------------- URL + storage

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

function readUrl() {
  const p = new URLSearchParams(location.search);
  if (PERIODS.includes(p.get('period'))) state.period = p.get('period');
  if (isDate(p.get('from')) && isDate(p.get('to'))) {
    state.from = p.get('from');
    state.to = p.get('to');
  }
  if (state.period === 'custom' && !state.from) state.period = 'month'; // invalid link: fall back silently
  if (p.get('types')) {
    const list = p.get('types').split(',').filter((t) => TYPES.includes(t));
    if (list.length) state.types = list;
  }
  if (p.get('compare') === '0') state.compare = false;
  let theme = p.get('theme');
  if (!THEME_ORDER.includes(theme)) {
    try { theme = localStorage.getItem('dashboard-theme'); } catch { theme = null; }
  }
  if (THEME_ORDER.includes(theme)) state.theme = theme;
}

function writeUrl() {
  const p = new URLSearchParams();
  p.set('period', state.period);
  if (state.period === 'custom') { p.set('from', state.from); p.set('to', state.to); }
  if (state.types.length !== TYPES.length) p.set('types', state.types.join(','));
  if (!state.compare) p.set('compare', '0');
  if (state.theme !== 'auto') p.set('theme', state.theme);
  history.replaceState(null, '', '?' + p.toString());
}

// ---------------------------------------------------------------- theme

function effectiveTheme() {
  if (state.theme !== 'auto') return state.theme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme() {
  if (state.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = state.theme;
  $('themeBtn').textContent = 'Theme: ' + state.theme[0].toUpperCase() + state.theme.slice(1);
  try { localStorage.setItem('dashboard-theme', state.theme); } catch { /* private mode: ignore */ }
}

// ---------------------------------------------------------------- messages

function showError(message) {
  const box = $('errorBox');
  box.textContent = message;
  box.hidden = !message;
}

// ---------------------------------------------------------------- render

function render() {
  hideTip();
  let d;
  try {
    d = buildDashboard(data, { period: state.period, custom: { start: state.from, end: state.to }, types: state.types, today });
  } catch (error) {
    showError(error.message);
    return;
  }
  showError('');
  const theme = effectiveTheme();

  // period buttons + custom panel
  for (const button of document.querySelectorAll('#periods button')) {
    button.setAttribute('aria-pressed', String(button.dataset.period === state.period));
  }
  $('customPanel').hidden = state.period !== 'custom';
  $('customFrom').value = state.from || '';
  $('customTo').value = state.to || '';
  $('compareToggle').checked = state.compare;

  renderChips(d, theme);
  renderCards(d);

  $('heatTitle').textContent = d.heatmap.isSelectedRange ? 'Contribution heatmap (selected range)' : 'Contribution heatmap (last 12 months)';
  $('heatNote').textContent = `${formatNumber(d.heatmap.total)} contributions. Hover a day for details, or use the arrow keys.`;
  $('heatmap').innerHTML = renderHeatmap(d, theme, { interactive: true });

  const stretched = d.chart.start !== d.range.start;
  $('trendNote').textContent = stretched
    ? `Showing the 7 days ending ${formatDate(d.chart.end)} so the lines have some context.`
    : `${d.labels.title}: ${d.labels.rangeText}, one point per ${d.chart.size}.`;
  $('trend').innerHTML = renderTrendChart(d, theme, { interactive: true, compare: state.compare });

  $('repoBars').innerHTML = renderRepoBars(d, theme, { interactive: true });
  renderTable(d);
  writeUrl();
}

function renderChips(d, theme) {
  const colors = getTheme(theme);
  $('typeChips').innerHTML = buildTypeChips(d)
    .map((chip) => {
      const delta = chip.enabled ? `<span class="delta tone-${chip.tone}">${esc(chip.text)}</span>` : '';
      return `<button type="button" class="chip" data-type="${chip.type}" aria-pressed="${chip.enabled}">` +
        `<span class="dot" style="background:${colors[chip.type]}"></span>${TYPE_LABELS[chip.type]} ` +
        `<b>${chip.enabled ? formatNumber(chip.current) : 'off'}</b>${delta}</button>`;
    })
    .join('');
}

function renderCards(d) {
  $('cards').innerHTML = buildCards(d)
    .map((card) => {
      const tip = card.tip ? ` data-tip="${tipAttr(card.tip)}" tabindex="0"` : '';
      return `<div class="card"${tip}><div class="label">${esc(card.label)}</div>` +
        `<div class="value">${esc(card.value)}</div><div class="sub tone-${card.tone}">${esc(card.sub)}</div></div>`;
    })
    .join('');
}

function renderTable(d) {
  const columns = [{ key: 'repo', label: 'Repository' }, ...d.types.map((t) => ({ key: t, label: TYPE_LABELS[t] })), { key: 'total', label: 'Total' }, { key: 'share', label: 'Share' }];
  if (!columns.some((c) => c.key === tableSort.key)) tableSort = { key: 'total', dir: 'desc' };
  const grand = d.repos.reduce((sum, r) => sum + r.total, 0);
  const rows = d.repos.map((r) => ({ ...r, share: grand ? r.total / grand : 0 }));
  rows.sort((a, b) => {
    const x = a[tableSort.key], y = b[tableSort.key];
    const result = typeof x === 'string' ? x.localeCompare(y) : x - y;
    return tableSort.dir === 'asc' ? result : -result;
  });

  const head = columns
    .map((c) => {
      const sort = c.key === tableSort.key ? ` aria-sort="${tableSort.dir === 'asc' ? 'ascending' : 'descending'}"` : '';
      return `<th scope="col"${sort}><button type="button" data-sort="${c.key}">${esc(c.label)}</button></th>`;
    })
    .join('');
  const body = rows
    .map((r) => `<tr><td>${esc(r.repo)}</td>${d.types.map((t) => `<td>${formatNumber(r[t])}</td>`).join('')}<td><b>${formatNumber(r.total)}</b></td><td>${Math.round(r.share * 100)}%</td></tr>`)
    .join('');
  $('repoTable').innerHTML = rows.length
    ? `<thead><tr>${head}</tr></thead><tbody>${body}</tbody>`
    : '<tbody><tr><td class="empty">No repository activity in this period.</td></tr></tbody>';
}

// ---------------------------------------------------------------- controls

function applyCustomRange() {
  const from = $('customFrom').value;
  const to = $('customTo').value;
  if (!from || !to) return showError('Choose both a From and a To date.');
  if (from > to) return showError('"From" must be on or before "To".');
  if (to > today) return showError('"To" cannot be in the future.');
  if (earliest && from < earliest) return showError(`"From" cannot be before your account was created (${formatDate(earliest)}).`);
  state.period = 'custom';
  state.from = from;
  state.to = to;
  render();
}

function setupControls() {
  $('periods').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-period]');
    if (!button) return;
    state.period = button.dataset.period;
    if (state.period === 'custom' && !state.from) { // first time: start with the last 30 days
      state.from = addDays(today, -29);
      state.to = today;
    }
    render();
  });

  $('applyCustom').addEventListener('click', applyCustomRange);

  $('typeChips').addEventListener('click', (e) => {
    const chip = e.target.closest('button[data-type]');
    if (!chip) return;
    const type = chip.dataset.type;
    const on = state.types.includes(type);
    if (on && state.types.length === 1) return showError('Keep at least one contribution type selected.');
    state.types = TYPES.filter((t) => (t === type ? !on : state.types.includes(t)));
    render();
  });

  $('compareToggle').addEventListener('change', (e) => { state.compare = e.target.checked; render(); });

  $('themeBtn').addEventListener('click', () => {
    state.theme = THEME_ORDER[(THEME_ORDER.indexOf(state.theme) + 1) % THEME_ORDER.length];
    applyTheme();
    render();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (state.theme === 'auto') render(); });

  $('repoTable').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-sort]');
    if (!button) return;
    const key = button.dataset.sort;
    tableSort = { key, dir: tableSort.key === key && tableSort.dir === 'desc' ? 'asc' : 'desc' };
    render();
  });
}

// ---------------------------------------------------------------- tooltips (one div, event delegation)

const tooltip = $('tooltip');
let tipTarget = null;

function fillTip(raw) {
  tooltip.innerHTML = raw
    .split('\n')
    .map((line, i) => {
      const bar = line.indexOf('|');
      if (line.startsWith('#') && bar > 0) {
        return `<div class="tip-row"><span class="dot" style="background:${esc(line.slice(0, bar))}"></span>${esc(line.slice(bar + 1))}</div>`;
      }
      return `<div class="${i === 0 ? 'tip-title' : 'tip-row'}">${esc(line)}</div>`;
    })
    .join('');
}

function showTip(target, x, y) {
  if (target !== tipTarget) {
    tipTarget = target;
    fillTip(target.getAttribute('data-tip'));
  }
  tooltip.hidden = false;
  const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > innerWidth - 8) left = x - w - 14; // keep it inside the screen
  if (top + h > innerHeight - 8) top = y - h - 14;
  tooltip.style.left = Math.max(8, left) + 'px';
  tooltip.style.top = Math.max(8, top) + 'px';
}

function hideTip() {
  tooltip.hidden = true;
  tipTarget = null;
}

function setupTooltips() {
  const tipOf = (e) => (e.target instanceof Element ? e.target.closest('[data-tip]') : null);

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const el = tipOf(e);
    if (el) showTip(el, e.clientX, e.clientY);
    else hideTip();
  });
  document.addEventListener('pointerdown', (e) => { // touch: tap to show, tap elsewhere to hide
    if (e.pointerType !== 'touch') return;
    const el = tipOf(e);
    if (el) showTip(el, e.clientX, e.clientY);
    else hideTip();
  });
  document.addEventListener('focusin', (e) => {
    const el = tipOf(e);
    if (el && el.matches('.card')) {
      const r = el.getBoundingClientRect();
      showTip(el, r.left + r.width / 2, r.bottom - 10);
    }
  });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });

  // keyboard: arrow keys walk through the heatmap days
  $('heatmap').addEventListener('keydown', (e) => {
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const box = $('heatmap');
    const current = box.querySelector('.cell.active');
    let next;
    if (current) {
      next = box.querySelector(`.cell[data-col="${+current.dataset.col + move[0]}"][data-row="${+current.dataset.row + move[1]}"]`);
    } else {
      const all = box.querySelectorAll('.cell');
      next = all[all.length - 1]; // start at the newest day
    }
    if (!next) return;
    if (current) current.classList.remove('active');
    next.classList.add('active');
    const r = next.getBoundingClientRect();
    showTip(next, r.left + r.width / 2, r.bottom);
  });
  $('heatmap').addEventListener('focusout', () => {
    const active = $('heatmap').querySelector('.cell.active');
    if (active) active.classList.remove('active');
  });
}

// ---------------------------------------------------------------- start

async function start() {
  readUrl();
  applyTheme();
  setupControls();
  setupTooltips();
  try {
    const response = await fetch('./data/daily.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Could not load data/daily.json (error ${response.status}).`);
    data = await response.json();
  } catch (error) {
    showError(error.message + ' If you opened this file directly, start a local server with "npm run serve".');
    $('updated').textContent = 'No data loaded';
    return;
  }

  today = data.generatedAt.slice(0, 10); // same "today" as the README images
  earliest = data.createdAt ? data.createdAt.slice(0, 10) : null;
  $('customFrom').min = $('customTo').min = earliest || '';
  $('customFrom').max = $('customTo').max = today;
  $('pageTitle').textContent = data.login ? `${data.login}: contribution analytics` : 'Contribution analytics';
  document.title = $('pageTitle').textContent;
  $('updated').textContent = `Updated ${data.generatedAt.slice(0, 16).replace('T', ' ')} UTC`;
  $('demoBanner').hidden = !data.demo;
  render();
  const scroller = $('heatScroll');
  scroller.scrollLeft = scroller.scrollWidth; // show the newest weeks first on small screens
}

start();
