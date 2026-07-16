---
name: deliver
description: The deckhandAI delivery cycle — branch, TDD one unit, refactor, extract builders, adversarial review to convergence, PR. Use when implementing any change to product code, or when the user names a slice from the CLAUDE.md backlog. Not for docs-only edits, config bumps, or exploratory questions.
---

# Delivery Cycle

This skill governs how a change gets from an idea to a PR in this repo. It is the executable form of the standards in `CLAUDE.md` — that file explains *why* the code is shaped the way it is; this one is the *order of operations*. Read the TDD Protocol, SOLID, and Clean Code sections of `CLAUDE.md` before step 3. Do not duplicate their content here.

**Scope guard.** One slice. If the change needs more than three files, stop and ask whether it is two slices — the same rule as the Token Routing table. A slice that grows mid-cycle is a slice that was scoped wrong; finish the narrow one and open a second branch.

---

## Step 1 — Branch

```bash
git checkout main && git pull
git checkout -b <type>/<subject>
```

`<type>` is `feat`, `fix`, `test`, `refactor`, or `chore`. `<subject>` names the change in domain language, not implementation language: `feat/job-key-extraction`, not `feat/fix-string-concat`.

Never work on `main`. If you are already on a branch that is not `main` and it is unrelated to this change, stop and ask.

---

## Step 2 — Scope the unit

State, in one sentence, the single testable unit this cycle delivers, and which bounded context from the `CLAUDE.md` Domain Map it belongs to. If it belongs to two contexts, it is two slices.

Name the ZOMBIES letter you are starting at. It is `Z` unless you are extending a unit that already has Z covered.

---

## Step 3 — Red

Write **one** failing test. Run it. Confirm a non-zero exit code before writing any implementation.

```bash
yarn test
```

The test drives the design — that is the entire point of writing it first. As you write it, you are making SOLID decisions:

- **S** — if the test needs three unrelated setup blocks, the unit has three reasons to change. Split it before you implement.
- **O** — if covering the next case will mean editing the code you are about to write rather than extending it, choose a configuration map over a switch.
- **L** — if the unit has an interface, the test is a contract test. Every implementation must pass it unmodified.
- **I** — the test only knows what a caller knows. If the test reaches for internals, the interface is wrong.
- **D** — if the test cannot run without the filesystem, the network, or GitHub, the unit depends on a concrete implementation. Invert it and mock the abstraction.

A test that passes before implementation was trivially true. Delete it, write a harder one. A test that fails in a way you did not predict means the hypothesis was wrong — re-read the `it()` string before you touch the code.

---

## Step 4 — Green

Write the **minimum** code that makes the test pass. Hardcoded is correct if it passes. Do not generalize, do not add error handling no test requires, do not anticipate the next case. Let the next test force it.

Run `yarn test`. It passes.

---

## Step 5 — Commit (green)

```bash
git commit -m "test+impl: [ZOMBIES letter] <what this proved in one sentence>"
```

The message states what the test *proved*, not what the code does.

---

## Step 6 — Refactor implementation

Now reduce complexity. Extract constants, helper methods, and factories, naming everything in the **domain language** of its bounded context — `jobKey`, `pending`, `prospect`, `scrape target`, not `key`, `list`, `item`, `data`.

Apply the Clean Code gates from `CLAUDE.md` as hard limits: no function over 20 lines, no parameter list over 3, no `any`, no duplicated logic, names reveal intent.

Name the principle out loud for each change you make — and for each you deliberately decline. "Not extracting this yet; it appears once, and a second call site is what would make it a helper" is a legitimate, recorded outcome.

Run `yarn test`. Still green — refactoring does not change behavior.

```bash
git commit -m "refactor: <principle applied> in <unit>"
```

---

## Step 7 — Builders and seed helpers

**Conditional.** Do this when the unit touches a domain type that tests construct by hand — `AppliedJob`, `ProspectJob`, `PendingJob`, `JobsData`, `CandidateProfile`, a scrape target. Skip it for a pure function over primitives, and say you are skipping it and why.

Introduce:

- **Mock builders** — a fluent builder per domain type that encodes valid-by-default state, so a test states only the field under test. `anAppliedJob().withStatus('declined').build()` — the reader sees the one thing that matters, and the builder owns the definition of a valid job.
- **Seed helpers** — for persistence-shaped tests, a helper that establishes a known `JobsData` fixture in domain terms.

Both exist to protect domain semantics and to kill the static strings scattered through tests. A builder is where the domain's notion of "valid" lives; when the domain changes, one file changes.

Builders live beside the context they serve and are introduced **once per type, then reused** — if the type already has one, extend it rather than writing a second.

```bash
git commit -m "test: add <Type> builder — <what invariant it now owns>"
```

---

## Step 8 — Refactor tests

Rewrite this cycle's tests to use the builders and seed helpers. Optimize for readability and strong typing: no repeated magic strings, no anonymous object literals standing in for domain types, no `as` casts on fixtures.

A reader who does not know the implementation should be able to read the test and learn what the domain considers valid.

Run `yarn test`. Still green.

```bash
git commit -m "test: express <unit> tests in domain language via builders"
```

---

## Step 9 — Adversarial review

Spawn a **fresh subagent** — not your own context, which is anchored to the choices it just made — with this brief:

> You are a senior software engineer reviewing this diff adversarially. Your bar is extendability and maintainability under AI-assisted development: code that a model or a human will modify next month without reading the whole repo. Assume the author is competent, so do not report style nits or restate the diff. Report only what will cost someone real time later.
>
> Review `git diff main...HEAD` against the standards in `CLAUDE.md`. For each finding give: file:line, the principle violated, the concrete failure scenario it creates, and the smallest change that resolves it. Judge whether each abstraction earns its cost — a premature factory is a finding, and so is a builder no test needed. If the diff is sound, say so and report nothing; a clean verdict is a valid result and inventing findings to seem thorough is a failure.

Findings must be **severity-ranked**: `blocking` (violates a `CLAUDE.md` invariant, a security invariant, or a Clean Code gate) or `advisory` (a judgment call worth recording).

---

## Step 10 — Converge

Hand the findings to a **new** agent — fresh context, so it fixes what is written rather than defending what it wrote. Repeat steps 6–9 on the findings.

**Termination.** The loop ends when a review round emits zero `blocking` findings. It is **not** required to reach zero advisory findings — advisory findings are opinions, and a loop that chases every opinion never converges and churns the diff.

**Bound: three rounds.** If round three still emits blocking findings, stop and escalate to the user. Three failed rounds is not a stubborn diff, it is a slice that was scoped or designed wrong, and more rounds will not fix that.

Record any advisory findings you consciously declined, with the reason, in the PR body. A declined finding with a stated rationale is a design decision. A silently dropped one is debt.

```bash
git commit -m "refactor: resolve review findings — <what changed>"
```

---

## Step 11 — Gates

All three must be clean. They are the gates that actually exist (see `CLAUDE.md` — `test:coverage` and `e2e` are not wired up yet; do not run them):

```bash
yarn tsc --noEmit
yarn lint
yarn test
```

No suppressions. No `// eslint-disable` unless the finding is a confirmed false positive documented inline with its specific reason.

---

## Step 12 — PR

```bash
git push -u origin <branch>
gh pr create --base main
```

The PR body states:

- **The unit delivered** and its bounded context.
- **ZOMBIES coverage** — one line per letter covered, and which letters are deliberately not covered yet.
- **Review convergence** — rounds taken, blocking findings resolved, advisory findings declined with rationale.
- **Gate status** — the three gates, green.
- **Slice backlog** — the `CLAUDE.md` table row updated, in this same PR.

Then stop and tell the user. Do not merge.

---

## Anti-patterns

These void the cycle. If you catch yourself doing one, back up rather than continuing.

- Writing the implementation and backfilling a test. The test did not drive anything; it only documented what you already chose.
- Writing several tests before implementing. Each test is one design decision, and batching them hides which decision drove which line.
- Squashing the cycle into one commit. The commit sequence *is* the record of how the design emerged — it is what makes the diff reviewable and the reasoning teachable. Collapsing it destroys the artifact.
- Reviewing your own diff in your own context. You will rationalize.
- Looping past three rounds. Escalate.
- Broadening the slice because the refactor "revealed" adjacent work. Note it, open a backlog row, leave it.
