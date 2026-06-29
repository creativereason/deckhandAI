# Scheduled Job Search

deckhandAI supports automated job searching that runs on a schedule, searches for qualifying roles, and writes them directly to the `pending` queue in your private data repo — ready for triage in the UI.

Three scheduling approaches are supported. Choose based on how you run deckhandAI:

| Approach | Best for | WebSearch | Indeed MCP |
|----------|----------|-----------|------------|
| [GitHub Actions](#github-actions) | Self-hosted, already using Actions for scraping | ✅ | ❌ |
| [System cron](#system-cron) | VPS or local machine, no cloud CI | ✅ | ❌ |
| [Claude Code `/schedule`](#claude-code-schedule) | claude.ai users, no server needed | ✅ | ✅ claude.ai only |

**Indeed MCP** is a claude.ai integration and is only available inside a claude.ai session. GitHub Actions and system cron run headlessly and cannot access it. The WebSearch pass works identically across all three approaches.

---

## Prerequisites

Before setting up any schedule, confirm:

1. **deckhandAI is deployed** — local or on Vercel (see [DEPLOY.md](../DEPLOY.md))
2. **Your data repo is configured** — the following must be set in your environment:
   ```
   GITHUB_TOKEN=your_pat_here
   GITHUB_DATA_REPO=your-org/your-private-repo
   GITHUB_DATA_BRANCH=main
   ```
3. **`data/config.json` has your search preferences** — titles, salary floor, location hub, and `websearch_passes` queries. See `data/config.sample.json` for the shape.

---

## GitHub Actions

The simplest path for self-hosters already using the scraper workflow. Add a new workflow file that runs Claude non-interactively with the WebSearch prompt.

### Required secrets

In your deckhandAI repo's **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (for `claude` CLI) |
| `DATA_REPO_TOKEN` | GitHub PAT with write access to your data repo |
| `GITHUB_DATA_REPO` | e.g. `your-org/your-private-repo` |
| `GITHUB_DATA_BRANCH` | e.g. `main` |

### Workflow file

Create `.github/workflows/job-search.yml`:

```yaml
name: Weekly job search

on:
  schedule:
    # Mondays at 9am UTC. Adjust to your timezone.
    - cron: "0 9 * * 1"
  workflow_dispatch: # allow manual trigger from GitHub Actions UI

jobs:
  search:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout app repo
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Checkout data repo
        uses: actions/checkout@v4
        with:
          repository: ${{ secrets.GITHUB_DATA_REPO }}
          token: ${{ secrets.DATA_REPO_TOKEN }}
          path: data-repo

      - name: Copy data files into place
        run: |
          mkdir -p data
          cp data-repo/data/jobs.json data/jobs.json 2>/dev/null || cp data/jobs.sample.json data/jobs.json
          cp data-repo/data/config.json data/config.json 2>/dev/null || cp data/config.sample.json data/config.json

      - name: Run WebSearch job search pass
        run: |
          claude --print "
            Run the weekly WebSearch job search pass for deckhandAI.
            Read data/config.json for search preferences and websearch_passes queries.
            For each query, search the web, filter against title preferences and salary floor,
            skip any URL already in data/jobs.json, and collect qualifying roles.
            Then write new jobs to the pending section of data/jobs.json directly on disk.
            Commit message convention: 'Add N jobs to pending queue via WebSearch pass'
          "
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.DATA_REPO_TOKEN }}
          GITHUB_DATA_REPO: ${{ secrets.GITHUB_DATA_REPO }}
          GITHUB_DATA_BRANCH: ${{ secrets.GITHUB_DATA_BRANCH }}

      - name: Commit and push results
        working-directory: data-repo
        run: |
          cp ../data/jobs.json data/jobs.json
          git config user.name "deckhandAI"
          git config user.email "deckhand@noreply"
          git add data/jobs.json
          git diff --cached --quiet || git commit -m "Add jobs to pending queue via WebSearch pass — $(date '+%Y-%m-%d')"
          git push
        env:
          GITHUB_TOKEN: ${{ secrets.DATA_REPO_TOKEN }}
```

This mirrors the pattern used in `.github/workflows/scrape.yml`. The two workflows can run independently or be combined into a single weekly workflow.

---

## System cron

For deckhandAI running on a VPS or local machine. Uses `crontab` to call the `claude` CLI directly.

### Prerequisites

- `claude` CLI installed: `npm install -g @anthropic-ai/claude-code`
- `ANTHROPIC_API_KEY` set in your shell environment (add to `~/.bashrc` or `~/.zshrc`)

### Setup

1. Open your crontab:
   ```bash
   crontab -e
   ```

2. Add a weekly entry (Mondays at 9am):
   ```cron
   0 9 * * 1 cd /path/to/deckhandAI && claude --print "Run the weekly WebSearch job search pass for deckhandAI. Read data/config.json for search preferences and websearch_passes queries. For each query, search the web, filter against title preferences and salary floor, skip any URL already in data/jobs.json, and add qualifying roles to the pending section using the GitHub API write flow documented in CLAUDE.md. Commit message: 'Add N jobs to pending queue via WebSearch pass'" >> /var/log/deckhand-search.log 2>&1
   ```

3. Confirm the cron is registered:
   ```bash
   crontab -l
   ```

The log file at `/var/log/deckhand-search.log` captures each run's output. Rotate it with `logrotate` or a periodic `truncate` if needed.

---

## Claude Code `/schedule`

The no-server option — creates a cloud-based trigger that fires into your claude.ai session. This is the only approach that supports the Indeed MCP pass.

### Setup

Open Claude Code inside the deckhandAI project directory and run:

```
/schedule
```

Claude will ask for the cadence and prompt. Suggested setup:

**Cadence:** `0 9 * * 1` (Mondays at 9am UTC)

**Prompt — WebSearch pass (works on any plan):**
```
Run the weekly WebSearch job search pass for deckhandAI. Read data/config.json for my search preferences and websearch_passes queries. For each query, search the web, filter results against my title preferences and salary floor, skip any URL already in jobs.json, and add qualifying roles to the pending section of jobs.json in the GitHub data repo using the write flow in CLAUDE.md. Commit with message: "Add N jobs to pending queue via WebSearch pass"
```

**Prompt — Indeed MCP pass (claude.ai only):**
```
Run the weekly Indeed MCP job search pass for deckhandAI. Read data/config.json for my search preferences. Search Indeed using the mcp__claude_ai_Indeed__search_jobs tool for each target title. Filter against my salary floor and location preferences, skip any URL already in jobs.json, and add qualifying roles to the pending section of jobs.json in the GitHub data repo using the write flow in CLAUDE.md. Commit with message: "Add N jobs to pending queue via Indeed MCP"
```

You can combine both into a single trigger — Claude will run WebSearch first, then attempt the Indeed MCP pass as a bonus step.

### Managing your schedule

```
/schedule list    # view active triggers
/schedule         # update cadence or prompt, or delete a trigger
```

---

## Reviewing results

After any scheduled run, new jobs appear in the **Pending** section of the deckhandAI UI. From there you can:

- **Promote** to Prospect or Applied
- **Pass** on roles that don't fit
- **Score** fit against your profile (if AI generation is configured)

The pending queue is append-only from the agent — it never moves or deletes existing jobs.

---

## Troubleshooting

**No jobs added after a run**
- Check that `data/config.json` has `websearch_passes` defined with at least one query group
- Verify `GITHUB_TOKEN` has write access to your data repo
- Check that salary and location filters aren't too restrictive

**GitHub Actions workflow not triggering**
- Scheduled workflows are disabled on repos with no activity in 60 days — trigger once manually via `workflow_dispatch` to re-enable

**Indeed MCP tool not found**
- You are not in a claude.ai session — use the WebSearch pass instead

**Duplicate jobs appearing**
- Deduplication matches on `url` first, then `company`+`role`. If a job board changes a listing URL the same role may be re-added — pass duplicates in the UI
