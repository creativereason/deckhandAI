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

---

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
| 4 | Zod validation on `/api/jobs` | **Ready** — blocked on #1 |
| 5 | `IJobRepository` interface + service contract tests | **Ready** — blocked on #1, #4 |
| 6 | Scrape filter unit tests | **Ready** — blocked on #1 |
| 7 | `resolveJobType` unit tests | **Ready** — blocked on #1 |
| 12 | `table-sort.ts` unit tests — `nextSort`, `sortRows` | **Ready** — blocked on #1 |
| 13 | `job-signal.ts` unit tests — `getAppliedIcon`, `getProspectIcon`, `iconSortKey` | **Ready** — blocked on #1 |
| 14 | `score.ts` unit tests — fit scoring pure functions | **Ready** — blocked on #1 |
| 15 | Playwright e2e — happy path spec (`e2e/happy-path.spec.ts`) | **Ready** — blocked on #1 |
| 8 | Table deduplication — merge three tables into `JobTable` | **Ready** — blocked on #1 |
| 9 | `toSlug()` and `downloadBlob()` utilities | **Ready** — blocked on #1 |
| 10 | Rate limiting on `/api/generate` | **Ready** — blocked on #1, #3 |
| 11 | Stable job identity (UUID) — fix silent data loss on delete/move for duplicate company+role | **Ready** — blocked on #5 |

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
