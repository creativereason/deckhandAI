/**
 * Scrape staffing firm job boards for UX/design/product roles.
 * Adds results to jobs.json under the "staffing" category.
 *
 * Run: node scripts/scrape-staffing.mjs
 *
 * Coverage:
 *   Robert Half   — interactive search (SPA, keyword URL param ignored by DOM)
 *   Kforce        — hash-routing SPA, h2 a selector works
 *   Insight Global — JS-rendered, networkidle wait
 *
 * Not scrapable via Playwright (no public job board):
 *   TekSystems    — /en/jobs 404s; /en/careers is for internal TEKsystems hires
 *   Apex Systems  — rebranded to "Everforth Apex", no job board
 *   Experis       — ManpowerGroup brand, job search not publicly rendered
 *   Oakwood Systems — local boutique firm, no jobs page
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const JOBS_PATH = resolve(process.cwd(), "jobs.json");

const DESIGN_KEYWORDS = [
  "ux", "user experience", "design director", "design manager", "design lead",
  "product design", "experience design", "service design", "interaction design",
  "ui design", "design system", "design ops", "designops", "creative director",
  "head of design", "vp design", "principal design", "cx design",
];

const EXCLUDE_LEVEL_KEYWORDS = [
  "associate", "junior", "jr.", "intern", "entry level", "entry-level",
];

function isDesignRole(title) {
  const lower = title.toLowerCase();
  return DESIGN_KEYWORDS.some((kw) => lower.includes(kw));
}

function isExcludedLevel(title) {
  const lower = title.toLowerCase();
  return EXCLUDE_LEVEL_KEYWORDS.some((kw) => lower.includes(kw));
}

function isRelevant(title) {
  return isDesignRole(title) && !isExcludedLevel(title);
}

function loadJobs() {
  return JSON.parse(readFileSync(JOBS_PATH, "utf-8"));
}

function saveJobs(data) {
  writeFileSync(JOBS_PATH, JSON.stringify(data, null, 2));
}

function alreadyExists(data, url) {
  const all = [
    ...(data.applied ?? []),
    ...(data.prospect ?? []),
    ...(data.local ?? []),
    ...(data.staffing ?? []),
    ...(data.passed ?? []),
  ];
  return all.some((j) => j.url === url);
}

async function scrapeRobertHalf(browser) {
  const page = await browser.newPage();
  const found = [];

  try {
    console.log("\n--- Robert Half ---");
    await page.goto("https://www.roberthalf.com/us/en/jobs", {
      timeout: 45000, waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(8000);

    // Fill the keyword search box and submit
    const searchInput = page.locator("input[placeholder*='title'], input[name*='keyword'], input[type='search'], input[placeholder*='Job'], input[placeholder*='search']").first();
    const inputCount = await searchInput.count();
    if (inputCount > 0) {
      await searchInput.fill("ux design");
      await page.keyboard.press("Enter");
      console.log("  Submitted search: 'ux design'");
      await page.waitForTimeout(12000);
    } else {
      console.log("  Warning: could not find search input, scraping default page");
    }

    const jobs = await page.$$eval("[class*='job'] a[href*='/us/en/job/'], [class*='card'] a[href*='/us/en/job/']", (els) =>
      [...new Set(els.map((e) => e.href))].slice(0, 40).map((href) => {
        // Extract title from URL slug: /us/en/job/city/title-slug/id
        const parts = href.split("/");
        const titleSlug = parts[parts.length - 2] ?? "";
        const title = titleSlug.replace(/-/g, " ");
        return { title, href };
      })
    );

    const relevant = jobs.filter((j) => isRelevant(j.title));
    console.log(`  Found ${jobs.length} job links, ${relevant.length} relevant`);
    relevant.forEach((j) => console.log(`    - ${j.title}`));
    found.push(...relevant.map((j) => ({
      ...j,
      company: "Robert Half",
      notes: "Robert Half — contract/CTH UX/design placement",
    })));
  } catch (e) {
    console.log(`  ERROR: ${e.message.slice(0, 120)}`);
  } finally {
    await page.close();
  }

  return found;
}

async function scrapeKforce(browser) {
  const page = await browser.newPage();
  const found = [];

  try {
    console.log("\n--- Kforce ---");
    await page.goto("https://www.kforce.com/find-work/search-jobs/?searchTerm=ux+design", {
      timeout: 60000, waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(15000);

    const jobs = await page.$$eval("h2 a", (els) =>
      els.slice(0, 60).map((e) => ({
        title: e.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) ?? "",
        href: e instanceof HTMLAnchorElement ? e.href : "",
      }))
    );

    const relevant = jobs.filter((j) => j.href && isRelevant(j.title));
    console.log(`  h2 a: ${jobs.length} links, ${relevant.length} relevant`);
    relevant.forEach((j) => console.log(`    - ${j.title}`));
    found.push(...relevant.map((j) => ({
      ...j,
      company: "Kforce",
      notes: "Kforce — technology staffing, contract/CTH UX/design roles",
    })));
  } catch (e) {
    console.log(`  ERROR: ${e.message.slice(0, 120)}`);
  } finally {
    await page.close();
  }

  return found;
}

async function scrapeInsightGlobal(browser) {
  const page = await browser.newPage();
  const found = [];

  try {
    console.log("\n--- Insight Global ---");
    await page.goto("https://insightglobal.com/jobs/?q=ux+design", {
      timeout: 60000, waitUntil: "networkidle",
    });
    await page.waitForTimeout(10000);

    const selectors = [
      "a[href*='/job/']", ".job-card a", ".job-title a",
      "[data-testid*='job'] a", "[class*='JobTitle'] a", "h2 a", "h3 a",
    ];

    for (const sel of selectors) {
      const count = await page.locator(sel).count();
      if (count === 0) continue;
      const jobs = await page.$$eval(sel, (els) =>
        els.slice(0, 40).map((e) => ({
          title: e.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) ?? "",
          href: e instanceof HTMLAnchorElement ? e.href : "",
        }))
      );
      const relevant = jobs.filter((j) => j.href && isRelevant(j.title));
      if (relevant.length > 0) {
        console.log(`  "${sel}": ${count} links, ${relevant.length} relevant`);
        relevant.forEach((j) => console.log(`    - ${j.title}`));
        found.push(...relevant.map((j) => ({
          ...j,
          company: "Insight Global",
          notes: "Insight Global — IT staffing, contract/CTH UX/design roles",
        })));
        break;
      }
    }

    if (found.length === 0) {
      const pageTitle = await page.title();
      console.log(`  No relevant roles found (page: "${pageTitle.slice(0, 60)}")`);
    }
  } catch (e) {
    console.log(`  ERROR: ${e.message.slice(0, 120)}`);
  } finally {
    await page.close();
  }

  return found;
}

const browser = await chromium.launch({ headless: true });
const data = loadJobs();
if (!data.staffing) data.staffing = [];

const allJobs = [
  ...(await scrapeRobertHalf(browser)),
  ...(await scrapeKforce(browser)),
  ...(await scrapeInsightGlobal(browser)),
];

await browser.close();

let totalAdded = 0;
for (const job of allJobs) {
  if (!job.href || alreadyExists(data, job.href)) {
    console.log(`  [skip] Already tracked: ${job.title}`);
    continue;
  }
  data.staffing.push({
    company: job.company,
    role: job.title,
    fit: "good",
    salary: "",
    notes: job.notes,
    url: job.href,
  });
  totalAdded++;
  console.log(`  [added] ${job.company}: ${job.title}`);
}

if (totalAdded > 0) {
  saveJobs(data);
  console.log(`\nSaved ${totalAdded} new staffing role(s) to jobs.json`);
} else {
  console.log("\nNo new staffing roles to add.");
}
