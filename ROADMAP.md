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

- [x] `scripts/setup.mjs` — interactive CLI: prompts for GitHub token, data repo, app password, candidate profile; generates `.env.local` and writes initial `config.json`
- [x] `profile.json` schema — structured work history used for AI generation (name, summary, experience array, strengths, writing rules)
- [x] Setup CLI scaffolds `profile.json` interactively from work history prompts
- [x] "Deploy to Vercel" button in README with env var mapping
- [x] `CONTRIBUTING.md`

**Effort:** ~2 days

---

### M4 — GitHub Actions & Scraping Polish

Automated scraping via GitHub Actions is the zero-infrastructure path for users without a local Playwright setup.

- [x] `.github/workflows/scrape.yml` — scheduled cron workflow (runs `scripts/scrape-careers.mjs` in the data repo, commits results)
- [x] `.github/workflows/lint.yml` — ESLint + type-check on PR
- [x] Scrape review queue — results land in a pending state; user approves/rejects before they hit the board
- [x] Scrape targets UI — add/edit/delete targets in the app instead of editing `lib/scrape-targets.ts` directly; writes `data/scrape-targets.json`
- [x] `lib/scrape-targets.ts` reads from `data/scrape-targets.json` at runtime instead of static export

**Effort:** ~3 days

---

### M5 — AI Document Generation (BYOM)

Users supply their own model and API key. Generation runs server-side — keys never reach the browser.

**Profile setup**
- [x] `/api/profile` route — read/write `profile.json` from GitHub data repo
- [x] Profile editor in Settings — structured form for work history, strengths, writing rules

**Generation API**
- [x] `lib/model.ts` — OpenAI-compatible client with provider switching (Anthropic, OpenAI, Ollama, custom base URL)
- [x] `lib/prompts.ts` — system prompt (writing rules + candidate profile) + user prompt template (job details + JD text + optional angle)
- [x] `/api/generate` route — streaming server-side proxy; fetches JD from job URL, builds prompt, streams response

**Generation UI**
- [x] `GenerateModal.tsx` — opens from job card "Generate" button
  - Pre-filled: company, role, JD URL from the job record
  - JD text fetched server-side on open
  - Optional "angle / emphasis" textarea for user direction
  - Streaming output panel (text appears token by token)
  - Inline editing after generation
  - Refine field + Regenerate button for iteration
- [x] Generation type selector: cover letter vs. resume tailoring notes
- [x] Export: copy to clipboard, print-to-PDF (browser `window.print()` with print stylesheet), download as `.txt`
- [x] `ModelBadge` — active provider + model shown in header

**Providers to test**
- [x] Anthropic (claude-sonnet-4-6)
- [ ] OpenAI (gpt-4o)
- [ ] Ollama local endpoint

**Effort:** ~5 days

---

### M6 — Demo Mode & Launch Polish

- [x] Demo mode — `DEMO_MODE=true` bypasses auth, loads `data/jobs.sample.json` read-only
- [x] Error states — empty tracker state, GitHub API errors, scrape failures surfaced cleanly in UI
- [x] Mobile-responsive layout pass
- [x] Favicon / app icon (anchor emoji via Next.js ImageResponse)
- [x] `robots.txt` — block indexing
- [x] Middleware deprecation — confirmed current pattern is correct for Next.js 14+

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

## M7 — Document Export (Cover Letter + Resume)

Export a tailored cover letter and resume using a code-defined style generator built on the `docx` npm library. No template file to upload or manage — style is configured in Settings and baked into the output at generation time, ensuring ATS safety by construction.

**Approach**
- Documents are generated programmatically (not via template filling) using the same approach as the existing resume-tailoring Claude skill
- Ships with neutral defaults (Calibri, standard spacing, accessible accent color) so export works immediately after setup
- A companion Claude skill file (`docs/export-style.skill.md`) documents all style tokens so users can prompt an AI to customize their output spec

**Style settings** (`/settings/export`)
- [x] Font family (default: Calibri)
- [x] Accent color — used for name, section headers, and rules (default: `#1E3A8A`)
- [x] Body text color (default: `#374151`)
- [x] Page margins (default: 0.75" left/right, 0.60" top/bottom)
- [x] Settings write to `config.json` via existing `/api/config` route

**Cover letter export**
- [x] Outputs DOCX; PDF via browser print from Generate modal
- [x] Export button in Generate modal downloads the AI-generated cover letter text with a styled header block (name, contact line, rule, date, salutation)
- [x] Export action on job card triggers generation + download in one step
- [x] Filename: `cover-letter-[company]-[role].docx`

**Resume export**
- [x] Base export renders `profile.json` work history into a styled DOCX — available from any job card without AI
- [x] "Tailor for this role" tab runs AI against the job description and rewrites bullets + title; user reviews a before/after diff preview before downloading
- [x] Outputs DOCX; PDF via browser print
- [x] Filename: `resume-[company]-[role].docx`

**Trigger locations**
- [x] Generate modal — export buttons for cover letter and resume after generation/tailoring
- [x] Job card row actions — "Cover letter" (one-step generate + download) and "Resume" buttons

**ATS compliance (built-in, not validated after the fact)**
- Single-column layout only — no tables, text boxes, or columns
- Bullets via `docx` numbering API — never raw `•` characters
- Phone number in a single unbroken XML run
- Tab stops for date alignment — never spaced manually

**Effort:** ~3 days

---

## M8 — AI Chat Assistant (post-beta)

A chat interface, branded "Your Deckhand," that lets you manage the job board through natural language instead of the modal forms.

**Chat UI**
- [x] ~~Floating chat button (bottom-right) opens a drawer/panel~~ — superseded by the board layout redesign: the assistant is now an inline card above the board on mobile, and a sticky 1/3-width right rail from `md` up, collapsible and persisted per user
- [x] Streaming message display with tool call status indicators, now appended progressively as a growing list instead of overwriting a single status line
- [x] Conversation history within the session

**Tools (what the AI can do)**
- [x] `read_profile()` — read the candidate profile for fit/background questions
- [x] `list_jobs(section?)` — read jobs across one or all sections
- [x] `add_job(section, fields)` — add a new job to the board
- [x] `update_job(section, company, role, updates)` — edit any field on a job
- [x] `move_job(company, role, from_section, to_section)` — move a job between sections
- [x] `flag_ghost(company, role)` — set `isGhost: true` on a job (asks which job if not named)
- [x] `delete_job(section, company, role)` — remove a job
- [x] `fetch_job_description(url)` — retrieve JD text for a shared URL
- [x] `search_remote_jobs(keywords)` — RemoteOK fallback when a JD page is blocked/gated
- [x] `detect_ghost_jobs()` — scan applied jobs for stale/suspicious signals

**Example prompts**
- "Flag a job as a ghost job" (asks which one)
- "Move all declined applications to passed"
- "What have I applied to in the last two weeks?"
- "Add a new prospect: Stripe, Head of Design, strong fit"
- "Scrape for new jobs" — see M10

**Effort:** ~2 days

---

## Technical Debt

- [x] Rename `middleware.ts` → `proxy.ts` — Next.js 16 deprecated the `middleware` file convention in favor of `proxy`; surfaced as a build warning on deploy

---

## M9 — Automated Testing

Establish a test baseline that catches regressions in the data layer, API routes, and critical UI flows before they reach production.

**Unit / integration**
- [x] `lib/jobs.ts` — read/write round-trip, section moves, dedup logic (`lib/__tests__/jobs.test.ts`)
- [x] `lib/scrape-filters.ts` — title qualification, location matching edge cases (`lib/__tests__/scrape-filters.test.ts`)
- [x] `lib/job-fetcher.ts` — retrieval fallback chain, time budget, content-quality gate (`lib/__tests__/job-fetcher.test.ts`)
- [x] `/api/evaluate-job` — auth, validation, SSE status/result ordering, notes extraction (`app/api/__tests__/evaluate-job.test.ts`)
- [x] `ChatDrawer` — evaluation confirm/disable states (`components/__tests__/ChatDrawer.test.tsx`, `shouldEvaluateJobUrl.test.ts`)
- [x] Job detail page — notes-refresh confirm flow (`app/job/__tests__/page.test.tsx`)
- [ ] `lib/config.ts` + `lib/scrape-targets.ts` — config parsing, fallback behavior
- [ ] `/api/jobs` — GET, POST, PATCH, DELETE happy paths and error cases
- [ ] `/api/scrape/review` — approve and reject paths update correct sections
- [ ] `/api/generate` — streaming response shape, provider switching

**End-to-end (Playwright)**
- [ ] Login flow
- [ ] Add a job → appears in correct section
- [ ] Edit a job → changes persist
- [ ] Move a job between sections → appears in destination, removed from source
- [ ] Scrape review queue — approve and dismiss items
- [ ] Generate modal — opens, streams output, export buttons present
- [ ] Settings — save profile, toggle preferences, reflect on board

**CI**
- [x] Run unit/integration tests on every PR (`pnpm test`) — added to `.github/workflows/lint.yml`
- [ ] Run E2E suite on merge to main against a seeded demo dataset

**Effort:** ~4 days

---

## M10 — Scraper UX

Improve the scraper experience so it's informative and usable while a run is in progress.

- [x] Manual "scrape now" trigger via the Deckhand chat assistant — the board layout redesign removed the standalone Scrape button/panel from the header in favor of scheduled (GitHub Actions cron) scraping; a "Scrape for new jobs" chat prompt replaces on-demand runs, streaming real per-target status via SSE (`/api/scrape`) across both remote and local target groups in one request
- [x] Live progress feed — per-target status (listings found / qualifying / added, or the failure reason) streams into the chat as each target completes, replacing the old panel's static spinner
- [ ] Elapsed time and per-target timing shown in the feed
- [ ] Error detail inline — already surfaced per-target on failure; no dedicated retry affordance yet
- [ ] Cancel in-flight run — no way to abort a running scrape once started via chat
- [ ] Persist last-run summary — chat history clears with "Start over"; no persisted last-run summary across sessions
- [ ] Empty-state polish — no dedicated empty state; N/A now that targets are configured via Settings → Scrape Targets rather than a panel

**Effort:** ~2 days

---

## M11 — "Evaluate Job URL" Flow

A new prompt mode alongside "Add a job": the user pastes a job posting URL, the system fetches the full JD, scores fit against their profile, and returns a structured evaluation card. The user then confirms whether to add the job to pending — or discards it. No job is written without explicit confirmation.

This is distinct from "Add a job" (which writes immediately). Evaluate first, decide after.

### Retrieval Strategy

Many ATS platforms (Workday, iCIMS, SAP SuccessFactors) render job postings entirely in JavaScript. A plain `fetch()` returns an empty shell. The system works through a chain of fallbacks — the first two run on any platform including Vercel:

```
1. fetch(url)                         — fast; works for Lever, Ashby, Greenhouse, plain pages
        ↓ if empty or blocked
2. Brave Search for alternate URL      — search for the same role cross-posted on a fetchable board
        ↓ if alternate found
2a. fetch(alternate_url)              — fetch the accessible mirror; apply same open/closed check
        ↓ if still blocked or no alternate found
3. Playwright browser                  — handles Workday when ENABLE_PLAYWRIGHT_FALLBACK=true
        ↓
4. AI extraction + fit scoring         — structured output: role, salary, notes, fit score
        ↓ on user confirmation
5. Write to pending in jobs.json
```

**Step 2 is the Vercel-friendly recovery path.** Workday jobs are frequently cross-posted on Greenhouse, Lever, or Ashby — all plain-fetch-accessible. Brave Search finds the mirror using the company name (usually present in the Workday domain) and role title. This recovers a meaningful percentage of JS-blocked postings without Chromium. `BRAVE_SEARCH_API_KEY` is already used by the weekly job search script, so no new credentials are needed.

Limitations: Brave may return an expired cross-post or nothing at all (company posts exclusively on Workday). The alternate URL still goes through the same open/closed check before extraction.

### Playwright on Vercel (and other serverless platforms)

**Playwright cannot run on Vercel.** The Chromium binary exceeds the function bundle limit and the execution environment does not support spawning child processes. This is true of any serverless or edge platform.

Controlled by an env flag:

```
ENABLE_PLAYWRIGHT_FALLBACK=true    # self-hosted / local dev / VPS
ENABLE_PLAYWRIGHT_FALLBACK=false   # Vercel, Netlify, or any serverless deployment (default)
```

When `false` or unset, the route skips step 3 entirely. If steps 1–2 also failed to retrieve content, the UI surfaces: *"Content could not be retrieved automatically. Copy the job description text and paste it directly."*

### Streaming Status (SSE)

Playwright retrieval takes 5–15 seconds. The route streams progress via `text/event-stream` so the user sees live feedback instead of a hung spinner:

```
Fetching page…
Content looks incomplete — launching browser…
Page loaded. Extracting job description…
Scoring fit against your profile…
```

Each status line appears as it happens. The stream closes with the evaluation result.

### New Files

```
lib/job-fetcher.ts              — fetch → Playwright fallback, respects ENABLE_PLAYWRIGHT_FALLBACK
app/api/evaluate-job/route.ts   — SSE route, auth-guarded, calls job-fetcher + AI fit scoring
```

### Acceptance Criteria

- [x] Plain-fetch URLs (Lever, Ashby) return a populated evaluation card
- [x] Workday URLs with a cross-post on Greenhouse/Lever/Ashby return a populated evaluation card via the Brave Search fallback — no Playwright required
- [x] Workday URLs with no cross-post return a populated evaluation card when `ENABLE_PLAYWRIGHT_FALLBACK=true`
- [x] When `ENABLE_PLAYWRIGHT_FALLBACK=false` and Brave Search finds no alternate, the UI surfaces a paste-it-yourself fallback message — Playwright is never invoked
- [x] At least one SSE `status` event arrives before the `result` event on slow fetches
- [x] No job is written to pending without explicit user confirmation
- [x] Job detail view offers a notes-refresh-from-URL action (chat: "update notes from the posting") that uses the same retrieval path, with an Apply/Cancel confirm step before writing
- [x] Unauthenticated requests return 401 before any fetch is attempted
- [x] `ENABLE_PLAYWRIGHT_FALLBACK` is documented in the env var table

Shipped in PR #10, plus a content-quality follow-up fix (nav/mega-menu shells were being accepted as job descriptions on client-rendered career pages — see `lib/job-fetcher.ts` and `app/api/evaluate-job/route.ts`).

**Effort:** ~3 days

---

## M12 — Board Redesign (shipped this PR)

The board moved from a single-column table layout to a two-column layout with a persistent AI assistant rail, and the job tables became card-only.

- [x] Responsive layout: single column with the Deckhand assistant stacked on top (mobile), 2/3 board + 1/3 assistant from `md` up, sticky assistant rail that auto-sizes to content instead of forcing full viewport height
- [x] Header decluttered — removed the standalone "+ Add Job" button and the Scrape button/panel in favor of the assistant (Add Job already had its own URL-evaluate flow; scrape moved to a chat prompt, see M10)
- [x] Footer added — credits the original creator with a link to creativereason.com and a link to the MIT License
- [x] Header de-emphasizes the candidate's name — "DeckhandAI" is the prominent title, name is a small line underneath
- [x] Card view is now the only view for Applied/Prospects/Passed — removed the desktop-table/mobile-card split, added a compact per-section sort control, surfaced the AI fit-rationale on Prospect cards (previously desktop-table-only)
- [x] Show/Hide toggle for Applied/Prospects/Passed sections, and the Fit filter relocated into the Prospects card itself (it only ever applied to that section) — both persisted per user
- [x] `Button` component (`components/ui/button.tsx`) re-themed to the app's actual color tokens (was still the generic shadcn palette) and given a fully-rounded radius, press feedback, and a `loading` spinner; converted the app's standalone CTA buttons (Save/Cancel/Send/Approve/Generate/etc., ~55 buttons across 17 files) to use it. Toggle/filter/sort chip groups, dropdown menu rows, and inline table-row links (Edit/Remove/Dismiss) were intentionally left as-is — they're a different UI pattern, not action buttons.
- [x] Two real bugs fixed along the way: the assistant panel was auto-scrolling the whole page during chat activity (`scrollIntoView` was walking up the scroll-ancestor chain instead of scrolling its own message list), and asking the assistant to "evaluate" a job could silently add it straight to Prospects instead of Pending (tightened the system prompt to treat evaluating and filing as distinct actions)

**Effort:** absorbed into this PR

---

## M13 — Color / Accent Retheme (planned)

The board redesign (M12) surfaced how much of the UI still leans on the original slate/blue palette (`p-blue`, `p-accent`, etc. in `app/globals.css`) even after the `Button` component and card-view work. Next pass: rethink colors, accents, and callouts (fit badges, status badges, type badges, the amber scrape-review-queue treatment, chart/signal colors) as a deliberate palette rather than the incremental choices made slice-by-slice so far.

- [ ] Decide on and document the new palette in `app/globals.css`'s `@theme inline` block
- [ ] Reconcile the two token systems currently in play — the hand-rolled `p-*` tokens and the shadcn/OKLCH tokens (`--primary`, `--border`, etc.) used by `components/ui/*` — so `Button`, `Badge`, and `Accordion` all draw from one source
- [ ] Audit badge/callout colors (fit: strong/good/caution/weak, status: applied/screening/interview/offer/declined, type: remote/hybrid/local/contract) for consistency and accessibility (contrast) under both light and dark mode
- [ ] Apply across cards, the scrape-review-queue amber treatment, and chat UI accents

**Effort:** TBD — scoping pass needed before estimating

---

## M14 — AI Role Summary (planned)

A third, distinct piece of AI-generated context per job — separate from the user's own `notes` and from the fit-assessment `scoreRationale` — that concisely summarizes what the role actually is (scope, team, key responsibilities) in the candidate's terms. Surfaced in two places: on the job card (board view) and in the top bar of the job detail page, so the gist of a role is visible without opening notes or re-reading the full JD.

- [ ] Schema: add a new field (e.g. `aiSummary: string`) to the relevant job types in `lib/jobs.ts` and to `data/jobs.sample.json`; update `CLAUDE.md`'s jobs.json schema docs
- [ ] Decide the generation trigger — likely piggybacks on the existing evaluate-job flow (`app/api/evaluate-job/route.ts` already extracts company/role summaries for notes; a role summary could reuse that extraction rather than a second AI call) vs. a dedicated on-demand "Summarize this role" action for jobs added by other paths (chat `add_job`, scrape)
- [ ] Card UI: short (1–2 line, truncated) summary shown on the Applied/Prospect/Passed card, below the role title
- [ ] Job detail UI: summary shown in the top bar/header area of `app/job/page.tsx`, distinct from the Notes card
- [ ] Backfill story for existing jobs with no `aiSummary` — likely just render nothing until the user regenerates, no bulk migration

**Effort:** TBD — needs a design pass on the generation trigger before estimating

---

## Known Bugs

- [ ] **Edit modal section change discards notes** — if a user edits the notes field then changes the section dropdown in the job edit modal, the notes changes are lost (section change re-initializes form state). Verified still present in `components/JobFormModal.tsx`'s `onBoardChange` — not touched by the card-view/board redesign.
- [ ] **Moved-to-Passed job retains stale `status` field** — when a job moves from Applied to Passed, `app/api/jobs/route.ts`'s `normalizeJobForSection` never strips the old `status` value from the underlying record. The card-view rewrite means the Passed card no longer *renders* a status badge, so the original visible symptom ("shows Declined") likely no longer reproduces — but the stale field is still written to `jobs.json`, which is worth cleaning up regardless of whether it's currently user-visible.

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
| `ENABLE_PLAYWRIGHT_FALLBACK` | No | `true` to allow Playwright browser fetch for JS-rendered pages (self-hosted only — never set on Vercel or serverless) |
