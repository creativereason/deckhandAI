# deckhandAI — Claude Code Instructions

This file governs every agent working in this codebase. Read it before touching any code. It is the single source of truth for process, domain boundaries, test strategy, quality gates, and slice progress.

---

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
  "applied": [{ "company": "", "role": "", "status": "applied|screening|interview|offer|declined", "date": "YYYY-MM-DD", "salary": "", "notes": "", "url": "", "aiSummary": "" }],
  "prospect": [{ "company": "", "role": "", "fit": "strong|good|caution|weak", "salary": "", "notes": "", "url": "", "aiSummary": "" }],
  "local": [],
  "staffing": [],
  "passed": []
}
```

`aiSummary` (optional, all sections) is an AI-generated 1–2 sentence "at a glance" summary of the role and company — distinct from `notes` (fluid, updated by scrapes and the user) and `scoreRationale` (fit assessment). It is generated automatically for new additions (evaluate-job flow, chat `add_job`, manual add) and shown on board cards and in the job detail header. Backfill existing boards once with `pnpm backfill:summaries` (see `scripts/backfill-ai-summaries.mjs`).

## Architecture Notes

- Auth is session-based via `iron-session`
- Scraper uses Playwright; Chromium must be installed separately (`npx playwright install chromium`)
- AI generation proxies through `/api/generate` — API key stays server-side, never exposed to browser
- Any OpenAI-compatible endpoint works for AI generation (Anthropic, OpenAI, Ollama, custom)
- Jobs data lives in a private GitHub repo defined by `GITHUB_DATA_REPO` in `.env.local` — never in this repo
- Storage is selected by `DATA_BACKEND` (`github` default, or `supabase`; see `lib/data-backend.ts`). Jobs go through `lib/jobs-repository.ts` (`readJobs`/`writeJobs`); config, profile and scrape-targets go through `lib/data-store.ts`. Nothing outside those two modules and `lib/github.ts` may call `githubRead`/`githubWrite`.
- Supabase: `jobs` table (one row per job, `section` column, UUID `id`) and `documents` table, schema in `supabase/migrations/`. RLS is on with no policies; the server uses the service-role key (`lib/supabase.ts`) and it never reaches the browser. Jobs are never physically deleted on Supabase: `writeJobs` soft-deletes by setting `deleted_at`, reads filter those rows out, and the service role has no DELETE privilege on `jobs` (migration `20261113120000_soft_delete_jobs.sql`). Scripts that dedupe pass `readBoard({ includeDeleted: true })` so a removed job is not re-added. On Supabase `readJobs` must throw on failure (no empty-board fallback) because `writeJobs` diffs against stored rows and would delete them. Import existing data with `pnpm migrate:supabase` (`lib/jobs-import.ts` plans it, `lib/jobs-mapping.ts` maps rows).
- `/api/jobs` request bodies are validated by `lib/job-schemas.ts` (`PostJobBody`, `PatchJobBody`, `DeleteJobBody`): known fields are type-checked, unknown fields pass through to the row's `extra`, values are never transformed, and a bad body is a 400 with `error` (string) and `issues` (field paths), never a 500.
- Single-job operations (`addJob`, `getJob`, `saveJob`, `archiveJob` in `lib/jobs-repository.ts`, logic in `lib/job-ops.ts`) write only the one row on Supabase, so overlapping writers cannot drop each other's jobs; on GitHub they fall back to read-modify-write because the JSON has no ids. `/api/jobs` POST/PATCH/DELETE use them and accept an optional `id` (else section + company + role). `updateJobs` applies one set of updates to many jobs with one row write (the chat's `update_jobs`); the chat tools use these and read the whole board only for `list_jobs` and `detect_ghost_jobs`. `patchJobs` applies a different update to each of many jobs with one row write, merged onto the stored job at write time (used by score-pending, so slow AI scoring cannot overwrite edits made meanwhile). The scrape review route (approve, reject, dismiss) and score-pending use these too. `addJobs` inserts many jobs at once (the scraper saves its finds this way after the long scrape, never writing back the board it read at the start). No application code writes the whole board any more: `readJobs` is for reads, and `writeJobs` survives only as the GitHub backend's fallback inside `lib/jobs-repository.ts`. The board, job detail page and edit modal send the job's `id` (when it has one) with every move, edit and dismiss. The detail page URL carries `id` (`lib/job-detail.ts`: `jobDetailHref`, `findJobForDetail`); links without one fall back to company + role.
- The standalone `scripts/*.mjs` honor `DATA_BACKEND` through `scripts/lib/supabase-data.mjs`, which is dependency-free (plain `fetch` to PostgREST) so a bare checkout can run them. Its row mapping mirrors `lib/jobs-mapping.ts`; `lib/__tests__/scripts-supabase-data.test.ts` fails if they drift, so change both together. Known gap: `scrape-careers.mjs` and `scrape-staffing.mjs` still insert into `prospect`/`local`/`staffing` rather than `pending`, which predates the "scraping writes to pending only" invariant.

---

## Searching for Jobs via Indeed MCP

Use the Indeed MCP tool (`mcp__claude_ai_Indeed__search_jobs`) to search for qualifying roles. Your search criteria (target titles, location, salary floor, etc.) should come from `data/config.json`.

Typical search patterns:
- Search by role title + "remote"
- Search by company name alone for firms where keyword+company returns no results
- Search by role title + city/metro for local or hybrid roles

### Adding found jobs to the tracker

After searching, add qualifying jobs to the `pending` section of `jobs.json` in the remote data repo. The pending section holds unreviewed jobs awaiting triage in the UI.

**Before writing any job:** fetch the job URL and confirm the posting is open. Do not add a job if:
- The URL returns a 404 or redirects to a careers listing page instead of the specific role
- The page content indicates the role is closed ("this position has been filled", "job no longer available", "posting has expired", or similar)
- The URL is a generic company careers page with no job-specific path

If the posting cannot be confirmed open, skip it — do not add it to pending.

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
  "notes": "Populate from the JD: location/work model, team size, scope, key responsibilities, must-have requirements, and anything that informs fit or comp negotiation.",
  "scrapeGroup": "remote | local",
  "scrapeDate": "YYYY-MM-DD"
}
```

**notes field content:** Pull from the full job description. Include: work model and location specifics, team size and reporting structure, role scope and key responsibilities, must-have requirements (years of experience, tool requirements, domain expectations), and anything else that informs fit assessment or comp negotiation. Do not leave notes empty — a pending job with no JD context is not actionable for triage.

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
4. For qualifying roles, fetch the job detail URL. Skip the role if the URL returns a 404, redirects to a generic careers page, or the page copy indicates the role is closed ("no longer available", "position filled", "posting expired"). If the posting is open, extract salary if listed, then populate `notes` from the full JD: work model, team size, reporting structure, role scope, key responsibilities, must-have requirements (years, tools, domain). A pending job with empty notes is not triageable — do not skip this step.
5. Add to the `pending` section of jobs.json using the same GitHub API write flow as the Indeed pass

Commit message convention: `"Add N jobs to pending queue via WebSearch pass"`

**Tip:** `site:jobs.ashbyhq.com` and `site:jobs.lever.co` queries are the most reliable. Built In results frequently include closed or expired listings — always fetch and verify before adding.

---

## What You Are (Quality Agent)

You are a quality agent. Your job is not to ship features faster — it is to make every feature worth shipping. You enforce TDD, SOLID, Clean Code, and domain boundaries at every step.

You are also a teacher. When you write a test, say why that test comes before the next one. When you refactor, name the principle. When asked to "just add it quick," propose the failing test first and explain why that order matters.

The goal is a codebase where the next contributor understands not just what the code does, but why it is shaped the way it is.

---

## Token Routing

This file is always loaded. Use it to route tasks without re-reading the whole codebase.

| Task | Load | Skip |
|------|------|------|
| Unit test for a `lib/` function | That function's file only | All of `app/`, `components/` |
| Green implementation | The failing test + the relevant interface | Unrelated `lib/` files |
| SOLID review | Changed files + the SOLID section below | Test files |
| New API route | `lib/auth.ts`, `lib/jobs.ts`, `app/api/jobs/route.ts` | UI components |
| UI component | That component's direct imports only | `lib/`, `app/api/` |
| Scraping issue | `lib/scrape-filters.ts`, `lib/scrape-run.ts`, `lib/scrape-targets.ts` | Everything else |
| Security review | `lib/auth.ts`, all `app/api/*/route.ts`, `middleware.ts` | UI components |

If a task spans more than three files, stop and ask whether this is one slice or two.

---

## Domain Map

Five bounded contexts. Do not let concerns cross these boundaries.

### Job Tracking
**Files:** `lib/jobs.ts`, `app/api/jobs/route.ts`  
**Types:** `AppliedJob`, `ProspectJob`, `PassedJob`, `PendingJob`, `JobsData`, `JobSection`, `JobStatus`, `JobFit`, `JobType`  
**Invariant:** Every job is identified by `jobKey(company, role)` — the canonical composite key with `::` separator. Never concatenate company and role without using `jobKey()`.  
**Open:** Repository interface (`IJobRepository`), Zod schemas, auth middleware guard.

### Scraping
**Files:** `lib/scrape-filters.ts`, `lib/scrape-run.ts`, `lib/scrape-targets.ts`, `app/api/scrape/`  
**Invariant:** Scraping writes to `pending` only. Human review happens before anything enters `prospect` or `applied`.  
**Open:** `ScrapeResult` domain type, unit tests for filter functions.

### AI Generation
**Files:** `lib/prompts.ts`, `lib/model.ts`, `app/api/generate/route.ts`, `app/api/tailor-resume/route.ts`, `app/api/score-fit/route.ts`  
**Invariant:** AI calls originate in API routes only. The API key never reaches the browser. `/api/generate` enforces a per-session request budget.  
**Open:** Rate limiting, generation service interface.

### Profile
**Files:** `lib/profile.ts`, `lib/profile-server.ts`, `app/api/profile/route.ts`  
**Invariant:** Profile data is the source of truth for all AI generation context.  
**Open:** `CandidateProfile` type, Zod validation schema.

### Auth
**Files:** `lib/auth.ts`, `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/middleware.ts`  
**Invariant:** No API route is accessible without `session.authenticated === true`. This is enforced by `middleware.ts`, not by individual route handlers. `COOKIE_SECRET` must be a non-empty string — validated at startup, not at request time.  
**Open:** `middleware.ts` (not yet created), startup validation.

---

## TDD Protocol

### The cycle

Every feature begins with a failing test. Every test is the minimum assertion that makes the next design decision visible.

```
Red     → Write one failing test. Run it. Confirm non-zero exit code.
Green   → Write the minimum code that makes it pass. Hardcoded is correct if it passes.
Refactor → Apply SOLID and Clean Code. Run tests. Must still pass.
Commit  → git commit -m "test+impl: [ZOMBIES case] — [one sentence on what this proved]"
Switch roles. Repeat.
```

**Minimum means minimum.** Do not add code for cases no test yet covers. Do not generalize. Do not add error handling that no test requires. Let future tests force generalization.

### ZOMBIES test ordering

Write tests in this order. Do not skip letters. Do not write M before O.

| Letter | What to assert |
|--------|---------------|
| **Z** — Zero | Empty input, null, undefined, empty array or string |
| **O** — One | Single valid input, the simplest possible happy path |
| **M** — Many | Multiple items, iteration, accumulation |
| **B** — Boundary | Edge of valid range, idempotency, the case that proves correctness |
| **I** — Interface | The function signature makes sense to a caller who doesn't know the implementation |
| **E** — Exception | Invalid input, missing required fields, error propagation |
| **S** — Simple | End-to-end happy path through the full feature |

Each letter reveals something the previous letter cannot. The ordering is not arbitrary.

### Hypothesis-Driven Design

A test is a hypothesis made executable. The `it()` description is the hypothesis. The body is the experiment. The assertion is the verdict.

**Syntax** (adapted from C# xUnit's `Method_Condition_Expected` naming convention):

```typescript
describe('[function or system under test]', () => {
  it('[returns | throws | calls] [expected] when [condition]', () => {
    // Arrange — establish the condition stated in it()
    
    // Act — invoke exactly what is named in describe()
    
    // Assert — verify exactly the outcome stated in it()
  })
})
```

The `it()` string is not a label — it is a falsifiable claim. Before writing the body, read the string aloud as a sentence. If it could not possibly be wrong, the test is not a hypothesis.

**Applied to this codebase:**

```typescript
describe('getAppliedIcon', () => {
  it('returns the ghost icon when isGhost is true', () => {
    // Arrange
    const job = { isGhost: true, status: 'applied' as const, date: '', notes: '' }

    // Act
    const icon = getAppliedIcon(job)

    // Assert
    expect(icon).toBe('👻')
  })
})
```

For conditional branching, nest a second `describe` as the `when`:

```typescript
describe('getAppliedIcon', () => {
  describe('when the job is marked as a ghost', () => {
    it('returns the ghost icon regardless of status', () => { ... })
    it('returns the ghost icon regardless of date', () => { ... })
  })

  describe('when the application was declined', () => {
    it('returns the red icon', () => { ... })
  })
})
```

**When the test fails unexpectedly:** the hypothesis was wrong, not the code. Re-read the `it()` string before touching the implementation. A wrong hypothesis corrected before a line of production code changes is the highest-value outcome in TDD.

**When the test passes before any implementation:** the claim was trivially true. Delete it. Write a harder one.

### Test file locations

```
lib/__tests__/scrape-filters.test.ts    ← pure function unit tests
lib/__tests__/table-sort.test.ts
lib/__tests__/job-signal.test.ts
lib/__tests__/jobs.test.ts              ← resolveJobType, jobKey; I/O tested separately
app/api/__tests__/jobs.test.ts          ← service contract tests
e2e/happy-path.spec.ts                  ← Playwright happy path
```

### Test layers

**Unit tests** — Pure functions. No mocks. No network. Deterministic. Target: `lib/` functions.

**Service contract tests** — API routes tested against their HTTP contract. Mock `IJobRepository`, not the HTTP layer. Assert status codes, response shape, and error messages. Never assert internal implementation details.

**Interface tests** — Component behavior given specific props. Uses React Testing Library. Does not test styling.

**E2E tests** — Playwright. One test per user-visible workflow. Mocks nothing. Uses the running app.

---

## SOLID

Apply after every Green step. Name the principle when you apply or refuse to apply it.

**S — Single Responsibility.** One reason to change. If the database changes and the UI changes both affect the same file, split it.

Current violations to fix in later slices:
- `lib/jobs.ts` — types + business logic + I/O. Split into `lib/jobs/types.ts`, `lib/jobs/domain.ts`, `lib/jobs/repository.ts`.
- `app/api/jobs/route.ts` — HTTP, normalization, and I/O. Extract normalization to domain layer.
- `app/page.tsx` — six responsibilities. Decompose in Slice 8.

**O — Open/Closed.** Adding a new `JobSection` should not require modifying existing code. It currently requires changes in six places. The fix is a configuration map, not a switch statement.

**L — Liskov Substitution.** When `IJobRepository` exists, any implementation must pass the same contract tests as the real implementation. Write contract tests first, then make both implementations pass them.

**I — Interface Segregation.** Components receive only what they need. `AppliedTable` does not need `staffing` or `local` data. Route handlers do not accept `Record<string, unknown>` — they accept the specific type for the operation.

**D — Dependency Inversion.** Route handlers depend on `IJobRepository`, not on `readJobs()`/`writeJobs()`. This is what makes service contract tests possible without real I/O.

---

## Clean Code

These are not preferences — they are gates.

- **No function longer than 20 lines.** If it's longer, it has more than one job.
- **No parameter list longer than 3.** Use a typed options object.
- **No duplicated logic.** Written twice: extract it. Found three times: it's a library function.
- **Names reveal intent.** `handleMove` is fine. `fn`, `data`, `result`, `temp` are not.
- **No comments that restate the code.** A comment above a loop that says "loop through jobs" adds no information. Comments explain WHY — a non-obvious constraint, a workaround for a specific bug, a subtle invariant.
- **No `any`.** Use `unknown` and narrow it, or use the specific type.

---

## Security Invariants

Block any proposed change that violates these. Open an issue if the fix is out of scope for the current slice.

1. Every API route checks `session.authenticated` before executing. Enforced by `middleware.ts`. Not by individual route handlers.
2. Every request body is validated with Zod before use. No `as SomeType` cast on user-supplied input.
3. `COOKIE_SECRET` is validated as a non-empty string at server startup. A missing secret throws — it does not silently use `undefined`.
4. No AI provider API key in any client-side file. All generation goes through `/api/generate`.
5. `/api/generate` enforces a per-session request limit. Default: 20 requests per hour. Configurable via `GENERATE_RATE_LIMIT`.

---

## Quality Gates

All must pass before any PR is created. Run in order.

```bash
pnpm tsc --noEmit          # type check — no errors
pnpm lint                  # ESLint — no warnings
pnpm test                  # Vitest — all tests pass
pnpm test:coverage         # ≥80% lines on changed files
pnpm e2e                   # Playwright — happy path green
```

Do not suppress warnings. Do not add `// eslint-disable` unless the finding is a confirmed false positive, documented inline with the specific reason.

---

## Slice Backlog

| # | Slice | Status |
|---|-------|--------|
| 1 | Test infrastructure (Vitest + Playwright) | **Done** |
| 2 | `jobKey()` — fix composite key, no separator bug | **Done** |
| 3 | Auth middleware — enforce session on all routes | **Ready** — blocked on #1 |
| 4 | Zod validation on `/api/jobs` | **Done** — `lib/job-schemas.ts`; other routes (`scrape/review`, `chat`, config) still unvalidated |
| 5 | `IJobRepository` interface + service contract tests | **In progress** — all callers use single-job ops; a formal `IJobRepository` interface with contract tests and Zod (#4) remain |
| 6 | Scrape filter unit tests | **Ready** — blocked on #1 |
| 7 | `resolveJobType` unit tests | **Ready** — blocked on #1 |
| 12 | `table-sort.ts` unit tests — `nextSort`, `sortRows` | **Ready** — blocked on #1 |
| 13 | `job-signal.ts` unit tests — `getAppliedIcon`, `getProspectIcon`, `iconSortKey` | **Ready** — blocked on #1 |
| 14 | `score.ts` unit tests — fit scoring pure functions | **Ready** — blocked on #1 |
| 15 | Playwright e2e — happy path spec (`e2e/happy-path.spec.ts`) | **Ready** — blocked on #1 |
| 8 | Table deduplication — merge three tables into `JobTable` | **Ready** — blocked on #1 |
| 9 | `toSlug()` and `downloadBlob()` utilities | **Ready** — blocked on #1 |
| 10 | Rate limiting on `/api/generate` | **Ready** — blocked on #1, #3 |
| 11 | Stable job identity (UUID) — fix silent data loss on delete/move for duplicate company+role | **Done** — Supabase rows keyed by id end to end; UI, routes, chat and the in-app scraper use it, and the standalone scripts insert rows without rewriting the board (the JSON backend has no ids and still matches on company + role) |
| 16 | "Evaluate Job URL" flow — fetch → Playwright fallback, streaming status, AI fit scoring, user-confirm before write to pending | **Ready** — blocked on #5, #10 |
| 17 | Styled PDF resume export (Playwright + HTML/CSS template) — `stylePdfEnabled` config flag, `resume-template.ts`, `resume-pdf.ts`, `/api/export/resume-pdf` route | **Done** |
| 18 | Inbox as a separate view — hide/show the pending queue instead of forcing it above the board | **Done** |
| 19 | Restore and browse deleted jobs — UI for the soft-delete markers (`deleted_at`) | **Ready** |
| 20 | Job event log — `job_events` audit table recording who changed what, when | **Ready** — blocked on #5, #11 |
| 21 | Agent identities and scoped keys — `agents` table, hashed per-agent keys, permission scopes | **Ready** — blocked on #20 |
| 22 | Agent API — `/api/agent/v1` job CRUD (soft-delete only), add-to-pending, triage, evaluate, Zod-validated | **Ready** — blocked on #4, #5, #11, #21 |
| 23 | MCP server — `/api/mcp` exposing the Agent API as tools for Grokbot, Muse, Duet | **Ready** — blocked on #22 |
| 24 | Route scrapers through `pending` via the Agent API — fix the invariant gap | **Ready** — blocked on #22 |
| 25 | Job link check — verify a job's URL is valid and still open, on any board section or the inbox, with a visible status | **Ready** — reuses `lib/job-fetcher.ts` |
| 26 | Agent-assisted link repair — find the right posting for a bad URL and propose a fix for the user to confirm | **Ready** — blocked on #25, #22 |
| 27 | UI overhaul — visual and layout redesign of the board, inbox and detail views | **Deferred** — scope after Slices 18 and 22; no spec yet |

**Starting a slice:** Load only the files listed in the Token Routing table for this task type. Write the Z test. Run it. Confirm it fails. Then proceed.

**Closing a slice:** All gates pass. PR body includes ZOMBIES coverage summary (one line per letter) and acceptance criteria status. Update this table.

---

## Common Patterns

**Creating a utility function:**
```typescript
// lib/utils.ts
export function toSlug(company: string, role: string): string {
  return `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
```
Write the Z test first. Confirm empty strings return an empty string (or `""`, not `"-"`). Then O, B.

**Creating a repository interface:**
```typescript
// lib/jobs/repository.ts
export interface IJobRepository {
  read(): Promise<JobsData>;
  write(data: JobsData): Promise<void>;
}
```
Write contract tests against this interface using a mock implementation. Then make the real implementation pass the same tests.

**Validating a request body:**
```typescript
// At the top of a route handler
const parsed = MySchema.safeParse(await req.json());
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
}
const { section, job } = parsed.data;
```
Write the Z test first (empty body → 400). Then valid input (201). Then malformed field (400 with field path).

---

## Slice 16 — "Evaluate Job URL" Flow

### Problem

Many ATS platforms (Workday, iCIMS, SAP SuccessFactors) render job postings entirely in JavaScript. A plain `fetch()` returns an empty shell or a redirect. The user has no way to paste a URL and get an AI evaluation without manually copying the JD text.

### Goal

A new chat-style prompt: **"Evaluate a job"**. The user pastes a URL. The system fetches the full JD, scores fit against their profile, and returns a structured evaluation card. The user then confirms whether to add the job to pending — or discards it.

This is distinct from "Add a job" (which writes immediately). Evaluate first, write only on confirmation.

### Retrieval Strategy

```
1. fetch(url)                         ← fast; works for Lever, Ashby, Greenhouse, plain pages
        ↓ if empty or blocked
2. Brave Search for alternate URL      ← search for the same role cross-posted on a fetchable board
        ↓ if alternate found
2a. fetch(alternate_url)              ← fetch the accessible mirror; same open/closed check applies
        ↓ if still blocked or no alternate found
3. Playwright browser                  ← handles Workday when ENABLE_PLAYWRIGHT_FALLBACK=true
        ↓
4. AI extraction + fit scoring         ← structured output: role, salary, notes, fit score
        ↓ on user confirmation
5. Write to pending in jobs.json       ← same GitHub API write flow as other passes
```

Steps 1 and 2 run on any platform including Vercel — no Chromium needed. `BRAVE_SEARCH_API_KEY` is already used by `scripts/job-search.mjs`; no new credentials required. Step 3 is self-hosted only.

### Playwright on Vercel

**Playwright cannot run on Vercel** (or any other serverless/edge platform). The Chromium binary is too large for the function bundle, and the execution environment does not support spawning child processes.

Control this with an env flag:

```
ENABLE_PLAYWRIGHT_FALLBACK=true   # self-hosted / local dev only
ENABLE_PLAYWRIGHT_FALLBACK=false  # Vercel or any serverless deployment
```

When `ENABLE_PLAYWRIGHT_FALLBACK` is `false` or unset, the route skips step 2 entirely and returns a `retrieval_method: "fetch_only"` flag in the response. The UI surfaces a warning: *"Browser-based retrieval is disabled. If the page content looks incomplete, copy the job description text and paste it directly."*

This flag must be checked in `lib/job-fetcher.ts` (new file), not inline in the route handler, so it can be tested without spinning up a server.

### Streaming Status (SSE)

Retrieval can take 5–15 seconds when Playwright is involved. The route streams progress via `text/event-stream` so the user sees feedback rather than a hung spinner:

```
event: status  data: Fetching page…
event: status  data: Content looks incomplete — launching browser…
event: status  data: Page loaded. Extracting job description…
event: status  data: Scoring fit against your profile…
event: result  data: { ...evaluation payload }
```

The UI renders each status line as it arrives, then replaces the stream with the evaluation card on the `result` event.

### New Files

```
lib/job-fetcher.ts              ← fetch → Playwright fallback logic, respects ENABLE_PLAYWRIGHT_FALLBACK
app/api/evaluate-job/route.ts   ← SSE route, auth-guarded, calls job-fetcher + AI scoring
lib/__tests__/job-fetcher.test.ts
app/api/__tests__/evaluate-job.test.ts
```

### Token Routing for This Slice

| Task | Load | Skip |
|------|------|------|
| Implement `lib/job-fetcher.ts` | `lib/scrape-run.ts` for Playwright patterns | `app/`, `components/` |
| Implement the route | `lib/auth.ts`, `lib/job-fetcher.ts`, `app/api/generate/route.ts` for SSE pattern | All other routes |
| UI evaluation card | The component's own file + `lib/score.ts` for fit display | `lib/`, other components |

### Acceptance Criteria

- `ENABLE_PLAYWRIGHT_FALLBACK=false`: route returns valid result for plain-fetch-accessible URLs; blocked URLs get an explicit `retrieval_limited` flag, no Playwright is invoked.
- `ENABLE_PLAYWRIGHT_FALLBACK=true`: Workday URL returns populated `notes` and a fit score.
- SSE: client receives at least one `status` event before the `result` event on slow fetches.
- No job is written to pending without an explicit user confirmation action after seeing the evaluation card.
- Job detail view offers a "Fetch more details" action that uses the same retrieval path to enrich notes before generating or scoring.
- Auth guard: unauthenticated request returns 401 before any fetch is attempted.

---

## Slice 18 — Inbox as a separate view

### Problem

`ScrapeReviewQueue` renders inline above the board whenever `jobs.pending` is non-empty (`app/page.tsx`). With a large queue (67 items on the author's board) the user must scroll past the whole inbox to reach their applied jobs and prospects, and there is no way to put it away.

### Goal

The inbox is its own view. The user chooses to open it; the board is the default and is never pushed down by it.

### Behavior

- The board view shows the existing "N pending review" count in the header as the entry point (with the NEW badge), and a clear "Inbox" control that opens the inbox view.
- The inbox view shows only the `ScrapeReviewQueue`; a control returns to the board. Triage actions (accept to prospect, pass, etc.) behave exactly as today.
- The choice persists for the session (and across reloads) — a per-user preference, not stored in the jobs data. Default is the board.
- An empty inbox hides the control's badge; it does not disappear entirely.

### Acceptance Criteria

- With pending jobs present, the board's first content is the board sections, not the queue.
- Opening the inbox shows every pending job; triaging one updates the header count without leaving the view.
- Reloading keeps the last-selected view.
- Interface tests (React Testing Library) cover: default view, switching to the inbox, switching back, empty inbox. No change to `/api/jobs` is required.

### Open

Resolved: a `?view=inbox` URL on `/` rather than a separate `/inbox` page. A second page would have had to duplicate the data loading, header, chat and modals owned by `app/page.tsx`. The URL is the source of truth (`useBoardView`), so reload, shared links and the back button all agree; a fresh visit to `/` is the board.

## Slice 19 — Restore and browse deleted jobs

### Problem

Jobs are soft-deleted (`deleted_at`) and never removed, but nothing in the UI can see them. A job removed by mistake, or by an agent, can only be recovered with SQL.

### Goal

A "Deleted" view lists soft-deleted jobs (newest first, with when they were deleted and, once Slice 21 lands, by whom) and offers Restore, which clears `deleted_at` and returns the job to its section.

### Acceptance Criteria

- A restored job reappears in its original section and position-independent order, with its original fields intact and the same id.
- Deleted jobs never appear on the board, in counts, or in exports.
- Restoring requires a repository method (`restore(id)`), not a whole-board write; depends on Slice 5/11.
- Hard purge is intentionally not offered anywhere in the UI.

---

## Slices 20–24 — Agent access (event log, identities, API, MCP)

### Problem

Agents (Grokbot, Muse, Duet) and scheduled scripts need to add jobs and help triage the board. Today the only way in is the Supabase service-role key or the GitHub token: full access, no per-agent identity, no record of who did what, and no way to revoke one agent without rotating everything. Nothing in code enforces "scraping writes to `pending` only" — two scripts already break it.

### Goal

A gateway with narrow, validated operations. Agents authenticate with their own revocable key and can do only what their scope allows. Every change is recorded. The MCP server is a thin wrapper over the same operations, so there is one implementation of the rules.

```
agent ──MCP / HTTP──▶ /api/mcp, /api/agent/v1 ──▶ IJobRepository ──▶ Supabase
                       (key → agent → scopes)      (+ job_events)
```

The browser never holds an agent key, and agents never hold the Supabase key.

### Slice 20 — Job event log

- `job_events(id, job_id, actor, action, before jsonb, after jsonb, created_at)`; `actor` is `user`, `scraper`, or an agent name. Append-only: no UPDATE or DELETE grant for the service role.
- Written by the repository on every create, edit, move, evaluate, soft-delete and restore, in the same transaction as the change. Unchanged writes record nothing.
- Powers "who deleted this?" in Slice 19.

### Slice 21 — Agent identities and scoped keys

- `agents(id, name, key_hash, scopes text[], created_at, revoked_at, last_used_at)`. Keys are shown once on creation, stored only as a hash, and compared in constant time. Revoking sets `revoked_at`.
- Scopes, each independent:

| Scope | Allows |
|-------|--------|
| `jobs:read` | list and get jobs, read the board |
| `jobs:add_pending` | create a job in `pending` only (never another section) |
| `jobs:edit` | change notes, `aiSummary`, score rationale, fit |
| `jobs:triage` | move a job between sections, including out of `pending` |
| `jobs:evaluate` | run URL evaluation / fit scoring (spends AI budget) |
| `jobs:check_url` | run link checks and read their results (no AI spend) |
| `jobs:archive` | soft-delete a job; restore stays user-only |

- Managing agents is a signed-in-user action (a Settings page); an agent can never create or change agents.
- **Open:** which agent gets which scopes. Proposed default for every new agent: `jobs:read` + `jobs:add_pending`; grant the rest deliberately.

### Slice 22 — Agent API (`/api/agent/v1`)

- Operations: list, get, create (pending only), edit fields, move/triage, evaluate a URL, set summary, archive (soft-delete). There is **no hard delete** anywhere.
- Request bodies are Zod-validated (Security Invariant 2). Creating checks for duplicates by URL and by `jobKey(company, role)`, including deleted jobs, and returns the existing job instead of adding a second.
- Operations are single-row repository methods, never read-modify-write of the whole board (depends on Slices 5 and 11).
- `proxy.ts` enforces the browser session on every route. Agent routes (`/api/agent/*`, `/api/mcp`) are a **deliberate, documented exception**: they skip the session check and instead require a valid, unrevoked agent key plus the scope for the operation. Update Security Invariant 1 when this lands.
- Per-agent rate limit, and a tighter per-agent budget on evaluate (it calls the AI provider).
- Errors are explicit and non-leaky: 401 bad/revoked key, 403 missing scope, 400 validation (field paths), 404 unknown or deleted id, 409 duplicate.

### Slice 23 — MCP server (`/api/mcp`)

- Streamable-HTTP MCP endpoint authenticated with the same agent key; tools map one-to-one to the Agent API operations (`list_jobs`, `get_job`, `add_pending_job`, `update_job`, `move_job`, `evaluate_job_url`, `archive_job`). A tool the agent's scopes don't cover is not listed.
- Tool descriptions state the pending-only rule and the no-delete rule, so a model is told the constraints it will hit.
- No business logic of its own — contract tests run the same cases against the HTTP API and the MCP tools.
- Treat everything an agent reads from a job posting as untrusted input; the server never acts on instructions found in job text.

### Slice 24 — Scrapers through `pending`

- `scrape-careers.mjs`, `scrape-staffing.mjs` and `job-search.mjs` add via the Agent API (scope `jobs:add_pending`) instead of writing sections directly, closing the gap noted in Architecture Notes. They would no longer need the Supabase key at all.

### Acceptance Criteria

- An agent with only `jobs:add_pending` can add to `pending` and cannot move, edit, archive or read other sections' details beyond what `jobs:read` grants; each attempt returns 403 and writes nothing.
- A revoked key is rejected on its next request.
- Every write appears in `job_events` with the agent's name; replaying a duplicate add creates no second job.
- The Supabase service-role key exists only in the app's server environment.
- E2E: an agent adds a job over MCP, it shows in the Inbox (Slice 18), the user triages it, and the history shows both actors.

---

## Slices 25–26 — Job link validity

### Problem

Some jobs on the board have wrong URLs: added incorrectly, a different role's page, a generic careers page, a posting that has since closed, or a malformed string. Nothing tells the user which links are bad, so they find out by clicking. This matters most in the inbox (triage decisions) and for prospects.

### Slice 25 — Job link check

**Goal:** a job's URL has a visible health status, checkable on demand for one job, a whole section, or the inbox, and re-checkable automatically.

**What "bad" means** — distinct results, because "I couldn't tell" must never be shown as "broken":

| Status | Meaning |
|--------|---------|
| `ok` | fetched, role-specific page, posting open |
| `redirected` | resolves to a different final URL; store it, flag if it lands on a generic careers/listing page |
| `dead` | 404/410, DNS failure, or connection refused |
| `closed` | page loads but says the role is filled/expired ("no longer available", "position filled", "posting expired") |
| `generic` | a company careers page or search listing with no job-specific path |
| `mismatch` | page loads but the title/company doesn't match the stored role |
| `invalid` | not a parseable http(s) URL |
| `unverified` | blocked by bot protection or JavaScript-only (`retrieval_limited`); status unknown |

These are the same open/closed rules CLAUDE.md already applies before an agent adds a job; the check turns them into code in `lib/` instead of prose.

**Design:**
- A pure classifier (`lib/link-check.ts`): given the fetch result and the stored job, returns a status and a one-line reason. Fully unit-testable with fixture pages; no network in the tests.
- Reuses `lib/job-fetcher.ts` for retrieval (fetch → Brave → optional Playwright). Playwright stays self-hosted-only (`ENABLE_PLAYWRIGHT_FALLBACK`).
- Stored on the job: `url_status`, `url_checked_at`, `url_final`, `url_check_note` (migration; columns, not `extra`, so the board can filter on them).
- Only the latest result is kept: each check overwrites the previous one. No history table and no dependency on the event log (Slice 20).
- Written only by a dedicated single-purpose repository method (`recordLinkCheck(id, result)`) that touches just the `url_*` columns. They are not part of the whole-board read/diff/write mapping, so a stale board read can never overwrite a fresher check result.
- Editing a job's URL clears the `url_*` fields in the same write, so a status never describes a URL that is no longer there.
- UI: a status badge on cards and in the detail view, a "Check link" action per job, a "Check all" action on the inbox and each section, and a "broken links" filter. `unverified` is styled as neutral, not as an error.
- Add-time: a job whose URL is `invalid` is rejected by validation (Zod) at create/edit; every other status is allowed and checked afterwards, since a slow check must not block adding.
- Re-check: on demand, plus a scheduled sweep of `pending` and `prospect` (not `applied`/`passed`, where a closed posting is normal and not a problem). Re-check interval configurable; nothing is checked more than once per interval.
- Link checks may be requested by agents (scope `jobs:check_url`, Slice 23 tool `check_job_url`).

**Security and manners** (the server fetches user- and agent-supplied URLs):
- SSRF guard: only `http`/`https`; resolve the host and refuse loopback, private, link-local and cloud-metadata addresses, and re-check after every redirect; cap redirects, response size and time.
- Per-host concurrency and delay so a "Check all" on 67 jobs doesn't hammer one ATS; identify with a clear User-Agent; honor 429/`Retry-After`.
- Page text is untrusted: it is classified, never executed or followed as instructions.

**Acceptance Criteria:**
- Each status above has a fixture-based test; `unverified` is returned (not `dead`) for a blocked or JS-only page.
- A URL pointing at `localhost`, a private IP, or redirecting to one is refused and never fetched.
- "Check all" in the inbox updates statuses without leaving the view and respects per-host limits.
- A job whose link was checked shows its status and time; a stale or never-checked job shows that too.
- Checking never changes a job's section, URL or notes — only the `url_*` fields.
- Saving a board edit never changes a job's `url_*` fields (unless its URL changed, in which case they are cleared), and a link check never changes anything else.

### Slice 26 — Agent-assisted link repair

**Goal:** when a link is `dead`, `generic`, `closed` or `mismatch`, an agent tries to find the correct posting and **proposes** it; the user confirms.

**Flow:** search by company + role (Brave, the same source Slice 16 uses, and the company's ATS domains from `scrape-targets`) → fetch each candidate → run the Slice 25 classifier → accept only candidates that are `ok` with a matching title/company → present the best match as a proposed URL with the evidence.

**Rules:**
- Never overwrite a URL silently. The proposal is stored (`url_proposal` with its evidence) and shown in the UI; the user accepts or dismisses. An agent with `jobs:edit` may accept only if the user has explicitly enabled that for the agent.
- If no verified candidate is found, say so; do not guess. A `closed` posting is reported as closed, not "repaired" to a different job.
- Every accepted or dismissed proposal is recorded in `job_events` (Slice 20).
- Exposed over the Agent API and MCP (`propose_url_fix`), under `jobs:evaluate` because it spends search and AI budget, with the per-agent budget from Slice 22.

**Acceptance Criteria:**
- Given a job with a generic careers URL and a findable specific posting, a proposal appears with the new URL and why it matched.
- Given a closed posting, no replacement is proposed and the job is marked `closed`.
- Accepting a proposal updates the URL, re-checks it, and logs the change; dismissing keeps the old URL and does not propose the same candidate again.

### Open

- Whether closed `prospect` jobs should offer one-click "pass" (move to `passed`) after the check, or leave triage to the user.
- Re-check cadence and which sections the scheduled sweep covers (proposed: `pending` and `prospect`, weekly).
