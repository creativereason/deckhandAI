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
import { spawn, exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);
import { mkdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { setTimeout as sleep } from "timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = join(ROOT, "screenshots");
const PORT = 3789;
const BASE = `http://localhost:${PORT}`;
const PASSWORD = "deckhandSample1233";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet",  width: 768,  height: 1024 },
  { name: "mobile",  width: 390,  height: 844 },
];

// Expected candidate name per persona — used to verify the right server is up
const PERSONA_CANDIDATE = {
  design:     "Alex Chen",
  dev:        "Jordan Rivera",
  onboarding: "",
};

const PERSONAS = [
  {
    name: "design",
    label: "Alex Chen — Designer",
    theme: "dark",
    env: { DEMO_PERSONA: "design" },
    appliedJob:  { company: "Stripe",    role: "Creative Director, Brand Experiences", section: "applied"  },
    prospectJob: { company: "Anthropic", role: "Head of Product Design",               section: "prospect" },
  },
  {
    name: "dev",
    label: "Jordan Rivera — Staff Engineer",
    theme: "light",
    env: { DEMO_PERSONA: "dev" },
    appliedJob:  { company: "Render",    role: "Staff Design Engineer",                section: "applied"  },
    prospectJob: { company: "Anthropic", role: "Software Engineer, Claude.ai Product", section: "prospect" },
  },
  {
    name: "onboarding",
    label: "Onboarding (empty state)",
    theme: "light",
    env: { DEMO_PERSONA: "onboarding" },
    appliedJob:  null,
    prospectJob: null,
  },
];

// ─── Server lifecycle ─────────────────────────────────────────────────────────

async function killExistingDevServer() {
  // Next.js 16 only allows one dev server per project — kill any existing instance first.
  // Find pids running `next dev` under this project root, then wait for ports to clear.
  try {
    const { stdout } = await execAsync(
      `pgrep -af "next dev" 2>/dev/null || true`
    );
    const pids = stdout
      .split("\n")
      .filter((line) => line.includes(ROOT) || line.includes("next dev"))
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean);

    if (pids.length) {
      process.stdout.write(`  Stopping existing dev server (PIDs: ${pids.join(", ")})…`);
      await execAsync(`kill ${pids.join(" ")} 2>/dev/null`).catch(() => {});
      await sleep(3000);
      process.stdout.write(" done\n");
    }
  } catch {
    // no existing server — fine
  }
}

function startServer(extraEnv = {}) {
  const env = {
    ...process.env,
    PORT: String(PORT),
    APP_PASSWORD: PASSWORD,
    DEMO_MODE: "true",
    // Deliberately omit NEXT_PUBLIC_DEMO_MODE — it only controls the "Demo
    // mode" banner in the UI, and marketing screenshots shouldn't show it.
    // DEMO_MODE alone still drives auth bypass + local sample fixtures.
    ...extraEnv,
  };

  const proc = spawn("pnpm", ["dev"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  proc.stdout.resume();
  proc.stderr.resume();

  return async function kill() {
    proc.kill("SIGTERM");
    await sleep(2000);
    // Force-clear the port — pnpm child processes survive SIGTERM
    await execAsync(`fuser -k ${PORT}/tcp 2>/dev/null`).catch(() => {});
    // Poll until the port is confirmed free
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        await fetch(`${BASE}/api/config`, { signal: AbortSignal.timeout(500) });
        await sleep(500);
      } catch {
        await sleep(800); // extra cushion for OS to release the port
        return;
      }
    }
  };
}

async function waitForServer(expectedPersona, timeoutMs = 120_000) {
  const expectedName = PERSONA_CANDIDATE[expectedPersona] ?? "";
  const deadline = Date.now() + timeoutMs;
  process.stdout.write("  Waiting for server");
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/config`, { signal: AbortSignal.timeout(2000) });
      if (res.status < 500) {
        const json = await res.json().catch(() => ({}));
        const name = json.candidate?.name ?? "";
        // Verify this is the correct persona server, not a leftover
        if (name !== expectedName) {
          throw new Error(
            `Port ${PORT} is serving wrong persona (got "${name}", expected "${expectedName}"). ` +
            `A stale server may still be running.`
          );
        }
        process.stdout.write(" ready\n");
        return;
      }
    } catch (err) {
      if (err.message.includes("wrong persona")) throw err;
    }
    process.stdout.write(".");
    await sleep(1000);
  }
  throw new Error(`Server (${expectedPersona}) did not start within timeout`);
}

// ─── Screenshot helpers ───────────────────────────────────────────────────────

const HIDE_DEV_UI = `
  nextjs-portal { display: none !important; }
  #__next-build-watcher { display: none !important; }
`;

async function shot(page, dir, name, { fullPage = false } = {}) {
  mkdirSync(dir, { recursive: true });
  await page.addStyleTag({ content: HIDE_DEV_UI }).catch(() => {});
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await sleep(250);
    const file = join(dir, `${name}--${vp.name}.png`);
    await page.screenshot({ path: file, fullPage });
    console.log(`    ${name}--${vp.name}.png`);
  }
}

// Desktop-only screenshot — used for onboarding step walkthroughs
async function shotDesktop(page, dir, name, { fullPage = false } = {}) {
  mkdirSync(dir, { recursive: true });
  await page.addStyleTag({ content: HIDE_DEV_UI }).catch(() => {});
  await page.setViewportSize({ width: 1440, height: 900 });
  await sleep(250);
  const file = join(dir, `${name}--desktop.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(`    ${name}--desktop.png`);
}

function applyTheme(ctx, theme) {
  return ctx.addInitScript((t) => {
    localStorage.setItem("theme", t);
    if (t === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, theme);
}

async function newLoggedInPage(browser, theme = "light") {
  const ctx = await browser.newContext();
  await applyTheme(ctx, theme);
  await ctx.request.post(`${BASE}/api/auth/login`, { data: { password: PASSWORD } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(1000);
  return { page, ctx };
}

// ─── Individual screen captures ───────────────────────────────────────────────

async function captureLogin(browser, dir, theme = "light") {
  console.log("  → login");
  const ctx = await browser.newContext();
  await applyTheme(ctx, theme);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await shot(page, dir, "login");
  await ctx.close();
}

async function captureBoard(browser, dir, theme = "light") {
  console.log("  → board");
  const { page, ctx } = await newLoggedInPage(browser, theme);
  await sleep(400);
  await shot(page, dir, "board", { fullPage: true });
  await ctx.close();
}

async function captureChat(browser, dir, theme = "light") {
  console.log("  → chat (open)");
  const { page, ctx } = await newLoggedInPage(browser, theme);
  await sleep(400);
  await shot(page, dir, "chat-open");

  // Desktop only: type a question, capture it ready to send, then actually
  // send it and capture the live AI reply.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addStyleTag({ content: HIDE_DEV_UI }).catch(() => {});
  const input = page.locator('input[placeholder="Message…"]').last();
  if (await input.isVisible().catch(() => false)) {
    await input.fill("Show me my strong-fit prospects");
    await sleep(200);
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: join(dir, "chat-with-input--desktop.png") });
    console.log("    chat-with-input--desktop.png");

    console.log("  → chat (sent, waiting for AI reply)");
    await page.getByRole("button", { name: "Send" }).click();
    // Assistant replies render in a bubble with this corner-radius class —
    // wait for one to appear rather than a fixed sleep, since AI latency varies.
    await page.locator(".rounded-tl-sm").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    await sleep(400);
    await page.screenshot({ path: join(dir, "chat-with-reply--desktop.png") });
    console.log("    chat-with-reply--desktop.png");
  }

  await ctx.close();
}

// "Show:" section-visibility toggle buttons carry aria-pressed; scope on that
// so we never collide with same-labeled text elsewhere on the board (e.g. the
// "Applied 12" accordion trigger).
function sectionVisibilityToggle(page, label) {
  return page.locator(`button[aria-pressed]:text-is("${label}")`);
}

// "Approve all" fires one sonner toast per job, staggered as each request
// resolves. A fullPage screenshot captures fixed-position elements (like
// toasts) at whatever scroll offset they land on, so a lingering toast can
// appear to overlap board content rather than sit at the true viewport
// bottom. Wait until none remain before shooting.
async function waitForToastsToClear(page, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = await page.locator("[data-sonner-toast]").count();
    if (count === 0) return;
    await sleep(300);
  }
}

async function captureBoardAcceptedAndViews(browser, dir, theme = "light") {
  console.log("  → board (pending approved)");
  const { page, ctx } = await newLoggedInPage(browser, theme);
  await sleep(400);

  const approveAll = page.getByRole("button", { name: "Approve all" });
  if (await approveAll.isVisible().catch(() => false)) {
    await approveAll.click();
    await page.getByText("Scrape review queue").waitFor({ state: "detached", timeout: 20_000 }).catch(() => {});
    await waitForToastsToClear(page);
  }
  await shot(page, dir, "board-accepted-all", { fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addStyleTag({ content: HIDE_DEV_UI }).catch(() => {});

  // Views toggle — isolate each section in turn (starts with all three shown)
  console.log("  → views toggle: applied only");
  await sectionVisibilityToggle(page, "Prospects").click();
  await sectionVisibilityToggle(page, "Passed").click();
  await sleep(250);
  await shotDesktop(page, dir, "views-applied-only", { fullPage: true });

  console.log("  → views toggle: prospects only (strong fit)");
  await sectionVisibilityToggle(page, "Applied").click();
  await sectionVisibilityToggle(page, "Prospects").click();
  await sleep(250);
  // The fit filter only makes sense — and only renders — while prospects is
  // the isolated view, so capture it here instead of as a separate state.
  const strongFit = page.getByRole("button", { name: "Strong", exact: true });
  if (await strongFit.isVisible().catch(() => false)) {
    await strongFit.click();
    await sleep(250);
  }
  await shotDesktop(page, dir, "views-prospects-only", { fullPage: true });
  const allFit = page.getByRole("button", { name: "All", exact: true });
  if (await allFit.isVisible().catch(() => false)) {
    await allFit.click(); // reset the fit filter before moving on
    await sleep(150);
  }

  console.log("  → views toggle: passed only");
  await sectionVisibilityToggle(page, "Prospects").click();
  await sectionVisibilityToggle(page, "Passed").click();
  await sleep(250);
  await shotDesktop(page, dir, "views-passed-only", { fullPage: true });

  // Restore all three sections before closing this page
  await sectionVisibilityToggle(page, "Applied").click();
  await sectionVisibilityToggle(page, "Prospects").click();

  await ctx.close();
}

async function captureJobDetail(browser, dir, { company, role, section, label }, theme = "light") {
  console.log(`  → job detail: ${company} (${label})`);
  const { page, ctx } = await newLoggedInPage(browser, theme);
  const url = `${BASE}/job?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&section=${section}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(500);
  await shot(page, dir, `job-detail-${label}`);
  await ctx.close();
}

async function captureSettings(browser, dir, theme = "light") {
  console.log("  → settings");
  const { page, ctx } = await newLoggedInPage(browser, theme);
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(400);
  await shot(page, dir, "settings");
  await ctx.close();
}

async function captureSettingsModel(browser, dir, theme = "light") {
  console.log("  → settings / model");
  const { page, ctx } = await newLoggedInPage(browser, theme);
  await page.goto(`${BASE}/settings/model`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(400);
  await shot(page, dir, "settings-model");
  await ctx.close();
}

async function captureSettingsProfileAI(browser, dir, theme = "light") {
  console.log("  → settings / profile & AI");
  const { page, ctx } = await newLoggedInPage(browser, theme);
  await page.goto(`${BASE}/settings/profile-ai`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(400);
  await shot(page, dir, "settings-profile-ai");
  await ctx.close();
}

async function captureSettingsExport(browser, dir, theme = "light") {
  console.log("  → settings / export style");
  const { page, ctx } = await newLoggedInPage(browser, theme);
  await page.goto(`${BASE}/settings/export`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(400);
  await shot(page, dir, "settings-export");
  await ctx.close();
}

async function captureLoginWithForgot(browser, dir, theme = "light") {
  console.log("  → login (forgot password open)");
  const ctx = await browser.newContext();
  await applyTheme(ctx, theme);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(600);
  await page.getByRole("button", { name: /forgot password/i }).click();
  await sleep(300);
  await shotDesktop(page, dir, "login-forgot-password");
  await ctx.close();
}

async function captureOnboardingSteps(browser, dir, theme = "light") {
  const ctx = await browser.newContext();
  await applyTheme(ctx, theme);
  await ctx.request.post(`${BASE}/api/auth/login`, { data: { password: PASSWORD } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(800);

  // Step 1 — contact (empty, as first seen)
  console.log("  → onboarding step 1 (empty)");
  await shotDesktop(page, dir, "onboarding-step1-empty");

  // Fill step 1 — inputs appear in order: first name, last name, email, phone, website, linkedin
  const inp = (n) => page.locator('input').nth(n);
  await inp(0).fill("Alex");
  await inp(1).fill("Chen");
  await inp(2).fill("alex@alexchen.design");
  await inp(3).fill("(415) 555-0182");
  await inp(4).fill("https://alexchen.design");
  await inp(5).fill("https://linkedin.com/in/alexchenux");
  await sleep(200);
  console.log("  → onboarding step 1 (filled)");
  await shotDesktop(page, dir, "onboarding-step1-filled");

  // Step 2 — location: city, state, zip, radius (inputs 0–3 on this step)
  await page.getByRole("button", { name: "Continue" }).click();
  await sleep(400);
  await page.locator('input').nth(0).fill("San Francisco");
  await page.locator('input').nth(1).fill("CA");
  await page.locator('input').nth(2).fill("94105");
  // radius input (nth 3) already has "25" — leave it
  await sleep(200);
  console.log("  → onboarding step 2");
  await shotDesktop(page, dir, "onboarding-step2");

  // Step 3 — job preferences: textarea, min fte, min hourly
  await page.getByRole("button", { name: "Continue" }).click();
  await sleep(400);
  await page.locator('textarea').fill("Head of Design\nDirector of Product Design\nPrincipal Designer\nDesign Lead");
  await page.locator('input[type="number"]').nth(0).fill("180000");
  await page.locator('input[type="number"]').nth(1).fill("90");
  await sleep(200);
  console.log("  → onboarding step 3");
  await shotDesktop(page, dir, "onboarding-step3");

  // Step 4 — you're all set
  await page.getByRole("button", { name: "Continue" }).click();
  await sleep(400);
  console.log("  → onboarding step 4");
  await shotDesktop(page, dir, "onboarding-step4");

  await ctx.close();
}

// ─── Per-persona run ──────────────────────────────────────────────────────────

async function runPersona(browser, persona) {
  const dir = join(OUT, persona.name);
  const theme = persona.theme ?? "light";
  mkdirSync(dir, { recursive: true });

  await captureLogin(browser, dir, theme);

  if (persona.name === "onboarding") {
    await captureLoginWithForgot(browser, dir, theme);
    await captureOnboardingSteps(browser, dir, theme);
    return;
  }

  await captureBoard(browser, dir, theme);
  await captureChat(browser, dir, theme);
  await captureBoardAcceptedAndViews(browser, dir, theme);

  if (persona.appliedJob) {
    await captureJobDetail(browser, dir, { ...persona.appliedJob, label: "applied" }, theme);
  }
  if (persona.prospectJob) {
    await captureJobDetail(browser, dir, { ...persona.prospectJob, label: "prospect" }, theme);
  }

  // Settings pages — only needed once, use design persona
  if (persona.name === "design") {
    await captureSettings(browser, dir, theme);
    await captureSettingsModel(browser, dir, theme);
    await captureSettingsProfileAI(browser, dir, theme);
    await captureSettingsExport(browser, dir, theme);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Optional: filter by persona name(s) passed as args, e.g. `node scripts/screenshots.mjs onboarding design`
  const filter = process.argv.slice(2);
  const targets = filter.length
    ? PERSONAS.filter((p) => filter.includes(p.name))
    : PERSONAS;

  if (filter.length && targets.length === 0) {
    console.error(`No matching personas for: ${filter.join(", ")}`);
    console.error(`Available: ${PERSONAS.map((p) => p.name).join(", ")}`);
    process.exit(1);
  }

  console.log("deckhandAI screenshot capture\n");

  await killExistingDevServer();

  const browser = await chromium.launch({ headless: true });

  for (const persona of targets) {
    console.log(`\n── ${persona.label} (${persona.name}) ──`);
    const kill = startServer(persona.env);
    try {
      await waitForServer(persona.name);
      // Warm up JS bundles with a real browser page so later navigations don't cold-compile
      process.stdout.write("  Compiling pages");
      const warmCtx = await browser.newContext();
      const warmPage = await warmCtx.newPage();
      await warmPage.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await warmPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch(() => {});
      await warmCtx.close();
      process.stdout.write(" done\n");
      await runPersona(browser, persona);
    } finally {
      await kill();
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
