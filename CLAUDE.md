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
