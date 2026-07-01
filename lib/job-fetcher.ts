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
const FETCHABLE_JOB_HOSTS = [
  "ashbyhq.com",
  "greenhouse.io",
  "jobs.lever.co",
  "lever.co",
  "workable.com",
  "myworkdayjobs.com",
  "workdayjobs.com",
  "smartrecruiters.com",
  "jobvite.com",
  "bamboohr.com",
  "icims.com",
  "successfactors.com",
];
const NON_JOB_HOSTS = ["apify.com", "github.com", "npmjs.com", "docs.", "developer."];
const MIN_JOB_TEXT_LENGTH = 400;
const MAX_JOB_TEXT_LENGTH = 12000;
const RETRIEVAL_LIMITED_WARNING =
  "Content could not be retrieved automatically. Copy the job description text and paste it directly.";
const BROWSER_FALLBACK_NOT_READY_WARNING =
  "Browser-based retrieval is enabled but not available in this fetch-only slice. Copy the job description text and paste it directly.";

function isPlaywrightFallbackEnabled(): boolean {
  return process.env.ENABLE_PLAYWRIGHT_FALLBACK === "true";
}

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
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    if (!hasEnoughText(mdText)) return null;
    return successfulResult({ url, sourceUrl: mdUrl, text: mdText, method: "fetch_only" });
  } catch {
    return null;
  }
}

const NAV_BOILERPLATE_RE =
  /log in|sign in|get in touch|get started|we'?re hiring|copyright|\u00a9 20\d\d|privacy policy|terms of (?:use|service)/gi;

function hasEnoughText(text: string): boolean {
  if (text.length < MIN_JOB_TEXT_LENGTH) return false;
  const navHits = (text.match(NAV_BOILERPLATE_RE) ?? []).length;
  const wordCount = text.split(/\s+/).length;
  // Reject dense nav pages: if nav signals are high relative to word count it's
  // a header/footer page, not a job description.
  if (navHits >= 2 && wordCount < 120) return false;
  return true;
}

function companyFromUrl(url: string): string {
  try {
    return new URL(url).hostname.split(".")[0].replace(/[-_]+/g, " ");
  } catch {
    return "";
  }
}

function buildSearchQuery(options: FetchJobDetailsOptions): string {
  const company = options.company ?? companyFromUrl(options.url);
  const role = options.role ?? "";
  // "site:..." terms focus Brave on job board domains rather than marketing/comparison pages
  return `${company} ${role} job (site:jobs.lever.co OR site:jobs.ashbyhq.com OR site:greenhouse.io OR site:jobs.smartrecruiters.com)`.replace(/\s+/g, " ").trim();
}

async function searchBraveAlternates({
  options,
  fetchImpl,
  timeoutMs,
}: {
  options: FetchJobDetailsOptions;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}): Promise<string[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) return [];
  const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(buildSearchQuery(options))}&count=8`;
  const response = await fetchImpl(endpoint, {
    headers: { Accept: "application/json", "X-Subscription-Token": token },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return [];
  const data = await response.json() as { web?: { results?: BraveResult[] } };
  return (data.web?.results ?? [])
    .filter(isLikelyJobSearchResult)
    .map((result) => result.url)
    .filter((url): url is string => !!url);
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

async function fetchFromBraveAlternate({
  options,
  fetchImpl,
  timeoutMs,
  remainingMs,
}: FetchPageTextOptions & {
  options: FetchJobDetailsOptions;
  remainingMs: () => number;
}): Promise<JobFetchResult | null> {
  const alternates = await searchBraveAlternates({
    options,
    fetchImpl,
    timeoutMs: Math.max(0, Math.min(timeoutMs, remainingMs())),
  }).catch(() => []);
  for (const alternateUrl of alternates) {
    if (alternateUrl === options.url) continue;
    if (remainingMs() <= 0) break;
    const legTimeout = Math.max(0, Math.min(timeoutMs, remainingMs()));
    const text = await fetchPageText({ url: alternateUrl, fetchImpl, timeoutMs: legTimeout }).catch(() => "");
    if (hasEnoughText(text)) {
      return successfulResult({ url: options.url, sourceUrl: alternateUrl, text, method: "brave_search" });
    }
  }
  return null;
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
  if (hasEnoughText(text)) return successfulResult({ url, text, method: "fetch_only" });
  if (remainingMs() <= 0) return limitedResult(url);

  // Many SPAs advertise a machine-readable alternate in <head> (Workable .md, etc.)
  const mdResult = await fetchMarkdownAlternate({ html: raw, url, fetchImpl, timeoutMs: legTimeoutMs() });
  if (mdResult) return mdResult;
  if (remainingMs() <= 0) return limitedResult(url);

  const options = { url, company, role };
  const braveResult = await fetchFromBraveAlternate({ options, url, fetchImpl, timeoutMs: legTimeoutMs(), remainingMs });
  if (braveResult) return braveResult;
  if (remainingMs() <= 0) return limitedResult(url);

  if (!isPlaywrightFallbackEnabled()) return limitedResult(url);
  const browserText = await fetchWithPlaywright({ url, loadPlaywrightImpl }).catch(() => "");
  if (hasEnoughText(browserText)) return successfulResult({ url, text: browserText, method: "playwright" });

  return limitedResult(url);
}
