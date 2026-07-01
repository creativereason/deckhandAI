import { readJobs, writeJobs, PendingJob } from "@/lib/jobs";
import { scoreNewPendingJobs } from "@/lib/score";
import {
  buildLocalRegex,
  DEFAULT_SELECTORS,
  isLocalListing,
  isQualifyingAssumeLocal,
  isQualifyingRemoteOrLocal,
} from "@/lib/scrape-filters";
import type { ScrapeTargetConfig } from "@/lib/scrape-targets";

export type ScrapeLogEntry = {
  company: string;
  status: "ok" | "error";
  listings: number;
  qualifying: number;
  added: number;
  error?: string;
  selector?: string;
};

export type ScrapeTarget = {
  company: string;
  url: string;
  selector?: string;
  linkBase?: string;
};

type Listing = { title: string; href: string; location: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPlaywright(): Promise<any> {
  try {
    return await import("playwright");
  } catch {
    return null;
  }
}

function cleanTitle(title: string, prefix?: string): string {
  let t = title.replace(/\s+/g, " ").trim();
  if (prefix && t.startsWith(prefix)) t = t.slice(prefix.length).trim();
  return t;
}

export async function extractListings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  preferredSelector?: string,
  titlePrefix?: string,
  titleFromUrlParam?: string
): Promise<{ listings: Listing[]; selector: string }> {
  const selectors = preferredSelector
    ? [preferredSelector, ...DEFAULT_SELECTORS.filter((s) => s !== preferredSelector)]
    : DEFAULT_SELECTORS;

  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      if (count === 0) continue;

      const listings: Listing[] = await page.$$eval(
        selector,
        (els: Element[], param: string | undefined) =>
          els.map((el) => {
            const href =
              (el instanceof HTMLAnchorElement ? el.href : el.querySelector("a")?.getAttribute("href")) ?? "";
            let title = el.textContent?.trim() ?? "";
            if (param && href) {
              try {
                const p = new URL(href).searchParams.get(param);
                if (p) title = p.replace(/\+/g, " ");
              } catch { /* keep text title */ }
            }
            return {
              title,
              href,
              location:
                el.closest("[class*='job'], [class*='listing'], [class*='result'], li, article, tr")
                  ?.textContent ?? "",
            };
          }),
        titleFromUrlParam
      );

      const seen = new Set<string>();
      const withTitles = listings
        .map((l) => ({ ...l, title: cleanTitle(l.title, titlePrefix) }))
        .filter((l) => {
          if (l.title.length <= 2 || seen.has(l.href)) return false;
          seen.add(l.href);
          return true;
        });
      if (withTitles.length > 0) {
        return { listings: withTitles, selector };
      }
    } catch {
      continue;
    }
  }

  return { listings: [], selector: preferredSelector ?? DEFAULT_SELECTORS[0] };
}

async function getListingPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  target: ScrapeTargetConfig
) {
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
    } catch { /* banner may not appear */ }
  }

  if (target.useIframe) {
    const frame = page.frames().find((f: { url: () => string }) => f.url().includes("in_iframe"));
    return frame ?? page;
  }
  return page;
}

export type RunScrapeOptions = {
  targets: ScrapeTargetConfig[];
  localOnly?: boolean;
  localRegex?: RegExp;
  onProgress?: (entry: ScrapeLogEntry) => void;
};

export async function runScrape(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  playwright: any,
  options: RunScrapeOptions
): Promise<{ added: PendingJob[]; log: ScrapeLogEntry[] }> {
  const { targets, localOnly = false, localRegex = buildLocalRegex(), onProgress } = options;
  const browser = await playwright.chromium.launch({ headless: true });
  const added: PendingJob[] = [];
  const log: ScrapeLogEntry[] = [];
  const jobs = await readJobs();
  if (!jobs.pending) jobs.pending = [];
  const existingKeys = new Set([
    ...jobs.prospect.map((j) => `${j.company}|${j.role}`),
    ...jobs.local.map((j) => `${j.company}|${j.role}`),
    ...jobs.applied.map((j) => `${j.company}|${j.role}`),
    ...jobs.passed.map((j) => `${j.company}|${j.role}`),
    ...jobs.pending.map((j) => `${j.company}|${j.role}`),
  ]);

  try {
    for (const target of targets) {
      const page = await browser.newPage();
      let qualifying = 0;
      let addedForTarget = 0;

      try {
        const listingPage = await getListingPage(page, target);

        const allListings: Listing[] = [];
        let usedSelector = target.selector ?? DEFAULT_SELECTORS[0];

        if (target.paginateByRole) {
          let pageNum = 1;
          while (true) {
            const { listings: pageListings, selector } = await extractListings(
              listingPage,
              target.selector,
              target.titlePrefix,
              target.titleFromUrlParam
            );
            usedSelector = selector;
            allListings.push(...pageListings);

            const nextBtn = listingPage.getByRole("button", { name: `Page ${pageNum + 1}` });
            if (await nextBtn.count() === 0) break;
            await nextBtn.evaluate((el: HTMLElement) => el.click());
            await listingPage.waitForTimeout(4000);
            pageNum++;
          }
        } else {
          const { listings: pageListings, selector } = await extractListings(
            listingPage,
            target.selector,
            target.titlePrefix,
            target.titleFromUrlParam
          );
          usedSelector = selector;
          allListings.push(...pageListings);
        }

        const listings = allListings;

        const qualifies = (title: string, location: string, href: string) => {
          if (target.assumeLocal || localOnly) {
            return isQualifyingAssumeLocal(
              title,
              location,
              localRegex,
              href,
              target.trustLocationFilter
            );
          }
          return isQualifyingRemoteOrLocal(title, location, localRegex);
        };

        for (const item of listings) {
          const href = item.href
            ? item.href.startsWith("http")
              ? item.href
              : `${target.linkBase ?? ""}${item.href}`
            : target.url;

          if (!qualifies(item.title, item.location, href)) continue;
          qualifying++;
          const key = `${target.company}|${item.title}`;
          if (existingKeys.has(key)) continue;

          const isLocal =
            target.assumeLocal ||
            localOnly ||
            isLocalListing(item.title, `${item.location} ${href}`, localRegex);

          const job: PendingJob = {
            company: target.company,
            role: item.title,
            url: href,
            salary: "",
            notes: "",
            scrapeGroup: isLocal ? "local" : "remote",
            scrapeDate: new Date().toISOString().split("T")[0],
          };

          jobs.pending.unshift(job);
          existingKeys.add(key);
          added.push(job);
          addedForTarget++;
        }

        const entry: ScrapeLogEntry = {
          company: target.company,
          status: "ok",
          listings: listings.length,
          qualifying,
          added: addedForTarget,
          selector: usedSelector,
        };
        log.push(entry);
        onProgress?.(entry);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Scrape failed for ${target.company}:`, err);
        const entry: ScrapeLogEntry = {
          company: target.company,
          status: "error",
          listings: 0,
          qualifying: 0,
          added: 0,
          error: message,
        };
        log.push(entry);
        onProgress?.(entry);
      } finally {
        await page.close();
      }
    }

    if (added.length > 0) {
      await scoreNewPendingJobs(added);
      await writeJobs(jobs);
    }
  } finally {
    await browser.close();
  }

  return { added, log };
}
