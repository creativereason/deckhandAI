# DeckhandAI design system

Source of truth for tokens: `app/globals.css`. Source of truth for components: `components/ui/*`, `components/ai/*`.
Live reference: `/styleguide` (every component in every variant and state, both themes).
Enforcement: `pnpm check:tokens` (no raw color, hex, off-scale size, half-step spacing, bold, emoji, inline style) and
`pnpm check:contrast` (every text and control token pair meets WCAG AA, light and dark).

## Principles

1. **A tool, not a dashboard.** Warm paper canvas, ink text, flat surfaces with hairline borders. Shadow is for things that float.
2. **One action color, one AI color.** Teal (`primary`) means "do this". Coral (`ai`) plus the Sparkles glyph means "the assistant is involved". Nothing else is coral. No gradients, no purple.
3. **AI is in the flow.** Every job card, detail view and triage step can start an assistant conversation about that job. The assistant is one panel with one look, opened from anywhere.
4. **State is never color alone.** Status and fit carry an icon and a word. Pressed filters show a check. Errors say what is wrong in text.
5. **Same thing, same component.** Page title, empty state, loading state, form field, dialog: one implementation each.

## Tokens

### Color roles

| Role | Use |
|---|---|
| `background` | App canvas |
| `card` | Surfaces on the canvas: cards, panels, inputs |
| `popover` | Menus, tooltips-adjacent, dialogs |
| `muted` / `muted-foreground` | Quiet wells; secondary text (AA on all three surfaces) |
| `accent` | Hover/selected row |
| `border` | Hairlines between and around surfaces |
| `input` | Control outlines. Darker than `border` so controls meet 3:1 (WCAG 1.4.11) |
| `ring` | Focus ring (one treatment: 2px, 2px offset, everywhere) |
| `primary` (+ `-foreground`, `-subtle`, `-subtle-foreground`) | The primary action, links, selected nav, info badges |
| `secondary` | Neutral filled button |
| `ai` (+ `-subtle` …) | Assistant surfaces and actions only |
| `success`, `warning`, `destructive` (+ `-subtle`) | Outcome states: offer / strong fit, interview / caution, declined / error |
| `overlay` | Scrim behind dialogs |

Pattern for tinted surfaces: `bg-{role}-subtle text-{role}-subtle-foreground`. Pattern for solid: `bg-{role} text-{role}-foreground`.
Contrast table: `VERBOSE=1 pnpm check:contrast`.

### Type scale (Tailwind names, redefined)

| Class | Size / line | Use |
|---|---|---|
| `text-2xl` | 28/36 | Page title (PageHeader only) |
| `text-xl` | 22/28 | Section title |
| `text-lg` | 18/26 | Modal title |
| `text-base` | 16/24 | Card title |
| `text-sm` | 14/20 | Body and all controls (the default) |
| `text-xs` | 12/16 | Captions, badges, metadata. The floor. |

Weights: `font-normal` 400, `font-medium` 500 (controls, labels), `font-semibold` 600 (titles). No bold. Family: IBM Plex Sans; `font-mono` (Plex Mono) for ids, keys, model names.

### Spacing

4px grid, no half-steps. Allowed steps: `0 1 2 3 4 5 6 8 10 12 16 20 24`. Rhythm: 8 inside a control group, 12 between related items, 16 inside a card, 24 between cards/sections, 32 between page regions.
Layout tokens: `--spacing-rail` (72px nav), `--spacing-panel` (384px assistant), `--spacing-touch` (44px minimum target), `--container-content` (1280px), `--container-prose` (704px, forms and settings).

### Radii

`rounded-sm` 4 (badges, kbd) · `rounded-md` 8 (controls) · `rounded-lg` 12 (cards, panels, menus) · `rounded-xl` 16 (dialogs, sheets) · `rounded-full` only for avatars and dots. Buttons are no longer pills.

### Shadows and borders

`shadow-sm` raised card · `shadow-md` menu, popover, hover lift · `shadow-lg` dialog. Borders are 1px `border` (surfaces) or 1px `input` (controls); focus is 2px; invalid inputs go to a 2px destructive border.

### Motion

`--duration-fast` 120ms (hover, color) · `--duration-base` 200ms (lift, dialog) · `--duration-slow` 320ms (panel slide) · `--ease-standard`. `prefers-reduced-motion` disables all of it globally.

### Z-index layers

`--z-base` 0 · `--z-sticky` 10 · `--z-nav` 20 · `--z-panel` 30 · `--z-overlay` 40 (dialogs) · `--z-popover` 50 (menus, tooltips) · `--z-toast` 60. Used as `z-(--z-overlay)`. No numeric `z-*`.

## Component inventory

All in `components/ui` unless noted. Primitives come from `@base-ui/react` (already a dependency), so dialogs, menus, tabs, tooltips, checkboxes and radios get focus trapping, roving focus and ARIA for free.

| Component | Props / variants | Notes |
|---|---|---|
| `Button` | `variant`: default, secondary, outline, ghost, destructive, **ai**, link. `size`: sm 32, default 40, lg 48, icon, icon-sm, icon-lg. `loading` | One `default` per surface. `loading` disables and sets `aria-busy`. |
| `IconButton` | `label` (required), + Button props | Label is the accessible name and tooltip. |
| `Input`, `Textarea`, `Select` | native props; `aria-invalid` | One chrome via `controlClass`. `Select` is native on purpose (OS picker on phones). |
| `Field` | `label`, `hint`, `error`, `optional`, render-prop child | Wires label, `aria-describedby`, `aria-invalid`, `role=alert` error. Every form field uses it. |
| `Checkbox` | `label`, checked / indeterminate / disabled / invalid | 20px box, whole row is the hit area. |
| `RadioGroup` + `RadioItem` | `label`, `description` | Card-style options. |
| `Badge` | `variant`: neutral, info, success, warning, danger, ai, solid, outline | Legacy `tone-*` names alias to these until Phase 3. |
| `StatusBadge` | `kind` status or fit, `value` | Icon + word, always. |
| `Card` (+ Header, Title, Description, Content, Footer) | `variant`: default, raised, interactive, ai, muted. `padding` | The only surface. |
| `ListGroup` + `ListRow` | `title`, `meta`, `leading`, `trailing`, `actions`, `href`, `selected` | Whole-row link with nested actions above it. |
| `Modal` | `ModalContent title description footer size` | Dialog ≥640px, bottom sheet below. |
| `Menu` | `MenuTrigger`, `MenuContent`, `MenuItem destructive` | Row actions, "Move to". |
| `Tooltip` | via IconButton | |
| `Tabs` | `Tabs/TabsList/TabsTrigger/TabsContent` | Panels within a page (Settings). |
| `SegmentedControl` | `label`, `value`, `options`, `onChange` | A view setting (List/Pipeline, Triage/List). Radio semantics. |
| `FilterChip` | `pressed`, `count` | Toggle filter with a check when on. |
| `Toaster` (sonner, themed) | `toast.success/error` | Tokenised; bottom-center. |
| `EmptyState`, `LoadingState`, `ErrorState`, `Skeleton` (`states.tsx`) | `compact` | One layout per state. Errors are `role=alert` with Try again. |
| `PageHeader` | `title`, `description`, `breadcrumbs`, `actions`, `meta` | The only `h1`. |
| `NavRail`, `BottomNav` (`nav.tsx`) | `items: {href,label,icon,badge,active}` | Same items, rail on ≥768px, bottom bar on phones. |
| `AskAIButton`, `PromptChip`, `AIInsight`, `AssistantPanel` (`components/ai/ai.tsx`) | | The AI vocabulary. |

Planned for Phase 2 (added here and in `/styleguide` first): `AppShell` (rail, top bar, assistant slot), `JobCard`, `PipelineColumn`, `StatTile`, `FunnelBar`.

## Screen inventory

| Screen | Route | Status | Missing UI it needs |
|---|---|---|---|
| Today (home) | `/?view=today` | **new** | stat tiles, funnel, "needs you" list, AI briefing card. No activity feed: needs the `job_events` read route (backend, out of scope) |
| Pipeline board | `/?view=board` | rebuild | JobCard, PipelineColumn, mobile column switcher (one stage at a time <768px) |
| Jobs list | `/?view=board`, layout List | rebuild | ListRow-based sections with collapsible headers |
| Inbox triage | `/?view=inbox` | rebuild | triage card, keyboard hint, progress |
| Inbox list | `/?view=inbox`, List | rebuild | ListRow with bulk actions |
| Job detail | `/job?id=…` | rebuild | tabs (Overview, Generate), AI panel with job context |
| Assistant | panel on every screen | unify | one `AssistantPanel`, replaces ChatDrawer / Slot / Overlay / "Discuss this role" |
| Add / edit job, Generate | modals | rebuild | `Modal` + `Field` |
| Settings (7 pages) | `/settings/*` | rebuild | inside AppShell, `Tabs`-style sub-nav, `PageHeader`, RadioGroup, Switch (not needed yet) |
| Scraper coverage | `/scrape-sources` | rebuild | table → ListRow |
| Login | `/login` | rebuild | centered card, same Field/Button |
| Onboarding wizard | overlay on first run | rebuild | `Modal` size lg, stepper |
| Styleguide | `/styleguide` | **new** | |

Not designed because the data does not exist yet: deleted-jobs view (Slice 19), link-health badge (Slice 25), activity feed (27c).

## Information architecture

One shell on every authenticated screen: **rail** (≥768px) / **bottom bar** (phones) with Today, Board, Inbox, Settings; a top bar with page title context, **Ask Deckhand** (opens the assistant panel), theme and sign-out in a menu. The assistant is a right-side panel on ≥1024px, a sheet below. Any card can open it pre-loaded with that job ("Ask about this job").

## Layout

- Page: `max-w-(--container-content)`, 16px gutter on phones, 24px from `sm`.
- Settings and forms: `max-w-(--container-prose)`.
- Breakpoints: 390 phone (bottom nav, single column, pipeline shows one stage at a time), 768 tablet (rail, two columns), 1280 desktop (rail + content + optional assistant panel).
