# Fix Plan — Evaluate Job URL Code Review Findings

Produced from a code review of `feat/m11-job-fetcher` (branch vs `main`, including uncommitted working-tree changes) on 2026-07-01. Covers findings #1–7 from the review punch list, ordered by severity. Finding #8 (fit-scoring duplication between `app/api/evaluate-job/route.ts` and `lib/score.ts`) is intentionally out of scope — it needs its own design pass and is tracked as a follow-up, not a bug.

To be implemented and reviewed before merging this branch.

---

## 1. Zod validation on evaluate-job route

**File:** `app/api/evaluate-job/route.ts`

Zod isn't installed anywhere in this repo yet — every route uses manual `as` casts + `if` guards (confirmed via repo-wide grep; not in `package.json`). This route also writes directly to `jobs.json`'s `pending` section via the PUT handler with no runtime validation, violating CLAUDE.md's Security Invariant #2 ("Every request body is validated with Zod before use. No `as SomeType` cast on user-supplied input").

**Fix:**
- Add `zod` as a dependency (`pnpm add zod`).
- Define `EvaluateRequestSchema` (POST body: `url` required string, `company`/`role` optional strings) and `EvaluationPayloadSchema` (PUT body: `company`/`role`/`url` required strings, `salary`/`notes`/`scoreRationale` optional strings, `fit` constrained to the `JobFit` enum from `lib/jobs.ts` — `"strong" | "good" | "caution" | "weak"` — `retrieval` metadata optional) directly in the route file.
- Replace both `as EvaluateRequest` / `as EvaluationPayload` casts with `.safeParse()`, returning `NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })` on failure — matches the pattern already documented in CLAUDE.md's "Validating a request body" example.

**Note:** this closes the gap for this one route only. The rest of the app (`/api/jobs`, etc.) still lacks Zod per backlog item #4 — out of scope here.

---

## 2. `evaluateJobUrl` dead end without an AI key

**File:** `components/ChatDrawer.tsx`

`evaluateJobUrl` (~line 141) POSTs `{ url }` only. When `AI_API_KEY` is unset, `fallbackEvaluation` in the route returns empty `company`/`role`, and the PUT (add-to-pending) always 400s with no way to recover — the evaluation card has zero editable fields today, just an "Add to pending" button (lines 398-408).

**Fix (minimal, no new form UI):** in `addEvaluationToPending`, check `evaluation.company`/`evaluation.role` before calling PUT. If either is empty, skip the request and render inline text: "Couldn't detect company/role automatically — add this job manually from the board instead," and disable the button.

---

## 3. Unbounded retrieval fallback chain + missing Brave timeout

**File:** `lib/job-fetcher.ts`

`fetchJobDetails`'s chain (`fetchRaw` → `fetchMarkdownAlternate` → up to 8 sequential Brave-alternate fetches → Playwright) has no cumulative time budget. Worst case exceeds the route's `export const maxDuration = 60`, killing the function mid-SSE-stream and discarding all completed work. The Brave Search API call itself is also missing the `signal: AbortSignal.timeout(timeoutMs)` used by every other fetch in the file, so it can hang indefinitely.

No existing time-budget pattern exists elsewhere in the repo to reuse (checked `lib/scrape-run.ts` — none).

**Fix:**
- Track `const deadline = Date.now() + BUDGET_MS` (45s, leaving headroom under the route's 60s ceiling) at the top of `fetchJobDetails`.
- Before each fallback leg, compute remaining budget; skip straight to `limitedResult` if exhausted, and cap each leg's `timeoutMs` to `min(defaultTimeout, remaining)`.
- In the Brave-alternates loop, stop trying further candidate URLs once the budget runs out instead of always attempting all 8.
- Add the missing `signal: AbortSignal.timeout(timeoutMs)` to the Brave Search API fetch call in `searchBraveAlternates`.

---

## 4. `shouldRefreshNotesFromUrl` silent overwrite

**File:** `app/job/page.tsx`

`shouldRefreshNotesFromUrl` (~line 259) matches on a loose `refresh|update|fetch` + "notes" heuristic and, when triggered, `refreshNotesFromUrl` (lines 322-357) fetches the job URL fresh and PATCHes `notes` directly with no confirmation — a message like "update the notes to say I'm following up next week" gets its intent silently discarded and replaced with scraped page text.

**Decision:** keep the shortcut (per user preference — instant-refresh UX is worth keeping), add a confirmation step instead of removing it.

**Fix:** mirror ChatDrawer's `evaluation` state + "Add to pending" button pattern (lines 95, 128, 215-238, 398-408) — the only confirm-before-write pattern that already exists in this codebase:
- `refreshNotesFromUrl` stops PATCHing automatically. Instead it fetches/evaluates and stores the proposed new notes in local state (e.g. `pendingNotesRefresh`), rendering a small preview + "Apply" / "Cancel" buttons in the chat thread.
- Only clicking "Apply" calls the existing PATCH `/api/jobs` with the new notes; "Cancel" (or navigating away) discards the proposal.
- No new shared component needed — this is the same state-then-explicit-action shape ChatDrawer already uses, just reimplemented in `app/job/page.tsx`'s `JobChat`.

---

## 5. `shouldEvaluateJobUrl` over-broad trigger

**File:** `components/ChatDrawer.tsx`

`shouldEvaluateJobUrl` (~line 60) fires on any message containing an `http(s)://` URL, with no intent gate — e.g. "check my LinkedIn https://..." incorrectly triggers a fabricated job-fit evaluation.

**Fix:** require a job/evaluate-intent keyword alongside the URL (e.g. "evaluate", "job", "posting", "role", "apply") or the existing `EVALUATE_URL_PROMPT` prefix ("Evaluate this job URL: "), not just URL presence. `extractUrl` (line 64) is unchanged since it's reused elsewhere (line 136); only `shouldEvaluateJobUrl`'s gating condition changes.

---

## 6. `NAV_BOILERPLATE` regex missing `g` flag

**File:** `app/api/evaluate-job/route.ts:112`

```ts
const NAV_BOILERPLATE = /log in|sign in|.../i; // missing `g`
```

`.match()` without the `g` flag returns at most one hit, so `navHitCount >= 2` can never be true — nav-heavy boilerplate pages can leak into job notes/summaries undetected.

**Fix:** add `g` to the regex flags (`/.../gi`).

---

## 7. Lost company-homepage fallback

**Files:** `lib/chat-tools.ts`, `lib/job-fetcher.ts`, `lib/fetch-jd.ts`

`fetch_job_description` used to call `fetchJdText` (in `lib/fetch-jd.ts`), which had a company-homepage fallback (`homepageFromJdUrl`/`homepageFromCompanyName`) returning at least some text for thin/gated JD pages. It now calls `fetchJobDetails` (`lib/job-fetcher.ts`), which has no homepage-fallback leg — with no `BRAVE_SEARCH_API_KEY` and `ENABLE_PLAYWRIGHT_FALLBACK=false` (the default), it now returns empty text instead.

**Fix:**
- Port `homepageFromJdUrl` and `homepageFromCompanyName` from `lib/fetch-jd.ts` into `lib/job-fetcher.ts` as a final fallback leg before `limitedResult` (after Brave alternates, respecting the time budget from fix #3).
- `homepageFromJdUrl` returns `null` for third-party ATS hosts (`THIRD_PARTY_BOARDS` list) since those have no meaningful homepage — reconcile or merge this list with job-fetcher.ts's existing `NON_JOB_HOSTS`/`FETCHABLE_JOB_HOSTS` allowlists rather than keeping two separate lists.
- Delete `lib/fetch-jd.ts` once ported — its only caller (`fetch_job_description`) was already switched to `fetchJobDetails`, so it's dead code otherwise (also closes a reuse/duplication finding from the review).

---

## Verification

1. `pnpm tsc --noEmit` — no errors, especially after adding `zod` and new schema types.
2. `pnpm lint` — no warnings.
3. `pnpm test` — existing `lib/__tests__/job-fetcher.test.ts` and `app/api/__tests__/evaluate-job.test.ts` need new cases:
   - Zod rejection paths (missing/malformed fields → 400 with field path).
   - `NAV_BOILERPLATE` now correctly flags multi-hit boilerplate text.
   - Time-budget behavior in `fetchJobDetails` (deadline exceeded → skips to `limitedResult` instead of hanging).
   - Homepage-fallback leg returns non-empty text when Brave/Playwright are both unavailable.
4. `pnpm test:coverage` — ≥80% lines on changed files.
5. Manual pass in the browser:
   - Evaluate a job URL with `AI_API_KEY` unset — confirm the "couldn't detect company/role" message appears instead of a silent 400.
   - Trigger the notes-refresh shortcut in `app/job/page.tsx` chat — confirm a preview + Apply/Cancel appears instead of an instant overwrite.
   - Paste an unrelated URL (no job-related keywords) into ChatDrawer chat — confirm it does *not* trigger job evaluation.
