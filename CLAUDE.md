# deckhandAI — Claude Code Instructions

## Project Overview

deckhandAI is an open-source self-hosted job search tracker built on Next.js 16 + TypeScript + Tailwind CSS. Data lives in flat JSON files. No database.

## Commands

```bash
pnpm install       # install dependencies
pnpm dev           # dev server at http://localhost:3000
pnpm build         # production build
pnpm lint          # ESLint
node scripts/scrape-careers.mjs   # run career page scraper
```

Always use **pnpm** — never npm or yarn.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS**
- **Playwright** for scraping career pages
- Flat JSON (`data/jobs.json`, `data/config.json`) as the data layer

## File Structure

```
app/
  layout.tsx          # Root layout
  page.tsx            # Main tracker UI
  login/              # Auth page
  api/                # API routes (jobs CRUD, scrape trigger, AI generate)
  scrape-sources/     # Scraper source configs
components/           # Shared UI components
lib/
  jobs.ts             # Jobs read/write
  auth.ts             # Session auth
  scrape-filters.ts   # Title/location qualification logic
  scrape-run.ts       # Scraper orchestration
  scrape-targets.ts   # Target company definitions
  utils.ts            # Shared utilities
scripts/
  scrape-careers.mjs  # Standalone scraper (runs in GitHub Actions)
  scrape-staffing.mjs # Staffing-site scraper
data/
  jobs.sample.json    # Example jobs schema (safe to commit)
  config.sample.json  # Example config schema (safe to commit)
  jobs.json           # Your actual job data (gitignored — never commit)
  config.json         # Your actual config (gitignored — never commit)
```

## Data Files

- `data/jobs.json` — gitignored, never commit
- `data/config.json` — gitignored, never commit
- `data/jobs.sample.json` and `data/config.sample.json` — committed, contain only fake/generic placeholder data

## jobs.json Schema

```json
{
  "applied": [{ "company": "", "role": "", "status": "applied|screening|interview|offer|declined", "date": "YYYY-MM-DD", "salary": "", "notes": "", "url": "" }],
  "prospect": [{ "company": "", "role": "", "fit": "strong|good|caution|weak", "salary": "", "notes": "", "url": "" }],
  "local": [],
  "staffing": [],
  "passed": []
}
```

## Architecture Notes

- Auth is session-based via `iron-session`
- Scraper uses Playwright; Chromium must be installed separately (`npx playwright install chromium`)
- AI generation proxies through `/api/generate` — API key stays server-side, never exposed to browser
- Any OpenAI-compatible endpoint works for AI generation (Anthropic, OpenAI, Ollama, custom)
- Jobs data lives in a private GitHub repo defined by `GITHUB_DATA_REPO` in `.env.local` — never in this repo

## Searching for Jobs via Indeed MCP

Use the Indeed MCP tool (`mcp__claude_ai_Indeed__search_jobs`) to search for qualifying roles. Your search criteria (target titles, location, salary floor, etc.) should come from `data/config.json`.

Typical search patterns:
- Search by role title + "remote"
- Search by company name alone for firms where keyword+company returns no results
- Search by role title + city/metro for local or hybrid roles

### Adding found jobs to the tracker

After searching, add qualifying jobs to the `pending` section of `jobs.json` in the remote data repo. The pending section holds unreviewed jobs awaiting triage in the UI.

**Write flow** (uses credentials from `.env.local`):

1. Read the current `jobs.json` from GitHub:
   ```
   GET https://api.github.com/repos/{GITHUB_DATA_REPO}/contents/data/jobs.json?ref={GITHUB_DATA_BRANCH}
   Authorization: Bearer {GITHUB_TOKEN}
   ```
   Decode the base64 `content` field.

2. Parse the JSON, append each new job to the `pending` array. Skip any job already present (match on `url` or `company`+`role`).

3. Write back via PUT to the same endpoint, including the `sha` from step 1 and the updated content re-encoded as base64.

Each pending job should have this shape:
```json
{
  "company": "",
  "role": "",
  "url": "",
  "salary": "",
  "notes": "",
  "scrapeGroup": "remote | local",
  "scrapeDate": "YYYY-MM-DD"
}
```

Commit message convention: `"Add N jobs to pending queue via Indeed MCP"`

## Weekly WebSearch Pass

Run this pass weekly alongside or instead of the Indeed MCP pass. It targets job boards directly (Ashby, Greenhouse, Lever, Built In) and surfaces director/senior-IC UX roles that don't appear in Indeed results.

Queries are defined in `data/config.json` under `websearch_passes`. Run all groups: `job_boards_director`, `job_boards_ic`, `local`, and `companies`.

For each query:
1. Run a WebSearch with the query string
2. Scan results for role titles matching `preferences.titles` in config (or equivalent seniority)
3. Apply the same filters as the Indeed pass:
   - Comp ≥ `preferences.salary.min_fte` (FTE) or ≥ `preferences.salary.min_contract_hourly` (contract)
   - Location: remote, or hybrid within `preferences.locations.hub_radius_miles` of hub city
   - Skip any URL already present in jobs.json (check all sections)
4. For qualifying roles, fetch the job detail URL to confirm the posting is active and get salary/notes
5. Add to the `pending` section of jobs.json using the same GitHub API write flow as the Indeed pass

Commit message convention: `"Add N jobs to pending queue via WebSearch pass"`

**Tip:** `site:jobs.ashbyhq.com` and `site:jobs.lever.co` queries are the most reliable. Built In results occasionally include closed listings — verify the URL before adding.
