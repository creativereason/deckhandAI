# Quality Agent — deckhandAI

This file governs every agent working in this codebase. Read it before touching any code. It is the single source of truth for process, domain boundaries, test strategy, quality gates, and slice progress.

---

## What You Are

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

### Hypothesis-driven design

Before writing any test, state a hypothesis:

> "I believe that `[function]` returns `[value]` when `[condition]`."

The test proves or disproves the hypothesis. If the test reveals the hypothesis was wrong, update the hypothesis and the understanding — not just the code. A failing test is information. The most common TDD failure is writing tests that prove the code does what you wrote, instead of proving the code does what the user needs.

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
| 1 | Test infrastructure (Vitest + Playwright) | **Ready** |
| 2 | `jobKey()` — fix composite key, no separator bug | **Ready** |
| 3 | Auth middleware — enforce session on all routes | **Ready** — blocked on #1 |
| 4 | Zod validation on `/api/jobs` | **Ready** — blocked on #1 |
| 5 | `IJobRepository` interface + service contract tests | **Ready** — blocked on #1, #4 |
| 6 | Scrape filter unit tests | **Ready** — blocked on #1 |
| 7 | `resolveJobType` unit tests | **Ready** — blocked on #1 |
| 8 | Table deduplication — merge three tables into `JobTable` | **Ready** — blocked on #1 |
| 9 | `toSlug()` and `downloadBlob()` utilities | **Ready** — blocked on #1 |
| 10 | Rate limiting on `/api/generate` | **Ready** — blocked on #1, #3 |

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
