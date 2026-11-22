// Talks to the GitHub GraphQL API and returns a flat list of contributions.
// It never needs any packages: Node 20+ already has fetch().

import { addDays, daysBetween } from '../core/periods.js';

const API_URL = 'https://api.github.com/graphql';
export const PRIVATE_NAME = 'Private repositories';

// A repo's contributions come back 100 at a time. We ask for one chunk (a date range) at a time.
const CHUNK_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner isPrivate }
        contributions(first: 100) { nodes { occurredAt commitCount } pageInfo { hasNextPage } }
      }
      issueContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner isPrivate }
        contributions(first: 100) { nodes { occurredAt } pageInfo { hasNextPage } }
      }
      pullRequestContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner isPrivate }
        contributions(first: 100) { nodes { occurredAt } pageInfo { hasNextPage } }
      }
      pullRequestReviewContributionsByRepository(maxRepositories: 100) {
        repository { nameWithOwner isPrivate }
        contributions(first: 100) { nodes { occurredAt } pageInfo { hasNextPage } }
      }
    }
  }
}`;

const USER_QUERY = `query($login: String!) { user(login: $login) { createdAt } }`;

async function graphql(query, variables, token) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'contribution-dashboard',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${await response.text()}`);
  }
  const json = await response.json();
  if (json.errors) throw new Error('GitHub API returned errors: ' + JSON.stringify(json.errors));
  return json.data;
}

// Turns the API answer into simple items: { at, repo, type, count }.
// PRIVACY: private repository names are replaced HERE, before anything is saved or drawn.
export function parseChunk(collection) {
  const lists = [
    ['commits', collection.commitContributionsByRepository, (node) => node.commitCount || 1],
    ['issues', collection.issueContributionsByRepository, () => 1],
    ['prs', collection.pullRequestContributionsByRepository, () => 1],
    ['reviews', collection.pullRequestReviewContributionsByRepository, () => 1],
  ];
  const items = [];
  let truncated = false;
  for (const [type, entries, countOf] of lists) {
    for (const entry of entries || []) {
      const repo = entry.repository.isPrivate ? PRIVATE_NAME : entry.repository.nameWithOwner;
      if (entry.contributions.pageInfo.hasNextPage) truncated = true;
      for (const node of entry.contributions.nodes) {
        items.push({ at: node.occurredAt, repo, type, count: countOf(node) });
      }
    }
  }
  return { items, truncated };
}

// Fetches from..to (whole days). If a repo has more than 100 contributions
// in the range, split the range in half and try again.
async function fetchRange(login, token, from, to, log) {
  const data = await graphql(CHUNK_QUERY, { login, from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` }, token);
  const { items, truncated } = parseChunk(data.user.contributionsCollection);
  if (!truncated) return items;
  if (from === to) {
    log(`  ! ${from} has more than 100 contributions in one repo; the extra ones are skipped.`);
    return items;
  }
  const mid = addDays(from, Math.floor(daysBetween(from, to) / 2));
  log(`  Busy range ${from}..${to}: splitting it in two`);
  const left = await fetchRange(login, token, from, mid, log);
  const right = await fetchRange(login, token, addDays(mid, 1), to, log);
  return [...left, ...right];
}

// Splits start..end into calendar-month chunks (the API allows at most 1 year per request).
export function monthChunks(start, end) {
  const chunks = [];
  let cursor = start;
  while (cursor <= end) {
    const [year, month] = cursor.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10); // day 0 of next month
    const chunkEnd = lastDay < end ? lastDay : end;
    chunks.push({ from: cursor, to: chunkEnd });
    cursor = addDays(chunkEnd, 1);
  }
  return chunks;
}

export async function fetchContributions({ login, token, years, today, log = console.log }) {
  const user = await graphql(USER_QUERY, { login }, token);
  const createdAt = user.user.createdAt;
  const accountStart = createdAt.slice(0, 10);
  const historyStart = addDays(today, -365 * years);
  const start = accountStart > historyStart ? accountStart : historyStart;

  const chunks = monthChunks(start, today);
  log(`Fetching ${chunks.length} monthly chunks (${start} to ${today})...`);

  const items = [];
  for (let i = 0; i < chunks.length; i++) {
    const { from, to } = chunks[i];
    const found = await fetchRange(login, token, from, to, log);
    items.push(...found);
    log(`  [${i + 1}/${chunks.length}] ${from}..${to}: ${found.length} items`);
  }
  return { createdAt, items };
}
