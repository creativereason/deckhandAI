#!/usr/bin/env node
/**
 * scripts/screenshots.mjs
 *
 * Captures marketing screenshots of deckhandAI across all demo personas and
 * three viewport widths (desktop, tablet, mobile).
 *
 * Usage:
 *   node scripts/screenshots.mjs
 *
 * Prerequisites:
 *   npx playwright install chromium
 *
 * Output:
 *   screenshots/
 *     design/       Alex Chen — designer persona
 *     dev/          Jordan Rivera — developer persona
 *     onboarding/   First-run empty state
 */

import { chromium } from "playwright";
import { spawn } from "child_process";
import { mkdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { setTimeout as sleep } from "timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "screenshots");
const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const PASSWORD = "deckhandSample1233";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet",  width: 768,  height: 1024 },
  { name: "mobile",  width: 390,  height: 844 },
];

// Jobs to use for detail-page screenshots in each persona
const PERSONAS = [
  {
    name: "design",
    label: "Alex Chen — Designer",
    env: { DEMO_PERSONA: "design" },
    appliedJob:  { company: "Stripe",       role: "Creative Director, Brand Experiences",  section: "applied"  },
    offerJob:    { company: "Loom",          role: "Director of Product Design",             section: "applied"  },
    prospectJob: { company: "Anthropic",     role: "Head of Product Design",                section: "prospect" },
  },
  {
    name: "dev",
    label: "Jordan Rivera — Staff Engineer",
    env: { DEMO_PERSONA: "dev" },
    appliedJob:  { company: "Render",        role: "Staff Design Engineer",                 section: "applied"  },
    offerJob:    { company: "Stripe",         role: "Senior Software Engineer, Dashboard",   section: "applied"  },
    prospectJob: { company: "Anthropic",     role: "Software Engineer, Claude.ai Product",  section: "prospect" },
  },
  {
    name: "onboarding",
    label: "Onboarding (empty state)",
    env: { DEMO_PERSONA: "onboarding" },
    appliedJob:  null,
    offerJob:    null,
    prospectJob: null,
  },
];

// ─── Server lifecycle ─────────────────────────────────────────────────────────

function startServer(extraEnv = {}) {
  const env = {
    ...process.env,
    PORT: String(PORT),
    APP_PASSWORD: PASSWORD,
    DEMO_MODE: "true",
    NEXT_PUBLIC_DEMO_MODE: "true",
    ...extraEnv,
  };

  const proc = spawn("pnpm", ["dev"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  // Swallow output — we only care about readiness
  proc.stdout.resume();
  proc.stderr.resume();

  return async function kill() {
    proc.kill("SIGTERM");
    await sleep(1500); // let port drain
  };
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  process.stdout.write("  Waiting for server");
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/login`);
      if (res.status < 500) { process.stdout.write(" ready\n"); return; }
    } catch { /* not up yet */ }
    process.stdout.write(".");
    await sleep(1000);
  }
  throw new Error("Server did not start within timeout");
}

// ─── Screenshot helpers ───────────────────────────────────────────────────────

async function shot(page, dir, name, { fullPage = false } = {}) {
  mkdirSync(dir, { recursive: true });
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await sleep(250);
    const file = join(dir, `${name}--${vp.name}.png`);
    await page.screenshot({ path: file, fullPage });
    console.log(`    ${name}--${vp.name}.png`);
  }
}

async function newLoggedInPage(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
  await sleep(500);
  return { page, ctx };
}

// ─── Screen captures ──────────────────────────────────────────────────────────

async function captureLogin(browser, dir) {
  console.log("  → login");
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await shot(page, dir, "login");
  await ctx.close();
}

async function captureBoard(browser, dir) {
  console.log("  → board");
  const { page, ctx } = await newLoggedInPage(browser);
  // Ensure all accordion sections are open — they default to open, just confirm
  await sleep(400);
  await shot(page, dir, "board", { fullPage: true });
  await ctx.close();
}

async function captureBoardFiltered(browser, dir) {
  console.log("  → board (strong fit filter)");
  const { page, ctx } = await newLoggedInPage(browser);
  // Click the "Strong" fit filter chip
  const strongBtn = page.getByRole("button", { name: /strong/i }).first();
  if (await strongBtn.isVisible()) {
    await strongBtn.click();
    await sleep(300);
  }
  await shot(page, dir, "board-filtered-strong");
  await ctx.close();
}

async function captureJobDetail(browser, dir, { company, role, section, label }) {
  console.log(`  → job detail: ${company}`);
  const { page, ctx } = await newLoggedInPage(browser);
  const url = `${BASE}/job?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&section=${section}`;
  await page.goto(url, { waitUntil: "networkidle" });
  await sleep(500);
  await shot(page, dir, `job-detail-${label}`);

  // Edit mode
  const editBtn = page.getByRole("button", { name: /^edit$/i }).first();
  if (await editBtn.isVisible()) {
    await editBtn.click();
    await sleep(300);
    await shot(page, dir, `job-detail-${label}-edit`);
    // Cancel back
    const cancelBtn = page.getByRole("button", { name: /cancel/i }).first();
    if (await cancelBtn.isVisible()) await cancelBtn.click();
  }

  await ctx.close();
}

async function captureSettings(browser, dir) {
  console.log("  → settings");
  const { page, ctx } = await newLoggedInPage(browser);
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await sleep(400);
  await shot(page, dir, "settings");
  await ctx.close();
}

async function captureSettingsModel(browser, dir) {
  console.log("  → settings / model");
  const { page, ctx } = await newLoggedInPage(browser);
  await page.goto(`${BASE}/settings/model`, { waitUntil: "networkidle" });
  await sleep(400);
  await shot(page, dir, "settings-model");
  await ctx.close();
}

async function captureOnboarding(browser, dir) {
  console.log("  → onboarding wizard");
  const { page, ctx } = await newLoggedInPage(browser);
  // The wizard auto-shows when candidate.name is missing — just wait for it
  await sleep(600);
  await shot(page, dir, "onboarding-wizard");
  await ctx.close();
}

async function captureEmptyBoard(browser, dir) {
  console.log("  → empty board (dismiss wizard)");
  const { page, ctx } = await newLoggedInPage(browser);
  await sleep(600);
  // Dismiss wizard if present — look for a skip/close button
  const skipBtn = page.getByRole("button", { name: /skip|close|later|dismiss/i }).first();
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
    await sleep(400);
  }
  await shot(page, dir, "empty-board");
  await ctx.close();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runPersona(browser, persona) {
  const dir = join(OUT, persona.name);
  mkdirSync(dir, { recursive: true });

  await captureLogin(browser, dir);

  if (persona.name === "onboarding") {
    await captureOnboarding(browser, dir);
    await captureEmptyBoard(browser, dir);
    return;
  }

  await captureBoard(browser, dir);
  if (persona.prospectJob) await captureBoardFiltered(browser, dir);

  if (persona.appliedJob) {
    await captureJobDetail(browser, dir, { ...persona.appliedJob, label: "applied" });
  }
  if (persona.offerJob) {
    await captureJobDetail(browser, dir, { ...persona.offerJob, label: "offer" });
  }
  if (persona.prospectJob) {
    await captureJobDetail(browser, dir, { ...persona.prospectJob, label: "prospect" });
  }

  // Settings only need one persona's pass
  if (persona.name === "design") {
    await captureSettings(browser, dir);
    await captureSettingsModel(browser, dir);
  }
}

async function main() {
  console.log("deckhandAI screenshot capture\n");

  const browser = await chromium.launch({ headless: true });

  for (const persona of PERSONAS) {
    console.log(`\n── ${persona.label} (${persona.name}) ──`);

    const kill = startServer(persona.env);
    try {
      await waitForServer();
      await runPersona(browser, persona);
    } finally {
      await kill();
      await sleep(2000); // ensure port 3000 is free before next server
    }
  }

  await browser.close();

  console.log(`\n✓ Done. Screenshots saved to screenshots/`);
  console.log("  Tip: open screenshots/ in Finder to browse them.");
}

main().catch((err) => {
  console.error("\n✗", err.message);
  process.exit(1);
});
