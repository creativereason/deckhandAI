#!/usr/bin/env node
// Runs axe (WCAG 2.x A/AA) on every route, light and dark, at 390 / 768 / 1280. Prints serious and critical violations.
// Usage: node redesign/tools/axe.mjs [baseUrl]   (needs the demo-mode dev server, see redesign/README.md)
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.argv[2] ?? "http://localhost:3789";
const jobs = await (await fetch(`${BASE}/api/jobs`)).json();
const first = jobs.applied[0];
const jobHref = `/job?${new URLSearchParams({ section: "applied", company: first.company, role: first.role })}`;

const ROUTES = [
  ["login", "/login"], ["today", "/?view=today"], ["board-list", "/", "list"], ["board-pipeline", "/", "pipeline"],
  ["inbox-triage", "/?view=inbox", null, "triage"], ["inbox-list", "/?view=inbox", null, "list"], ["job", jobHref],
  ["settings", "/settings"], ["settings-scraping", "/settings/scraping"], ["settings-targets", "/settings/scrape-targets"],
  ["settings-profile-ai", "/settings/profile-ai"], ["settings-model", "/settings/model"], ["settings-export", "/settings/export"],
  ["settings-agents", "/settings/agents"], ["scrape-sources", "/scrape-sources"], ["styleguide", "/styleguide"],
];
const RUNS = [[390, "light"], [768, "light"], [1280, "light"], [1280, "dark"], [390, "dark"]];

let browser = await chromium.launch({ channel: "chrome" });
let bad = 0;
for (const [name, path, layout, inbox] of ROUTES) {
  for (const [w, theme] of RUNS) {
    let ctx;
    for (let attempt = 0; attempt < 3 && !ctx; attempt++) {
      try {
        if (!browser.isConnected()) browser = await chromium.launch({ channel: "chrome" });
        ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      } catch { await browser.close().catch(() => {}); browser = await chromium.launch({ channel: "chrome" }); }
    }
    await ctx.addInitScript(({ theme, layout, inbox }) => {
      localStorage.setItem("theme", theme);
      localStorage.setItem("assistant-open", "false");
      if (layout) localStorage.setItem("board-filters", JSON.stringify({ layout, hiddenStatuses: ["declined"] }));
      if (inbox) localStorage.setItem("inbox-mode", inbox);
    }, { theme, layout, inbox });
    let done = false;
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      try {
        if (attempt > 0 || !browser.isConnected()) { await ctx.close().catch(() => {}); await browser.close().catch(() => {}); browser = await chromium.launch({ channel: "chrome" }); ctx = await browser.newContext({ viewport: { width: w, height: 900 } }); await ctx.addInitScript(({ theme, layout, inbox }) => { localStorage.setItem("theme", theme); localStorage.setItem("assistant-open", "false"); if (layout) localStorage.setItem("board-filters", JSON.stringify({ layout, hiddenStatuses: ["declined"] })); if (inbox) localStorage.setItem("inbox-mode", inbox); }, { theme, layout, inbox }); }
        const page = await ctx.newPage();
        await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 60000 });
        await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
        await page.waitForTimeout(500);
        const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("nextjs-portal").analyze();
        const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        for (const v of serious) {
          bad++;
          console.log(`${v.impact.toUpperCase()} ${name} ${w} ${theme}: ${v.id} — ${v.help} (${v.nodes.length})\n   ${v.nodes.slice(0, 2).map((n) => n.target.join(" ") + " :: " + (n.html || "").slice(0, 90)).join("\n   ")}`);
        }
        if (!serious.length) console.log(`ok  ${name} ${w} ${theme}`);
        done = true;
      } catch (e) {
        if (attempt === 2) { bad++; console.log(`ERR ${name} ${w} ${theme}: ${String(e.message).split("\n")[0]}`); }
      }
    }
    await ctx.close().catch(() => {});
  }
}
await browser.close();
console.log(bad ? `\n${bad} serious/critical issue(s)` : "\nno serious or critical violations");
process.exit(bad ? 1 : 0);
