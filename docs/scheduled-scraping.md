# Scheduled Career Page Scraping

`.github/workflows/scrape.yml` runs `scripts/scrape-careers.mjs` on a schedule, scraping your target companies' career pages and appending qualifying roles to your `data/jobs.json`.

> **This workflow file is a template.** Do not add `GITHUB_DATA_REPO` / `DATA_REPO_TOKEN` secrets to the shared upstream `creativereason/deckhandAI` repo — that's the public OSS project, not a place for anyone's personal data or credentials. Configure secrets only on a repo you control: your own fork, or (recommended below) your own private data repo.

---

## Prerequisites

1. **A private data repo** with `data/jobs.json` and `data/config.json` at the paths the app expects (see `scripts/init-sample-repo.mjs` or copy from the `data/*.sample.json` files).
2. **Target companies configured** — edit `scripts/scrape-careers.mjs`'s `REMOTE_TARGETS`/`LOCAL_TARGETS` for your own list.

---

## Option A: Fork the app

Fork `creativereason/deckhandAI`, then in your fork's **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|-------|
| `GITHUB_DATA_REPO` | `your-org/your-private-data-repo` |
| `DATA_REPO_TOKEN` | GitHub PAT with write access to your data repo |
| `GITHUB_DATA_BRANCH` | *(Optional)* branch to read/write, default `main` |

The workflow file works as-is — no changes needed. Downside: your fork's code drifts from upstream over time, and you're responsible for pulling in fixes yourself.

---

## Option B: Host the workflow in your data repo (recommended)

No fork to keep in sync, no PAT to manage — the workflow pushes using its own per-run token.

### Required permissions

In your **private data repo's** Settings → Actions → General → Workflow permissions, select **"Read and write permissions"** (or set the `permissions:` block below in the workflow itself, which is equivalent and doesn't require changing the repo-wide default).

### Workflow file

Create `.github/workflows/scrape.yml` **in your private data repo**:

```yaml
name: Scrape career pages

on:
  schedule:
    # Weekdays at 8am CT (13:00 UTC). Adjust to your timezone.
    - cron: "0 13 * * 1-5"
  workflow_dispatch: # allow manual trigger from GitHub Actions UI

permissions:
  contents: write

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout data repo
        uses: actions/checkout@v4

      - name: Checkout deckhandAI app code
        uses: actions/checkout@v4
        with:
          repository: creativereason/deckhandAI
          path: app

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
          cache-dependency-path: app/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: app
        run: pnpm install --frozen-lockfile

      - name: Install Playwright Chromium
        working-directory: app
        run: pnpm exec playwright install chromium --with-deps

      - name: Run scraper
        working-directory: app
        run: node scripts/scrape-careers.mjs
        env:
          DATA_ROOT: ${{ github.workspace }}
```

`DATA_ROOT` points at the data repo checkout (the default, primary checkout at `github.workspace`), which is where the script reads `data/jobs.json`/`data/config.json` from and where it pulls, commits, and pushes — using the run's automatic `GITHUB_TOKEN`, no PAT needed. The app code checkout (`path: app`) is public and needs no token.

> **Note:** Scheduled workflows are disabled on repos with no recent activity. If the workflow doesn't trigger, run it once manually via the **Run workflow** button in the Actions tab to re-enable the schedule.

---

## Troubleshooting

**"Input required and not supplied: token" on a checkout step**
- Option A: `DATA_REPO_TOKEN` isn't set on your fork's secrets.
- Option B: this shouldn't happen — the data-repo checkout is the default (no `repository`/`token` needed) and the app-code checkout is public. Double check you didn't add a `repository:`/`token:` pair to the first checkout by mistake.

**Push fails with a permissions error (Option B)**
- Add `permissions: contents: write` to the workflow (shown above), or enable "Read and write permissions" in the repo's Actions settings.

**Scraper finds jobs but they never show up in the app**
- Confirm `data/jobs.json` in your data repo is at that exact path (not repo-root `jobs.json`) — this is what `lib/jobs.ts` reads via the GitHub API.

**Scheduled workflow not triggering**
- Same fix as above — trigger once via `workflow_dispatch` to re-enable a dormant schedule.
