import type { ScrapeTarget } from "@/lib/scrape-run";

export type ScrapeTargetConfig = ScrapeTarget & {
  /** Scrape listings inside iCIMS (or similar) iframe */
  useIframe?: boolean;
  /** All matches go to Local section */
  assumeLocal?: boolean;
  /** Careers URL already filters to your metro — skip per-row location check */
  trustLocationFilter?: boolean;
  /** Strip prefix from titles, e.g. iCIMS "Title …" */
  titlePrefix?: string;
  /** Click a cookie-dismiss button matching this text before scraping */
  dismissCookieText?: string;
  /** Paginate by clicking buttons matching "Page {n}" (Accenture-style) */
  paginateByRole?: boolean;
  /** Extract job title from this URL query param instead of link text */
  titleFromUrlParam?: string;
  /** Override default page wait in ms (default: 3000, iframe: 5000, paginated: 8000) */
  waitMs?: number;
};

/**
 * National / remote-eligible employers to scrape.
 * Replace these with your own target companies.
 *
 * Each entry needs:
 *   company   — display name
 *   url       — career search URL (with keyword filter if possible)
 *   selector  — CSS selector for job listing links
 *   linkBase  — prepended to relative hrefs (leave "" if absolute)
 */
export const REMOTE_TARGETS: ScrapeTargetConfig[] = [
  // Add your remote/national targets here. Example:
  // {
  //   company: "Acme Corp",
  //   url: "https://careers.acme.com/jobs?q=designer&level=senior",
  //   selector: ".job-title a",
  //   linkBase: "https://careers.acme.com",
  // },
];

/**
 * Local / hybrid employers in your metro area.
 * Replace these with employers in your target geography.
 *
 * Set assumeLocal: true when the site doesn't filter by city in the URL
 * but you still want all results to land in the Local bucket.
 * Set trustLocationFilter: true when the URL already filters to your city.
 */
export const LOCAL_TARGETS: ScrapeTargetConfig[] = [
  // Add your local/hybrid targets here. Example:
  // {
  //   company: "Globex Corp",
  //   url: "https://jobs.globex.com/search?q=design&location=Chicago",
  //   selector: "a[href*='/job/']",
  //   linkBase: "https://jobs.globex.com",
  //   assumeLocal: true,
  //   trustLocationFilter: true,
  //   waitMs: 5000,
  // },
];

export type ScrapeGroup = "remote" | "local" | "all";

// Runtime loader — reads from data/scrape-targets.json, falls back to static arrays
export async function loadTargets(): Promise<{ remote: ScrapeTargetConfig[]; local: ScrapeTargetConfig[] }> {
  try {
    const { githubRead } = await import("@/lib/github");
    const raw = await githubRead("data/scrape-targets.json");
    return JSON.parse(raw);
  } catch {
    return { remote: REMOTE_TARGETS, local: LOCAL_TARGETS };
  }
}

export async function getTargetsForGroup(group: ScrapeGroup): Promise<ScrapeTargetConfig[]> {
  const { remote, local } = await loadTargets();
  if (group === "remote") return remote;
  if (group === "local") return local;
  return [...remote, ...local];
}

export async function findTarget(
  group: ScrapeGroup,
  company: string
): Promise<ScrapeTargetConfig | undefined> {
  const targets = await getTargetsForGroup(group);
  return targets.find((t) => t.company.toLowerCase() === company.toLowerCase());
}

export async function getAllCompanyOptions() {
  const { remote, local } = await loadTargets();
  return [
    { group: "remote" as const, label: "Remote / National", companies: ["All", ...remote.map((t) => t.company)] },
    { group: "local" as const, label: "Local / Hybrid", companies: ["All", ...local.map((t) => t.company)] },
  ];
}
