#!/usr/bin/env node
/**
 * Standalone career page scraper for cloud routines.
 * Runs all automated targets (remote + local), filters qualifying roles,
 * appends new entries to jobs.json, and commits + pushes.
 *
 * Usage: node scripts/scrape-careers.mjs
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JOBS_PATH = resolve(__dirname, "../data/jobs.json");
const CONFIG_PATH = resolve(__dirname, "../data/config.json");

// ---------------------------------------------------------------------------
// Filters (mirrors lib/scrape-filters.ts)
// ---------------------------------------------------------------------------
const LEVEL_INCLUDE = /senior|lead|director|manager|principal|head|\bvp\b/i;
const LEVEL_EXCLUDE = /associate|junior|intern|entry|mid-level/i;
const TITLE_INCLUDE =
  /\bux\b|\bui\b.{0,10}design|user experience|experience design|product design|product designer|design lead|design director|service design|design manager|design ops|designops|creative director|creative lead|head of design|design system|interaction design|\bdesigner\b|product director|director.{0,10}product|head of product/i;
const LOCATION_REMOTE = /remote/i;

function buildLocalRegex() {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    const city = config.preferences?.locations?.hub_city;
    const state = config.preferences?.locations?.hub_state;
    if (!city && !state) return /(?!)/;
    const terms = [city, state].filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(terms.join("|"), "i");
  } catch {
    return /(?!)/; // no config — match nothing
  }
}

const LOCATION_LOCAL = buildLocalRegex();

const DEFAULT_SELECTORS = [
  ".job-title a",
  ".job-title",
  "[data-automation-id='jobTitle']",
  ".opening-title a",
  ".opening-title",
  ".posting-title",
  ".job-listing-title",
  "h3 a[href*='job']",
];

function isQualifyingRemoteOrLocal(title, location) {
  const loc = location || title;
  return (
    TITLE_INCLUDE.test(title) &&
    LEVEL_INCLUDE.test(title) &&
    !LEVEL_EXCLUDE.test(title) &&
    (LOCATION_REMOTE.test(loc) || LOCATION_LOCAL.test(loc))
  );
}

function isQualifyingAssumeLocal(title, location, href = "", trustLocationFilter = false) {
  const loc = `${location} ${href} ${title}`;
  if (LOCATION_REMOTE.test(loc) && !LOCATION_LOCAL.test(loc)) return false;
  const titleOk =
    TITLE_INCLUDE.test(title) &&
    LEVEL_INCLUDE.test(title) &&
    !LEVEL_EXCLUDE.test(title);
  if (!titleOk) return false;
  if (trustLocationFilter) return true;
  return LOCATION_LOCAL.test(loc);
}

function isLocalListing(title, location) {
  const loc = location || title;
  return LOCATION_LOCAL.test(loc) && !LOCATION_REMOTE.test(loc);
}

// ---------------------------------------------------------------------------
// Targets (mirrors lib/scrape-targets.ts)
// ---------------------------------------------------------------------------
const REMOTE_TARGETS = [
  {
    company: "Accenture",
    url: "https://www.accenture.com/us-en/careers/jobsearch?aoi=Consulting%7CProduct%20Development%7CTechnology%7CCreative%20%26%20Design&et=Full-time&jt=Senior%20Level",
    selector: '[class*="job"] a[href*="jobdetails"], [class*="card"] a[href*="jobdetails"]',
    dismissCookieText: "Accept Only Required",
    paginateByRole: true,
    titleFromUrlParam: "title",
  },
  // --- Add your own remote targets below ---
  // Example format:
  // {
  //   company: "Acme Corp",
  //   url: "https://acme.com/careers?q=designer",
  //   selector: ".job-title a",
  //   linkBase: "https://acme.com",
  // },
];


const LOCAL_TARGETS = [
  // --- Add your own local/hybrid targets below ---
  // Set assumeLocal: true for companies in your metro area whose career sites
  // don't filter by location in the URL. trustLocationFilter: true skips the
  // location regex check (use when the URL already filters by your city).
  //
  // Example:
  // {
  //   company: "Acme Corp",
  //   url: "https://careers.acme.com/jobs?q=design&location=Chicago",
  //   selector: "a[href*='/job/']",
  //   linkBase: "https://careers.acme.com",
  //   assumeLocal: true,
  //   trustLocationFilter: true,
  //   waitMs: 5000,
  // },
  {
    company: "Centene",
    url: "https://jobs.centene.com/us/en/jobs/?keyword=design",
    selector: "a[href*='/us/en/jobs/']",
    linkBase: "https://jobs.centene.com",
    assumeLocal: false,
    waitMs: 10000,
  },
  {
    company: "Maritz",
    url: "https://maritz.wd1.myworkdayjobs.com/Maritz",
    selector: "[data-automation-id='jobTitle']",
    linkBase: "https://maritz.wd1.myworkdayjobs.com",
    assumeLocal: true,
    trustLocationFilter: true,
    waitMs: 10000,
  },
];

// ---------------------------------------------------------------------------
// Playwright helpers
// ---------------------------------------------------------------------------
function cleanTitle(title, prefix) {
  let t = title.replace(/\s+/g, " ").trim();
  if (prefix && t.startsWith(prefix)) t = t.slice(prefix.length).trim();
  return t;
}

async function extractListings(page, preferredSelector, titlePrefix, titleFromUrlParam) {
  const selectors = preferredSelector
    ? [preferredSelector, ...DEFAULT_SELECTORS.filter((s) => s !== preferredSelector)]
    : DEFAULT_SELECTORS;

  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      if (count === 0) continue;

      const listings = await page.$$eval(
        selector,
        (els, param) =>
          els.map((el) => {
            const href =
              el instanceof HTMLAnchorElement
                ? el.href
                : el.querySelector("a")?.getAttribute("href") ?? "";
            let title = el.textContent?.trim() ?? "";
            if (param && href) {
              try {
                const p = new URL(href).searchParams.get(param);
                if (p) title = p.replace(/\+/g, " ");
              } catch {}
            }
            return {
              title,
              href,
              location:
                el
                  .closest(
                    "[class*='job'], [class*='listing'], [class*='result'], li, article, tr"
                  )
                  ?.textContent ?? "",
            };
          }),
        titleFromUrlParam
      );

      const seen = new Set();
      const withTitles = listings
        .map((l) => ({ ...l, title: cleanTitle(l.title, titlePrefix) }))
        .filter((l) => {
          if (l.title.length <= 2 || seen.has(l.href)) return false;
          seen.add(l.href);
          return true;
        });

      if (withTitles.length > 0) return { listings: withTitles, selector };
    } catch {
      continue;
    }
  }

  return { listings: [], selector: preferredSelector ?? DEFAULT_SELECTORS[0] };
}

async function scrapeTarget(browser, target) {
  const page = await browser.newPage();
  const log = { company: target.company, listings: 0, qualifying: 0, added: 0, errors: [] };

  try {
    await page.goto(target.url, { timeout: 60000, waitUntil: "domcontentloaded" });
    const defaultWait = target.paginateByRole ? 8000 : target.useIframe ? 5000 : 3000;
    await page.waitForTimeout(target.waitMs ?? defaultWait);

    if (target.dismissCookieText) {
      try {
        const btn = page.getByRole("button", { name: target.dismissCookieText });
        if (await btn.count() > 0) {
          await btn.first().click({ timeout: 5000 });
          await page.waitForTimeout(1500);
        }
      } catch {}
    }

    let listingPage = page;
    if (target.useIframe) {
      const frame = page.frames().find((f) => f.url().includes("in_iframe"));
      if (frame) listingPage = frame;
    }

    const allListings = [];

    if (target.paginateByRole) {
      let pageNum = 1;
      while (true) {
        const { listings } = await extractListings(
          listingPage,
          target.selector,
          target.titlePrefix,
          target.titleFromUrlParam
        );
        allListings.push(...listings);
        const nextBtn = listingPage.getByRole("button", { name: `Page ${pageNum + 1}` });
        if (await nextBtn.count() === 0) break;
        await nextBtn.evaluate((el) => el.click());
        await listingPage.waitForTimeout(4000);
        pageNum++;
      }
    } else {
      const { listings } = await extractListings(
        listingPage,
        target.selector,
        target.titlePrefix,
        target.titleFromUrlParam
      );
      allListings.push(...listings);
    }

    log.listings = allListings.length;
    return { log, listings: allListings };
  } catch (err) {
    log.errors.push(err.message);
    return { log, listings: [] };
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Detect system Chromium for CCR environments where cdn.playwright.dev is blocked
// ---------------------------------------------------------------------------
function findSystemChromium() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    // CCR pre-installs Playwright browsers here; glob for any revision
    ...(() => {
      try {
        return execSync("find /opt/pw-browsers -name 'chrome' -o -name 'chromium' 2>/dev/null", { encoding: "utf-8" })
          .split("\n").filter(Boolean);
      } catch { return []; }
    })(),
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      execSync(`test -x "${p}"`, { stdio: "ignore" });
      return p;
    } catch {}
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Try to import playwright; install if missing (local dev path)
  try {
    await import("playwright");
  } catch {
    console.log("Installing playwright (npm package only)...");
    execSync("PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright --no-save --silent", {
      stdio: "inherit",
    });
  }
  const { chromium } = await import("playwright");

  // Resolve Chromium executable — prefer system browser in CCR to avoid download
  const systemChromium = findSystemChromium();
  if (systemChromium) {
    console.log(`Using system Chromium: ${systemChromium}`);
  } else {
    console.log("No system Chromium found, using Playwright default.");
  }

  const today = new Date().toISOString().split("T")[0];

  // Ensure we're on main and up to date (CCR checks out a detached HEAD)
  execSync("git checkout main 2>/dev/null || git checkout -b main --track origin/main", { stdio: "inherit" });
  execSync("git pull --rebase origin main", { stdio: "inherit" });

  const jobs = JSON.parse(readFileSync(JOBS_PATH, "utf-8"));

  const existingKeys = new Set([
    ...jobs.prospect.map((j) => `${j.company}|${j.role}`),
    ...jobs.local.map((j) => `${j.company}|${j.role}`),
    ...jobs.applied.map((j) => `${j.company}|${j.role}`),
    ...jobs.passed.map((j) => `${j.company}|${j.role}`),
    ...jobs.staffing.map((j) => `${j.company}|${j.role}`),
  ]);

  const launchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--ignore-certificate-errors",
      "--disable-dev-shm-usage",
    ],
  };
  if (systemChromium) launchOptions.executablePath = systemChromium;

  const browser = await chromium.launch(launchOptions);
  const allTargets = [...REMOTE_TARGETS, ...LOCAL_TARGETS];
  const summary = [];
  let totalAdded = 0;

  try {
    for (const target of allTargets) {
      console.log(`\nScraping ${target.company}...`);
      const { log, listings } =
        await scrapeTarget(browser, target);

      for (const item of listings) {
        const href = item.href
          ? item.href.startsWith("http")
            ? item.href
            : `${target.linkBase ?? ""}${item.href}`
          : target.url;

        const qualifies = target.assumeLocal
          ? isQualifyingAssumeLocal(item.title, item.location, href, target.trustLocationFilter)
          : isQualifyingRemoteOrLocal(item.title, item.location);

        if (!qualifies) continue;
        log.qualifying++;

        const key = `${target.company}|${item.title}`;
        if (existingKeys.has(key)) continue;

        const isLocal =
          target.assumeLocal || isLocalListing(item.title, `${item.location} ${href}`);

        const job = {
          company: target.company,
          role: item.title,
          fit: LEVEL_INCLUDE.test(item.title) ? "good" : "caution",
          salary: "",
          notes: `Scraped ${today} via career page.`,
          url: href,
          isNew: true,
        };

        if (isLocal) {
          jobs.local.unshift(job);
        } else {
          jobs.prospect.unshift(job);
        }
        existingKeys.add(key);
        log.added++;
        totalAdded++;
      }

      summary.push(log);
      console.log(
        `  ${target.company}: ${log.listings} listings, ${log.qualifying} qualifying, ${log.added} added${log.errors.length ? ` | ERROR: ${log.errors[0]}` : ""}`
      );
    }
  } finally {
    await browser.close();
  }

  if (totalAdded > 0) {
    writeFileSync(JOBS_PATH, JSON.stringify(jobs, null, 2));
    execSync("git config user.email 'routine@claude.ai'", { stdio: "inherit" });
    execSync("git config user.name 'Claude Routine'", { stdio: "inherit" });
    execSync("git add jobs.json", { stdio: "inherit" });
    execSync(`git commit -m "Scrape career pages: ${totalAdded} new role(s) added (${today})"`, {
      stdio: "inherit",
    });
    execSync("git push", { stdio: "inherit" });
    console.log(`\nDone. ${totalAdded} new role(s) added and pushed.`);
  } else {
    console.log("\nDone. No new qualifying roles found.");
  }

  console.log("\nSummary:");
  for (const s of summary) {
    console.log(`  ${s.company}: ${s.listings} seen, ${s.qualifying} qualifying, ${s.added} new`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
