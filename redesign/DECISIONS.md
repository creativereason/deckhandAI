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
