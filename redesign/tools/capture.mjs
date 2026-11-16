#!/usr/bin/env node
// Screenshots every screen at 390 / 768 / 1440 (light) plus 1440 dark.
// Usage: node redesign/tools/capture.mjs <outDir> [baseUrl]
// Needs a dev server in demo mode: DEMO_MODE=true DEMO_PERSONA=design (see redesign/README.md).
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { setTimeout as sleep } from "timers/promises";

const OUT = process.argv[2] ?? "redesign/after";
const BASE = process.argv[3] ?? "http://localhost:3789";
// WIDTHS=390,768,1440 (default). The last width is also used for the dark-theme shots.
// SKIP=today,styleguide skips screens that do not exist in the code being captured.
const WIDTHS = (process.env.WIDTHS ?? "390,768,1440").split(",").map(Number);
const HEIGHT = { 390: 844, 768: 1024 };
const SKIP = new Set((process.env.SKIP ?? "").split(",").filter(Boolean));
mkdirSync(OUT, { recursive: true });

const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
const first = jobs.applied[0];
const jobHref = `/job?${new URLSearchParams({ section: "applied", company: first.company, role: first.role, ...(first.id ? { id: first.id } : {}) })}`;

const HIDE = "nextjs-portal{display:none!important}";

// setup(page) runs after navigation and before the shot. `layout` seeds localStorage.
const SCREENS = [
  { name: "login", path: "/login", auth: false },
  { name: "today", path: "/?view=today" },
  { name: "board-list", path: "/?view=board", layout: "list" },
  { name: "board-pipeline", path: "/?view=board", layout: "pipeline" },
  { name: "inbox-triage", path: "/?view=inbox", inbox: "triage" },
  { name: "inbox-list", path: "/?view=inbox", inbox: "list" },
  { name: "job-detail", path: jobHref },
  { name: "settings", path: "/settings" },
  { name: "settings-model", path: "/settings/model" },
  { name: "settings-profile-ai", path: "/settings/profile-ai" },
  { name: "settings-scraping", path: "/settings/scraping" },
  { name: "settings-scrape-targets", path: "/settings/scrape-targets" },
  { name: "settings-export", path: "/settings/export" },
  { name: "settings-agents", path: "/settings/agents" },
  { name: "scrape-sources", path: "/scrape-sources" },
  { name: "styleguide", path: "/styleguide", optional: true },
  {
    name: "overlay-add-job", path: "/?view=board", layout: "list",
    setup: async (p) => { await p.getByRole("button", { name: /add (a )?job/i }).first().click(); await sleep(400); },
    viewportOnly: true, optional: true,
  },
  {
    name: "overlay-ask-deckhand", path: "/?view=board", layout: "pipeline",
    setup: async (p) => { await p.getByRole("button", { name: /ask deckhand/i }).first().click(); await sleep(500); },
    viewportOnly: true, optional: true,
  },
];

let browser = await chromium.launch({ channel: "chrome" });
async function run(theme, widths, suffix) {
  for (const s of SCREENS) {
    if (SKIP.has(s.name)) continue;
    for (const w of widths) {
      if (existsSync(join(OUT, `${s.name}--${w}${suffix}.png`)) && !process.env.FORCE) continue;
      if (!browser.isConnected()) browser = await chromium.launch({ channel: "chrome" });
      const ctx = await browser.newContext({ viewport: { width: w, height: HEIGHT[w] ?? 900 }, deviceScaleFactor: 1 });
      await ctx.addInitScript(({ theme, layout, inbox }) => {
        localStorage.setItem("theme", theme);
        if (layout) localStorage.setItem("board-filters", JSON.stringify({ layout, hiddenStatuses: ["declined"] }));
        if (inbox) localStorage.setItem("inbox-mode", inbox);
      }, { theme, layout: s.layout, inbox: s.inbox });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + s.path, { waitUntil: "networkidle", timeout: 60000 });
        await page.addStyleTag({ content: HIDE });
        await sleep(600);
        if (s.setup) await s.setup(page);
        const file = join(OUT, `${s.name}--${w}${suffix}.png`);
        await page.screenshot({ path: file, fullPage: !s.viewportOnly });
        console.log("ok  ", file);
      } catch (e) {
        console.log(s.optional ? "skip" : "FAIL", s.name, w, String(e.message).split("\n")[0]);
      }
      await ctx.close().catch(() => {});
    }
  }
}
await run("light", WIDTHS, "");
await run("dark", [WIDTHS[WIDTHS.length - 1]], "-dark");
await browser.close();
