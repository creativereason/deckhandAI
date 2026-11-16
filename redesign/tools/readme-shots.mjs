#!/usr/bin/env node
// README screenshots into docs/screenshots. Usage: node redesign/tools/readme-shots.mjs <design|onboarding> [baseUrl]
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const persona = process.argv[2];
const BASE = process.argv[3] ?? "http://localhost:3789";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const SHOTS = {
  design: [
    { name: "board-pipeline--desktop", path: "/", w: 1280, h: 800, layout: "pipeline" },
    { name: "today--desktop", path: "/?view=today", w: 1280, h: 800, panel: true },
    { name: "inbox-triage--desktop", path: "/?view=inbox", w: 1280, h: 800, inbox: "triage" },
    { name: "job-detail--desktop", path: "/job?section=applied&company=Stripe&role=Creative%20Director%2C%20Brand%20Experiences", w: 1280, h: 800 },
    { name: "board-pipeline-dark--desktop", path: "/", w: 1280, h: 800, layout: "pipeline", theme: "dark" },
    { name: "board-pipeline--mobile", path: "/", w: 390, h: 844, layout: "pipeline" },
  ],
  onboarding: [{ name: "onboarding-step1-filled--desktop", path: "/", w: 1280, h: 800, fill: true }],
}[persona];

const browser = await chromium.launch({ channel: "chrome" });
for (const s of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ s }) => {
    localStorage.setItem("theme", s.theme ?? "light");
    localStorage.setItem("assistant-open", String(!!s.panel));
    if (s.layout) localStorage.setItem("board-filters", JSON.stringify({ layout: s.layout, hiddenStatuses: ["declined"] }));
    if (s.inbox) localStorage.setItem("inbox-mode", s.inbox);
  }, { s });
  const page = await ctx.newPage();
  await page.goto(BASE + s.path, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  if (s.fill) await page.getByLabel(/first name/i).fill("Alex");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  console.log("ok", s.name);
  await ctx.close();
}
await browser.close();
