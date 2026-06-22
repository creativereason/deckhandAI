# deckhandAI — Roadmap to Beta

A self-hosted job search command center. Track prospects, scrape target career pages, and generate cover letters with any AI model.

---

## Current State (as of June 2026)

The core tracker is functional. The following is built and working:

**Foundation**
- [x] Next.js 16 + TypeScript + Tailwind app structure
- [x] GitHub Contents API read/write (`lib/jobs.ts`)
- [x] iron-session cookie auth (`lib/auth.ts`, `/api/auth/login`, `/api/auth/logout`)
- [x] Auth middleware gate — all routes protected except `/login` and `/api/auth/*`
- [x] Full jobs CRUD API (`/api/jobs` — GET, POST, PATCH, DELETE)
- [x] Login page

**Tracker UI**
- [x] Table view with accordion sections (prospect, local, staffing, applied, passed)
- [x] Sortable columns (company, role, fit, salary, date, signal)
- [x] Fit filter bar (strong / good / caution / weak)
- [x] Add job modal
- [x] Edit / delete job modal
- [x] Dark mode toggle
- [x] Fit badges (color-coded)
- [x] Job signal icons

**Scraping**
- [x] Playwright scrape runner (`lib/scrape-run.ts`)
- [x] Scrape API route (`/api/scrape`)
- [x] Generic scrape panel UI
- [x] Title / level / location qualification filter logic (`lib/scrape-filters.ts`)
- [x] Standalone scraper script (`scripts/scrape-careers.mjs`)
- [x] Staffing-site scraper script (`scripts/scrape-staffing.mjs`)
- [x] Configurable scrape targets (`lib/scrape-targets.ts`)
- [x] Scrape sources info page (`/scrape-sources`)

**OSS Setup**
- [x] Sample data (`data/jobs.sample.json`, `data/config.sample.json`)
- [x] README with setup guide
- [x] MIT license
- [x] `.gitignore` blocks all personal data files

---

## Beta Milestone — What's Left

Beta means: a new user can clone, configure, deploy, and use the tracker without friction. No broken flows, no hardcoded assumptions, no missing documentation.

---

### M1 — Data & Config (prerequisite for everything else)

The app currently reads `jobs.json` directly from GitHub by hardcoded path. These items make the data layer generic and user-configurable.

- [x] `config.json` schema — candidate profile, preferences, locations, AI provider
- [x] `/api/config` route — read/write `config.json` from GitHub data repo
- [x] Standardize GitHub env vars: `GITHUB_DATA_REPO` (`owner/repo` format) replaces separate `GITHUB_REPO_OWNER` + `GITHUB_REPO_NAME`
- [x] Move `jobs.json` path to `data/jobs.json` in the GitHub data repo (update `lib/jobs.ts`)
- [x] Location filter in `scrape-filters.ts` reads `hub_city` / `hub_state` from `config.json` instead of hardcoded regex

**Effort:** ~1.5 days

---

### M2 — Settings UI

Users need a way to configure the app without editing JSON files directly.

- [x] `/settings` page — candidate profile + preferences form (name, email, location, target titles, salary floor, remote/hybrid toggle)
- [x] `/settings/scraping` — hub city, hub state, scrape schedule
- [x] `/settings/model` — AI provider dropdown, model field, base URL (for Ollama/custom), API key
- [x] Form writes back to `config.json` via `/api/config`

**Effort:** ~2 days

---

### M3 — Onboarding & Setup

New users need a path from zero to running in under 10 minutes.

- [ ] `scripts/setup.js` — interactive CLI: prompts for GitHub token, data repo, app password, candidate profile; generates `.env.local` and writes initial `config.json`
- [ ] `profile.json` schema — structured work history used for AI generation (name, summary, experience array, strengths, writing rules)
- [ ] Setup CLI scaffolds `profile.json` interactively from work history prompts
- [ ] "Deploy to Vercel" button in README with env var mapping
- [ ] `CONTRIBUTING.md`

**Effort:** ~2 days

---

### M4 — GitHub Actions & Scraping Polish

Automated scraping via GitHub Actions is the zero-infrastructure path for users without a local Playwright setup.

- [ ] `.github/workflows/scrape.yml` — scheduled cron workflow (runs `scripts/scrape-careers.mjs` in the data repo, commits results)
- [ ] `.github/workflows/lint.yml` — ESLint + type-check on PR
- [ ] Scrape review queue — results land in a pending state; user approves/rejects before they hit the board
- [ ] Scrape targets UI — add/edit/delete targets in the app instead of editing `lib/scrape-targets.ts` directly; writes `data/scrape-targets.json`
- [ ] `lib/scrape-targets.ts` reads from `data/scrape-targets.json` at runtime instead of static export

**Effort:** ~3 days

---

### M5 — AI Document Generation (BYOM)

Users supply their own model and API key. Generation runs server-side — keys never reach the browser.

**Profile setup**
- [ ] `/api/profile` route — read/write `profile.json` from GitHub data repo
- [ ] Profile editor in Settings — structured form for work history, strengths, writing rules

**Generation API**
- [ ] `lib/model.ts` — OpenAI-compatible client with provider switching (Anthropic, OpenAI, Ollama, custom base URL)
- [ ] `lib/prompts.ts` — system prompt (writing rules + candidate profile) + user prompt template (job details + JD text + optional angle)
- [ ] `/api/generate` route — streaming server-side proxy; fetches JD from job URL, builds prompt, streams response

**Generation UI**
- [ ] `GenerateModal.tsx` — opens from job card "Generate" button
  - Pre-filled: company, role, JD URL from the job record
  - JD text fetched server-side on open
  - Optional "angle / emphasis" textarea for user direction
  - Streaming output panel (text appears token by token)
  - Inline editing after generation
  - Refine field + Regenerate button for iteration
- [ ] Generation type selector: cover letter vs. resume tailoring notes
- [ ] Export: copy to clipboard, print-to-PDF (browser `window.print()` with print stylesheet), download as `.txt`
- [ ] `ModelBadge` — active provider + model shown in header

**Providers to test**
- [ ] Anthropic (claude-sonnet-4-6)
- [ ] OpenAI (gpt-4o)
- [ ] Ollama local endpoint

**Effort:** ~5 days

---

### M6 — Demo Mode & Launch Polish

- [ ] Demo mode — `DEMO_MODE=true` bypasses auth, loads `data/jobs.sample.json` read-only
- [ ] Error states — empty tracker state, GitHub API errors, scrape failures surfaced cleanly in UI
- [ ] Mobile-responsive layout pass
- [ ] Favicon / app icon
- [ ] `robots.txt` — block indexing (personal tool, not meant to be crawled)
- [ ] Migrate `middleware.ts` to `proxy` convention (Next.js deprecation warning — `middleware` file convention is deprecated; see [next.js docs](https://nextjs.org/docs/messages/middleware-to-proxy))

**Effort:** ~2 days

---

## Summary

| Milestone | Description | Effort |
|---|---|---|
| M1 — Data & Config | Config schema, generic data paths | ~1.5d |
| M2 — Settings UI | In-app configuration forms | ~2d |
| M3 — Onboarding | Setup CLI, profile.json, deploy button | ~2d |
| M4 — Scraping Polish | GitHub Actions, review queue, targets UI | ~3d |
| M5 — AI Generation | BYOM generate modal, streaming, export | ~5d |
| M6 — Launch Polish | Demo mode, error states, mobile, icons | ~2d |
| **Total** | | **~15.5 days** |

At a steady pace alongside other work, **6–8 calendar weeks** to beta.

---

## Deliberately Deferred (post-beta)

- **Drag-and-drop kanban** — table view with status dropdown covers the workflow; DnD is high-risk for low incremental value in v1
- **DOCX / styled PDF export** — v1 ships text generation + clipboard + print; full resume DOCX generation is v1.1
- **Multi-user / team support** — single-user personal tool in v1
- **ATS integrations** (Greenhouse, Lever, Workday as data sources) — v1.1
- **Email / Slack notifications** — v1.1

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Yes | Personal access token with `repo` scope |
| `GITHUB_DATA_REPO` | Yes | `username/repo-name` of private data repo |
| `GITHUB_DATA_BRANCH` | No | Branch to read/write (default: `main`) |
| `APP_PASSWORD` | Yes | Password to access the board |
| `COOKIE_SECRET` | Yes | Random 32+ char string for signing session cookies |
| `AI_API_KEY` | No | API key (Anthropic, OpenAI, etc.) — not needed for Ollama |
| `AI_PROVIDER` | No | `anthropic` \| `openai` \| `ollama` \| `custom` (default: `anthropic`) |
| `AI_BASE_URL` | No | Ollama or custom endpoint (e.g. `http://localhost:11434/v1`) |
| `DEMO_MODE` | No | `true` to enable read-only demo, bypasses auth |
