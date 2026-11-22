// Turns the flat list from fetch.js into one row per day per repository.

export function normalize(items, { login, createdAt, generatedAt = new Date().toISOString() }) {
  const map = new Map();
  for (const item of items) {
    const date = item.at.slice(0, 10); // we always use UTC dates
    const key = `${date}|${item.repo}`;
    if (!map.has(key)) map.set(key, { date, repo: item.repo, commits: 0, prs: 0, issues: 0, reviews: 0 });
    map.get(key)[item.type] += item.count;
  }
  const rows = [...map.values()].sort((a, b) => a.date.localeCompare(b.date) || a.repo.localeCompare(b.repo));
  return { generatedAt, login, timezone: 'UTC', createdAt, rows };
}
