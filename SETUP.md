# Setup Guide

Follow these steps once. After that, everything updates itself every 6 hours.

## What you are setting up

```
GitHub Action (every 6 hours)
   -> reads your contributions from GitHub
   -> draws 32 SVG images + the interactive website
   -> publishes them to a branch called "output"
README.md shows the images.  GitHub Pages shows the website.
```

## Step 1: Preview it on your computer (no token needed)

You need Node.js 20 or newer.

```bash
npm test          # runs the 19 tests, all should pass
npm run demo      # builds the dashboard with fake demo data into dist/
npm run serve     # then open http://localhost:8080
```

Open the `.svg` files in `dist/svg/` in your browser to see exactly what the README will show.

## Step 2: Put the files in your profile repository

Copy everything in this folder into your profile repo (`Muqtasid-007/Muqtasid-007`), replacing `README.md`.
Make sure `.github/workflows/dashboard.yml` is included (it is a hidden folder).

## Step 3: Create a token

1. GitHub -> **Settings** -> **Developer settings** -> **Personal access tokens** -> **Tokens (classic)** -> **Generate new token (classic)**
2. Tick only **read:user**. Do not tick `repo`.
3. Copy the token.
4. In your profile repo: **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**
   - Name: `GH_STATS_TOKEN`
   - Value: the token

Optional: on your GitHub profile page, open the contribution settings and turn on **Private contributions**, so private work is counted. Private repository names are always replaced by "Private repositories" and never appear anywhere.

## Step 4: Run it the first time

1. Open the **Actions** tab -> **Update contribution dashboard** -> **Run workflow**.
2. Wait for the green check mark. A branch named `output` is created.

## Step 5: Turn on the website

**Settings** -> **Pages** -> **Build and deployment** -> Source: **Deploy from a branch** -> Branch: **output** / **(root)** -> Save.

Your website will be at `https://muqtasid-007.github.io/Muqtasid-007/`.

## Using the Custom range section

Pick one way:

- **One time:** Actions tab -> Run workflow -> fill in `start` and `end` (format `2026-09-01`).
- **Permanent:** edit `config.json`:

```json
{ "historyYears": 3, "customRange": { "start": "2026-09-01", "end": "2026-10-31" } }
```

If you set nothing, the Custom section shows the last 90 days. The website has its own live date pickers.

## Troubleshooting

| Problem | Fix |
|---|---|
| Workflow says `Missing GH_STATS_TOKEN` | Redo step 3 and check the secret name is exactly `GH_STATS_TOKEN` |
| `GitHub API error 401` | The token is wrong or expired. Make a new one |
| README shows broken images | Run the workflow once (step 4). The `output` branch must exist |
| Website says it could not load data | Wait a minute after enabling Pages, then refresh |
| Numbers differ slightly from GitHub's graph | Expected. Only commits, PRs, issues and reviews are counted, and all dates use UTC |
| Images look old | GitHub caches README images for a few minutes |

## Folder map

| Folder | What it does |
|---|---|
| `core/` | The math: periods, totals, streaks, comparison, heatmap grid (no network, easy to test) |
| `render/` | Draws SVG images from the numbers |
| `scripts/` | `fetch.js` (GitHub API), `normalize.js`, `build.js` (runs everything), `demoData.js`, `serve.js` |
| `site/` | The interactive website (HTML, CSS, JavaScript) |
| `test/` | 19 tests with a small hand-checked data file |
| `config.json` | History length and custom range |
