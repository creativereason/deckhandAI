# Redesign summary

Branch `redesign/ui-system`. Presentation layer only: no API routes, data models, backend logic or Playwright scraping were changed.

## What changed

- **One design system** (`app/globals.css`, `components/ui`, `components/ai`, `/styleguide`, `redesign/DESIGN_SYSTEM.md`): color roles (teal for action, coral only for AI), 14px type scale, 4px spacing grid, three radii, three shadows, motion and z-index tokens, light and dark. All text and control color pairs pass WCAG AA (`pnpm check:contrast`).
- **One app shell**: nav rail on tablet/desktop, bottom bar on phones, slim top bar, and a single assistant panel (docked at ≥1024px, slide-over below) that any card can open with a job-specific prompt ("Ask Deckhand about …").
- **Screens rebuilt**: Today (new), Board (Pipeline with one-stage-at-a-time on phones, and List), Inbox (Triage and List), Job detail, Add/Edit/Generate dialogs, Onboarding, Login, all seven Settings pages, Scraper coverage.
- **Consistency**: three duplicated job tables became one `JobList`; `GenerateModal` and `AIGenerationCard` merged; every dialog is the same focus-trapping `Modal`; every form uses `Field` + `Input/Select/Textarea/Checkbox/RadioGroup`; every page has one `PageHeader` h1; every empty/loading/error state uses the same three components.
- **Accessibility**: skip link, visible focus ring everywhere, status/fit as icon + word, chips show a check when on, labelled icon buttons, `prefers-reduced-motion` respected, 44px+ touch targets for primary controls on phones.

## Verification

| Check | Result |
|---|---|
| `pnpm tsc --noEmit` | clean |
| `eslint app components lib redesign` | clean |
| `pnpm test` | 796 passing (tests updated with the UI; new tests for `lib/today.ts`, assistant requests, `today` view) |
| `pnpm check:tokens` (the Phase 3 grep) | 0 violations; 5 justified exceptions listed in `check-tokens.mjs` |
| `pnpm check:contrast` | all pairs pass, light and dark |
| axe (`redesign/tools/axe.mjs`, 16 routes × 5 theme/width runs) | no serious or critical violations (one found and fixed: keyboard access to scrollable posting text) |
| Workflow click-through (`redesign/tools/workflows.mjs`) | board, search, nav, triage, job detail, assistant, ask-from-card, settings routes pass; one real bug found (job page horizontal overflow at 390px) and fixed |
| Screenshots | `redesign/before/` and `redesign/after/`, three widths plus 1280 dark |

## Decisions I made for you

See `redesign/DECISIONS.md` (18 entries). The ones you may want to reverse: Today is not the landing view; the job page keeps its own chat; the logo work-in-progress was committed as an adapter over the token-coloured mark.

## Not finished / needs you

- **`next build` was not run**: it fails in this sandbox because `next/font/google` cannot reach Google Fonts. Type check, lint, unit tests and the dev server all pass. Run `pnpm build` locally.
- **`pnpm e2e` and `pnpm test:coverage`** were not run (the repo's e2e spec was not touched; there is no `e2e` script in `package.json`).
- **Today has no activity feed**: needs a read-only `job_events` route (backend).
- **Two chats remain** (global assistant and the job page's "Discuss this role"); merging needs per-page context in the global chat.
- **Real-data screenshots**: all captures use the demo persona, not your board.
- **Playwright's own browser download wasn't available**, so tools use system Chrome (`channel: "chrome"`).
- Your `public/logo.svg` change is still uncommitted and `AGENTS.md` is still untracked; I did not touch either.
- Not covered by axe: transient states (open menus, open dialogs, toasts) beyond the styleguide page.
