# Phase 0 audit

Captured 2026-11-16 from commit `d183a70` (the last commit before the redesign and the new logo, built in a separate worktree) in demo mode,
persona "design". Screenshots: `redesign/before/` (every screen at 390 / 768 / 1440 light, 1440 dark). The Today and Styleguide screens did not exist then.
Counts come from `redesign/tools/metrics.sh` and are re-run in Phase 3.

## Headline

The app has a token foundation (shadcn `base-nova`, oklch CSS variables, `Button` and `Badge` with cva variants) and
then mostly ignores it. Screens were built one slice at a time and each slice invented its own chrome. The three
recent proposals (Triage 27a, Pipeline 27b, Home 27c) each introduced a different navigation idea
(tabs, segmented switches, a floating overlay) rather than one shell.

## 1. Screens and the shell they use

| Screen | Header / chrome | Notes |
|---|---|---|
| `/` board (list) | `AppHeader` with logo, stats line, Settings, Sign out | Stats line, view tabs, layout switch, FIT chips, STATUS chips and search are five separate control rows |
| `/` board (pipeline) | same | Floating "Ask Deckhand" pill overlaps column content at 390 px |
| `/?view=inbox` triage / list | same | Assistant is a right-rail card in triage, a different rail in list mode, an overlay on the pipeline: three presentations of one feature |
| `/job` detail | `AppHeader` + breadcrumb **and** a "← Board" link | Two ways back; card grid unlike any other screen |
| `/settings/*` | **No `AppHeader`.** Own `h1`, "← Tracker" link, underline tabs | Different shell, different tab style from the board's pill tabs |
| `/scrape-sources` | Own `h1` (`font-semibold`), no shared header | |
| `/login` | Own centered layout, `h1` with `text-2xl` and no weight | |
| Onboarding wizard | Hand-rolled fixed overlay | |

Four `h1`s with four different class strings; no shared PageHeader.

## 2. Buttons

- 34 raw `<button>` vs 90 `<Button>`. Raw buttons are used for chips, tabs, segmented switches and cards, each with its own class string.
- `Button` itself is pill-shaped (`--radius-button: 9999px`) but every other control (inputs, cards, tabs) is `rounded-lg`/`rounded-xl`, so a pill button next to a rounded-rect input is the norm.
- Sizes: `xs` 24 px, `sm` 28 px, default 32 px, `lg`; `sm` uses `text-[0.8rem]`, an off-scale size. Hit targets below 44 px on touch.
- Primary action appears as: filled blue pill (Generate, Save), filled blue square-ish "Keep" bar, text-link blue ("Sign out", "View posting", "← Board"). "Sign out" in primary blue reads as a call to action.
- Chip/segmented controls exist in **four** implementations: `BoardViewSwitch` (tabs with `role=tab`), `BoardLayoutSwitch` (`aria-pressed`), `AppliedStatusFilter`, FIT chips in `app/page.tsx`. Same look-alike, different semantics, different focus rings.

## 3. Form controls

- 82 raw `<input>`, 12 `<textarea>`, 9 `<select>`, **no** `Input`/`Select`/`Textarea`/`Checkbox` components in `components/ui`.
- 20 distinct `className` strings across the inputs. Heights, borders, radii and focus rings differ per screen.
- Native `<select>` is globally restyled in `globals.css` with a hard-coded stroke color (`%2364748b`, `%2394a3b8`) for the caret.
- Labels: uppercase 11 px tracking-wide labels in settings and the job form, sentence-case elsewhere; error text has no shared pattern.
- Radio list on Settings → AI Model uses disabled native radios; the disabled state is low contrast (muted on muted) and fails AA.

## 4. Color

- 105 uses of raw Tailwind palette colors (`text-gray-700` 45, `text-gray-300` 29, `text-gray-900` 26, `text-gray-200` 25, …) that bypass the tokens and the dark-mode variables; every one needs a manual `dark:` partner.
- 8 hex/rgb/hsl literals in screen code; hard-coded hex in the select caret SVG; `--shadow-color: #1a1a1a`.
- Semantic tones exist (`tone-success|warning|purple|teal|orange|highlight`) but are used as raw hue names, not roles. "Interview" is purple, "Remote" is teal, "Contract" orange, NEW is pink: five hues for status and type with no stated mapping.
- Primary blue `oklch(0.546 0.245 262)` plus terracotta secondary; the secondary is almost unused. Result reads as default shadcn blue-on-slate: the "stock" look the brief rules out.
- Light-mode `muted-foreground` text at 11–12 px on `muted` backgrounds is borderline for AA (chip labels, counts).
- The signal system (fit, status, staleness) is conveyed through colored emoji circles mapped to `SignalIcon`: `🟢 🟡 🔴 ⚡ 👻` are the **data model** (`lib/job-signal.ts`). Color is the only difference between good/stale/declined glyphs in places.

## 5. Typography

Text sizes in use: `text-xs` 185, `text-sm` 169, `text-base` 12, `text-xl` 6, `text-2xl` 4, `text-lg` 2, `text-3xl` 1, plus arbitrary `text-[…]` sizes. 11 px and 0.8 rem appear off-scale. Weights: `semibold` 86, `medium` 31, `bold` 18, `normal` 4: three bold-ish weights doing one job. Headings have no scale: card titles are sometimes `text-sm font-semibold`, sometimes uppercase `text-xs tracking-wide`, sometimes `text-base font-bold`. IBM Plex Sans/Mono is a fine choice and stays.

## 6. Spacing and shape

- Padding steps in play: `px-1, 1.5, 2, 3, 4, 5, 6`, `py-0.5, 1, 2, 3, 4, 8`; gaps `1, 1.5, 2, 2.5, 3, 4, 5`. Half-steps (`1.5`, `2.5`, `0.5`) account for ~80 uses, which is how the rhythm drifts.
- 26 arbitrary px/rem classes, 4 inline `style={{}}`.
- Radii: `rounded-lg` 48, `rounded` 42, `rounded-xl` 37, `rounded-full` 21, `rounded-2xl` 17, `rounded-md` 3. Cards use `xl` or `2xl` depending on the file; the chat bubble uses `rounded-tl-sm`.
- Shadows: cards sometimes `shadow-sm`, sometimes none, sometimes border-only.

## 7. Overlays, dialogs, toasts

- 7 hand-rolled `fixed inset-0` overlays (`app/page.tsx`, `app/job/page.tsx`, `login`, `AddJobModal`, `OnboardingWizard`, `GenerateModal`, `JobFormModal`) with no shared focus trap, Escape handling or `aria-modal`. `@base-ui/react` is already a dependency and provides a real Dialog, so a new library is not needed.
- Toasts: `sonner`, bottom-center, default styling, not themed to tokens.
- Assistant: `ChatDrawer`, `AssistantSlot`, `AssistantOverlay`, and the per-job "Discuss this role" box are four containers for one capability.

## 8. Empty, loading and error states

- Empty: one-line muted `<p>` with five wordings ("No applications yet.", "Nothing passed yet.", "No targets yet. Add one…", "No rules yet.", "No agents yet."). None has an icon, heading, or next action, except the onboarding wizard.
- Loading: ad-hoc text ("Loading…", "Tailoring…", button label swaps); no skeletons; no `aria-busy`.
- Error: inline red text in some forms, toast in others, nothing in a few fetch failures.

## 9. Responsive and accessibility observations

- 390 px board: header stacks into five rows before any content; Pipeline columns scroll horizontally with the floating Ask Deckhand pill over the cards. Cards in the Prospects column run past 12 rows, which makes the kanban a long scroll rather than a board.
- Touch targets under 44 px: chips (~24 px), segmented switches (~28 px), `Button` `xs`/`sm`.
- Focus rings: three different treatments (`ring-3 ring-ring/40` on Button, `ring-2 ring-primary/40` on tabs, native outline on inputs).
- `BoardViewSwitch` uses `role="tab"` without `tabpanel`/arrow-key behavior: incorrect ARIA.
- Information by color alone: signal emoji, fit and status badges rely on hue for some states (text labels exist for fit/status, not for the signal column).
- Declined chip uses strikethrough as its only "hidden" cue.

## 10. Missing UI (inputs to the Phase 1 screen inventory)

- Persistent navigation: no app-level nav for Board / Inbox / Today / Settings; "Settings" is a text link.
- A **Home / Today** screen (Slice 27c) does not exist.
- A shared command or ask-AI entry point (the assistant is four things).
- Tabs, tooltip, dropdown menu, popover, skeleton, progress, and avatar components.
- Deleted-jobs view (Slice 19), link-health badge (Slice 25), activity feed (27c).
- Dark-mode check for every screen: the "before" dark shots exist at 1440 only.

## Direction this points to

One app shell (left rail on ≥768 px, bottom bar on phones) with Today, Inbox, Pipeline, Jobs list and Settings; one page header; one assistant surface that
opens as a side panel everywhere and can be started with context from any card ("Ask about this job"); one control vocabulary
(Button, IconButton, SegmentedControl, FilterChip, Tabs); signal icons replaced by lucide glyphs plus text. Details in `DESIGN_SYSTEM.md`.
