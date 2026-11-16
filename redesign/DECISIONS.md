# Decisions made on your behalf

Newest last. Each entry: what, why, how to reverse.

1. **Branch carries your uncommitted logo work.** `redesign/ui-system` was cut from `feat/pipeline-board` with your uncommitted
   `DeckhandLogo`, `AppHeader`, `app/login/page.tsx`, `public/logo.svg` and `app/icon.tsx` deletion still uncommitted in the working tree.
   My commits use explicit paths so they do not include those files until the redesign touches them (the header is rebuilt in Phase 2; the logo component is kept).
2. **`next.config.ts` reads `NEXT_DIST_DIR`.** Your `pnpm dev` on :3000 holds Next's per-directory lock, so a second dev server for screenshots needs its own
   `distDir`. Default is unchanged (`.next`). `.next-redesign/` is gitignored. Next also rewrites `tsconfig.json` for that dir; I revert that before committing.
3. **System Chrome for Playwright** (`channel: "chrome"`) because the Playwright browser download is not installed here.
4. **`next build` cannot run in this sandbox** (Google Fonts fetch for IBM Plex fails offline). Verification uses `tsc`, `eslint`, `vitest`, and the dev server; I'll flag the build check in SUMMARY.md.
5. **No new UI library.** shadcn (`base-nova`) + `@base-ui/react` + `lucide-react` + `sonner` are already installed; Dialog, Tabs, Menu, Select, Checkbox primitives come from base-ui.
6. **Teal action color, coral reserved for AI.** The brief rules out purple and stock blue-on-slate. `primary` is a deep teal, `ai` is a warm coral used only with the Sparkles glyph. Hues live in `app/globals.css`; every text/control pair is checked by `pnpm check:contrast`.
7. **Buttons are 8px-radius rectangles, not pills.** Reads as a tool; the pill shape clashed with every other control.
8. **Hover cannot be forced in the styleguide.** It documents hover as live (hover any control) and forces only the focus ring (`.force-focus`).
9. **Board default stays "list", app default stays Board.** Existing tests and saved preferences define those defaults. Today is one click away in the nav and is not the landing view. Flip `parseBoardView` / `parseBoardLayout` if you want Today or Pipeline first.
10. **Today is derived from existing data only** (`lib/today.ts`). The activity feed from `job_events` needs a backend route, so it is not built. "Needs you" uses offers, interviews, new strong fits, 14-day-stale applications and the inbox count.
11. **One assistant, but the job page keeps its own chat.** The shell hosts a single docked panel (sheet below 1024px) that any card can open with a job-specific prompt. The job page's "Discuss this role" chat stays because it sends job context and has the notes-refresh Apply/Cancel flow the global chat lacks. Merging them needs the global chat to accept per-page context (follow-up).
12. **Status and fit render icon + word** (`StatusBadge`) and filter chips show a check when on, so nothing relies on color alone. The emoji "signal" values in `lib/job-signal.ts` stay as data (they feed sorting and tests); the UI only shows the text labels Stale / Ghost job.
13. **Markdown headings in chat are rendered two levels down** (h3-h5) so assistant text never adds an h1/h2 to a page.
14. **`@axe-core/playwright` added as a dev dependency** (accessibility check). Not a UI library; no runtime impact.
15. **Merged duplicates:** `GenerateModal` is now a dialog around `AIGenerationCard` (they were two copies of the same flow; the card also has PDF export). `AddJobModal` (unused, duplicated `JobFormModal` add mode), `AppHeader` (replaced by `AppShell`), `SignalIcon`, `BoardViewSwitch`, `BoardLayoutSwitch`, `AssistantOverlay`, `AssistantSlot` and the unused shadcn accordion were removed.
16. **Your logo/icon work was committed.** `DeckhandLogo.tsx` and its test are now on the branch as a thin adapter over the token-coloured `BrandMark` (same API). `app/icon.tsx` deletion was swept into the screens commit. Your originals are in `redesign/user-wip-backup/`. `public/logo.svg` is still your uncommitted change, untouched.
17. **Justified exceptions to `check:tokens`** (listed with reasons in `redesign/tools/check-tokens.mjs`): data-driven bar/progress widths and nav column count (inline style); hex placeholders for the user's DOCX resume colors; the inline CSS of the print-to-PDF window.
18. **Tests changed with the UI**: role/label queries that referenced removed controls (collapse button, pressed buttons, "← All agents"), plus new tests for `lib/today.ts`, the assistant request prop and the `today` view.
