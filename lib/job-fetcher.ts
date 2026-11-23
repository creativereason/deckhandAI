import { isPlaywrightFallbackEnabled } from "@/lib/env";

export type JobRetrievalMethod = "fetch_only" | "brave_search" | "playwright";

export interface JobFetchResult {
  ok: boolean;
  url: string;
  source_url?: string;
  text: string;
  retrieval_method: JobRetrievalMethod;
  retrieval_limited: boolean;
  warning?: string;
}

interface FetchJobDetailsOptions {
  url: string;
  company?: string;
  role?: string;
  fetchImpl?: typeof fetch;
  loadPlaywrightImpl?: () => Promise<PlaywrightModule | null>;
  timeoutMs?: number;
  nowMs?: () => number;
  budgetMs?: number;
}

type BraveResult = { title?: string; url?: string; description?: string };
type PlaywrightModule = {
  chromium: {
    launch(options: { headless: boolean }): Promise<BrowserLike>;
  };
};
type BrowserLike = {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
};
type PageLike = {
  goto(url: string, options: { timeout: number; waitUntil: "domcontentloaded" }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<unknown>;
  locator(selector: string): { innerText(options?: { timeout?: number }): Promise<string> };
};
type FetchPageTextOptions = {
  url: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
};

const USER_AGENT = "Mozilla/5.0 (compatible; deckhandAI/1.0)";
// Leaves headroom under the route's `maxDuration = 60` so a killed function doesn't discard completed work.
const DEFAULT_BUDGET_MS = 45000;
// Third-party ATS/job-board hosts: used both to filter Brave alternates to
// fetchable job boards and to exclude hosts with no meaningful employer homepage.
const FETCHABLE_JOB_HOSTS = [
  "ashbyhq.com",
  "greenhouse.io",
  "jobs.lever.co",
  "lever.co",
  "workable.com",
  "myworkdayjobs.com",
  "workdayjobs.com",
  "workday.com",
  "smartrecruiters.com",
  "jobvite.com",
  "bamboohr.com",
  "icims.com",
  "successfactors.com",
  "taleo.net",
  "brassring.com",
  "recruitee.com",
  "rippling.com",
  "applytojob.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
];
const NON_JOB_HOSTS = ["apify.com", "github.com", "npmjs.com", "docs.", "developer."];
const MIN_JOB_TEXT_LENGTH = 400;
const MAX_JOB_TEXT_LENGTH = 12000;
const RETRIEVAL_LIMITED_WARNING =
  "Content could not be retrieved automatically. Copy the job description text and paste it directly.";
const BROWSER_FALLBACK_NOT_READY_WARNING =
  "Browser-based retrieval is enabled but not available in this fetch-only slice. Copy the job description text and paste it directly.";

async function loadPlaywright(): Promise<PlaywrightModule | null> {
  try {
    return (await import("playwright")) as PlaywrightModule;
  } catch {
    return null;
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function extractMetaDescription(html: string): string {
  // Many SPAs (Ashby, some Lever pages) put the full JD in the meta description
  // because the body is a JS-rendered shell. [^"] matches newlines in JS regex.
  const m =
    html.match(/<meta\s+name=["']description["'][^>]*content="([^"]*)"/i) ??
    html.match(/<meta\s+name=["']description["'][^>]*content='([^']*)'/i) ??
    html.match(/<meta\s+content="([^"]*)"\s[^>]*name=["']description["']/i) ??
    html.match(/<meta\s+content='([^']*)'\s[^>]*name=["']description["']/i);
  return m ? decodeEntities(m[1].trim()) : "";
}

function stripHtml(html: string): string {
  const metaDesc = extractMetaDescription(html);
  const bodyText = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
  // Prepend meta description so SPAs with empty bodies still yield job content
  return metaDesc ? `${metaDesc}\n\n${bodyText}` : bodyText;
}

function limitedResult(url: string): JobFetchResult {
  return {
    ok: false,
    url,
    text: "",
    retrieval_method: "fetch_only",
    retrieval_limited: true,
    warning: isPlaywrightFallbackEnabled()
      ? BROWSER_FALLBACK_NOT_READY_WARNING
      : RETRIEVAL_LIMITED_WARNING,
  };
}

function successfulResult(
  options: {
    url: string;
    text: string;
    method: JobRetrievalMethod;
    sourceUrl?: string;
  }
): JobFetchResult {
  return {
    ok: true,
    url: options.url,
    ...(options.sourceUrl ? { source_url: options.sourceUrl } : {}),
    text: options.text,
    retrieval_method: options.method,
    retrieval_limited: false,
  };
}

async function fetchRaw({
  url,
  fetchImpl,
  timeoutMs,
}: FetchPageTextOptions): Promise<{ text: string; raw: string }> {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return { text: "", raw: "" };
  const raw = await response.text();
  return { text: stripHtml(raw).slice(0, MAX_JOB_TEXT_LENGTH), raw };
}

async function fetchPageText(options: FetchPageTextOptions): Promise<string> {
  return (await fetchRaw(options)).text;
}

function extractMarkdownAlternate(html: string): string | null {
  const m =
    html.match(/<link[^>]+type=["']text\/markdown["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']text\/markdown["']/i);
  return m?.[1] ?? null;
}

async function fetchMarkdownAlternate({
  html,
  url,
  fetchImpl,
  timeoutMs,
}: FetchPageTextOptions & { html: string }): Promise<JobFetchResult | null> {
  const mdUrl = extractMarkdownAlternate(html);
  if (!mdUrl) return null;
  try {
    const response = await fetchImpl(mdUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const mdText = (await response.text()).slice(0, MAX_JOB_TEXT_LENGTH);
    if (!hasRoleDetail(mdText)) return null;
    return successfulResult({ url, sourceUrl: mdUrl, text: mdText, method: "fetch_only" });
  } catch {
    return null;
  }
}

const NAV_BOILERPLATE_RE =
  /log in|sign in|get in touch|get started|we'?re hiring|copyright|\u00a9 20\d\d|privacy policy|terms of (?:use|service)/gi;

// Common phrasing in real job postings. A page this long should contain at least one of these.
const JD_SIGNAL_RE =
  /\bresponsibilities\b|\bqualifications\b|\brequirements\b|about (?:the|this) role\b|about (?:the|this) position\b|what you.?ll (?:do|bring)|who you are\b|you will\b|you.?ll\b|we.?re looking for\b|looking for a\b|minimum qualifications\b|preferred qualifications\b|years? of experience\b|equal opportunity employer\b|apply (?:for this|now)\b/i;
// Above this word count, a long page with none of the JD_SIGNAL_RE phrasing is more likely
// a SPA app-shell / site-wide nav (mega-menu) that slipped past the nav-keyword check below
// simply by being long, than an actual job description.
const LONG_TEXT_WITHOUT_SIGNAL_THRESHOLD = 200;

function hasEnoughText(text: string): boolean {
  if (text.length < MIN_JOB_TEXT_LENGTH) return false;
  const navHits = (text.match(NAV_BOILERPLATE_RE) ?? []).length;
  const wordCount = text.split(/\s+/).length;
  // Reject dense nav pages: if nav signals are high relative to word count it's
  // a header/footer page, not a job description.
  if (navHits >= 2 && wordCount < 120) return false;
  if (wordCount > LONG_TEXT_WITHOUT_SIGNAL_THRESHOLD && !JD_SIGNAL_RE.test(text)) return false;
  return true;
}

const MIN_WORDS_WITHOUT_SIGNAL = 150;

// A page can be long enough and not be navigation, yet still be only a title,
// location and apply button. Role detail means real JD phrasing or a lot of prose.
function hasRoleDetail(text: string): boolean {
  if (!hasEnoughText(text)) return false;
  return JD_SIGNAL_RE.test(text) || text.split(/\s+/).length >= MIN_WORDS_WITHOUT_SIGNAL;
}

const GENERIC_SUBDOMAINS = new Set(["www", "careers", "career", "jobs", "job", "apply", "hire", "boards", "job-boards", "secure", "talent", "recruiting", "work"]);
const SHARED_ATS_HOSTS = ["lever.co", "greenhouse.io", "ashbyhq.com", "smartrecruiters.com", "jobvite.com", "workable.com", "recruitee.com", "bamboohr.com"];
const GENERIC_PATH_SEGMENTS = new Set(["jobs", "job", "careers", "career", "en-us", "en", "external", "positions", "position", "opening", "openings", "view", "details"]);

function roleFromSlug(segment: string): string {
  const words = decodeURIComponent(segment)
    .replace(/\.[a-z]{2,4}$/i, "")
    .split(/[-_+\s]+/)
    .filter((w) => w && !/^[a-z]?\d{3,}$/i.test(w) && !/\d/.test(w));
  return words.length >= 2 ? words.join(" ") : "";
}

// Company and role as far as the URL itself reveals them, so a bare pasted link
// can still be searched for by title and company when the page is blocked.
export function deriveJobHints(url: string): { company: string; role: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { company: "", role: "" };
  }
  const host = parsed.hostname.toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);
  const labels = host.split(".").filter((l) => !GENERIC_SUBDOMAINS.has(l));
  const onSharedAts = SHARED_ATS_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  const company = onSharedAts
    ? (segments.find((s) => !GENERIC_PATH_SEGMENTS.has(s.toLowerCase())) ?? "")
    : (labels[0] ?? "");
  const slug = [...segments].reverse().find((s) => roleFromSlug(s)) ?? "";
  return { company: company.replace(/[-_]+/g, " "), role: slug ? roleFromSlug(slug) : "" };
}

function buildSearchQueries(options: FetchJobDetailsOptions): string[] {
  const hints = deriveJobHints(options.url);
  const company = options.company || hints.company;
  const role = options.role || hints.role;
  const base = `${company} ${role}`.replace(/\s+/g, " ").trim();
  return [
    // "site:..." terms focus Brave on job board domains rather than marketing/comparison pages
    `${base} job (site:jobs.lever.co OR site:jobs.ashbyhq.com OR site:greenhouse.io OR site:jobs.smartrecruiters.com)`,
    // Open search catches the employer's own careers site, Workday and other boards
    `"${company}" ${role} job description responsibilities qualifications`,
  ].map((query) => query.replace(/\s+/g, " ").trim());
}

async function searchBrave({
  query,
  fetchImpl,
  timeoutMs,
}: {
  query: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<BraveResult[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) return [];
  const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`;
  const response = await fetchImpl(endpoint, {
    headers: { Accept: "application/json", "X-Subscription-Token": token },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return [];
  const data = await response.json() as { web?: { results?: BraveResult[] } };
  return data.web?.results ?? [];
}

function isOpenJobResult(result: BraveResult, options: FetchJobDetailsOptions): boolean {
  if (!result.url) return false;
  let hostname = "";
  try {
    hostname = new URL(result.url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (NON_JOB_HOSTS.some((host) => hostname.includes(host))) return false;
  const company = (options.company || deriveJobHints(options.url).company).toLowerCase();
  const haystack = `${result.title ?? ""} ${result.url}`.toLowerCase();
  return !company || haystack.includes(company.replace(/\s+/g, "")) || haystack.includes(company);
}

function isLikelyJobSearchResult(result: BraveResult): boolean {
  if (!result.url) return false;
  let hostname = "";
  try {
    hostname = new URL(result.url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const haystack = `${result.title ?? ""} ${result.description ?? ""} ${result.url}`.toLowerCase();
  if (NON_JOB_HOSTS.some((host) => hostname.includes(host))) return false;
  if (/\bscraper\b|\bscraping\b|\bapi\b|\bdocs?\b|\bgithub\b/.test(haystack)) return false;
  return FETCHABLE_JOB_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

const MAX_ALTERNATES_PER_QUERY = 4;

async function firstDetailedAlternate({
  urls,
  options,
  fetchImpl,
  timeoutMs,
  remainingMs,
}: Omit<FetchPageTextOptions, "url"> & {
  urls: string[];
  options: FetchJobDetailsOptions;
  remainingMs: () => number;
}): Promise<JobFetchResult | null> {
  for (const alternateUrl of urls.filter((u) => u !== options.url).slice(0, MAX_ALTERNATES_PER_QUERY)) {
    if (remainingMs() <= 0) break;
    const legTimeout = Math.max(0, Math.min(timeoutMs, remainingMs()));
    const text = await fetchPageText({ url: alternateUrl, fetchImpl, timeoutMs: legTimeout }).catch(() => "");
    if (hasRoleDetail(text)) {
      return successfulResult({ url: options.url, sourceUrl: alternateUrl, text, method: "brave_search" });
    }
  }
  return null;
}

async function fetchFromBraveAlternate({
  options,
  fetchImpl,
  timeoutMs,
  remainingMs,
}: Omit<FetchPageTextOptions, "url"> & {
  options: FetchJobDetailsOptions;
  remainingMs: () => number;
}): Promise<JobFetchResult | null> {
  const [atsQuery, openQuery] = buildSearchQueries(options);
  const legTimeout = () => Math.max(0, Math.min(timeoutMs, remainingMs()));
  const attempts: { query: string; keep: (r: BraveResult) => boolean }[] = [
    { query: atsQuery, keep: isLikelyJobSearchResult },
    { query: openQuery, keep: (r) => isOpenJobResult(r, options) },
  ];
  for (const { query, keep } of attempts) {
    if (remainingMs() <= 0) break;
    const results = await searchBrave({ query, fetchImpl, timeoutMs: legTimeout() }).catch(() => []);
    const urls = results.filter(keep).map((r) => r.url as string);
    const found = await firstDetailedAlternate({ urls, options, fetchImpl, timeoutMs, remainingMs });
    if (found) return found;
  }
  return null;
}

function homepageFromJdUrl(jdUrl: string): string | null {
  try {
    const { hostname, protocol } = new URL(jdUrl);
    if (FETCHABLE_JOB_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))) return null;
    const parts = hostname.split(".");
    // Strip subdomains like jobs., careers., apply., etc.
    const root = parts.length > 2 ? parts.slice(-2).join(".") : hostname;
    return `${protocol}//${root}`;
  } catch {
    return null;
  }
}

function homepageFromCompanyName(company: string): string {
  const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `https://www.${slug}.com`;
}

async function fetchFromHomepage({
  options,
  fetchImpl,
  timeoutMs,
}: {
  options: FetchJobDetailsOptions;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<JobFetchResult | null> {
  const homepage = homepageFromJdUrl(options.url) ?? (options.company ? homepageFromCompanyName(options.company) : null);
  if (!homepage) return null;
  const text = await fetchPageText({ url: homepage, fetchImpl, timeoutMs }).catch(() => "");
  if (text.length < 300) return null;
  return {
    ok: true,
    url: options.url,
    source_url: homepage,
    text: `[Job description unavailable — company website context below]\n\n${text.slice(0, 4000)}`,
    retrieval_method: "fetch_only",
    retrieval_limited: true,
    warning: "Job description could not be retrieved. Showing company homepage context instead — verify details manually.",
  };
}

async function fetchWithPlaywright({
  url,
  loadPlaywrightImpl,
}: {
  url: string;
  loadPlaywrightImpl: () => Promise<PlaywrightModule | null>;
}): Promise<string> {
  const playwright = await loadPlaywrightImpl();
  if (!playwright) return "";
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { timeout: 60000, waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    return (await page.locator("body").innerText({ timeout: 10000 })).trim().slice(0, MAX_JOB_TEXT_LENGTH);
  } finally {
    await browser.close();
  }
}

export async function fetchJobDetails({
  url,
  company,
  role,
  fetchImpl = fetch,
  loadPlaywrightImpl = loadPlaywright,
  timeoutMs = 10000,
  nowMs = Date.now,
  budgetMs = DEFAULT_BUDGET_MS,
}: FetchJobDetailsOptions): Promise<JobFetchResult> {
  const deadline = nowMs() + budgetMs;
  const remainingMs = () => deadline - nowMs();
  const legTimeoutMs = () => Math.max(0, Math.min(timeoutMs, remainingMs()));

  const { text, raw } = await fetchRaw({ url, fetchImpl, timeoutMs: legTimeoutMs() }).catch(() => ({ text: "", raw: "" }));
  if (hasRoleDetail(text)) return successfulResult({ url, text, method: "fetch_only" });
  if (remainingMs() <= 0) return limitedResult(url);

  // Many SPAs advertise a machine-readable alternate in <head> (Workable .md, etc.)
  const mdResult = await fetchMarkdownAlternate({ html: raw, url, fetchImpl, timeoutMs: legTimeoutMs() });
  if (mdResult) return mdResult;
  if (remainingMs() <= 0) return limitedResult(url);

  const options = { url, company, role };
  const braveResult = await fetchFromBraveAlternate({ options, fetchImpl, timeoutMs: legTimeoutMs(), remainingMs });
  if (braveResult) return braveResult;
  if (remainingMs() <= 0) return limitedResult(url);

  if (isPlaywrightFallbackEnabled()) {
    const browserText = await fetchWithPlaywright({ url, loadPlaywrightImpl }).catch(() => "");
    if (hasRoleDetail(browserText)) return successfulResult({ url, text: browserText, method: "playwright" });
    if (remainingMs() <= 0) return limitedResult(url);
  }

  const homepageResult = await fetchFromHomepage({ options, fetchImpl, timeoutMs: legTimeoutMs() }).catch(() => null);
  if (homepageResult) return homepageResult;

  return limitedResult(url);
}
