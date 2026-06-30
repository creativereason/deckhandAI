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
const MIN_JOB_TEXT_LENGTH = 80;
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

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

async function fetchPageText({
  url,
  fetchImpl,
  timeoutMs,
}: FetchPageTextOptions): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return "";
  return stripHtml(await response.text()).slice(0, MAX_JOB_TEXT_LENGTH);
}

function hasEnoughText(text: string): boolean {
  return text.length >= MIN_JOB_TEXT_LENGTH;
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
  return `${company} ${role} job greenhouse lever ashby`.replace(/\s+/g, " ").trim();
}

async function searchBraveAlternates({
  options,
  fetchImpl,
}: {
  options: FetchJobDetailsOptions;
  fetchImpl: typeof fetch;
}): Promise<string[]> {
  const token = process.env.BRAVE_SEARCH_API_KEY;
  if (!token) return [];
  const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(buildSearchQuery(options))}&count=8`;
  const response = await fetchImpl(endpoint, {
    headers: { Accept: "application/json", "X-Subscription-Token": token },
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
}: FetchPageTextOptions & {
  options: FetchJobDetailsOptions;
}): Promise<JobFetchResult | null> {
  const alternates = await searchBraveAlternates({ options, fetchImpl }).catch(() => []);
  for (const alternateUrl of alternates) {
    if (alternateUrl === options.url) continue;
    const text = await fetchPageText({ url: alternateUrl, fetchImpl, timeoutMs }).catch(() => "");
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
}: FetchJobDetailsOptions): Promise<JobFetchResult> {
  const text = await fetchPageText({ url, fetchImpl, timeoutMs }).catch(() => "");
  if (hasEnoughText(text)) return successfulResult({ url, text, method: "fetch_only" });

  const options = { url, company, role };
  const braveResult = await fetchFromBraveAlternate({ options, url, fetchImpl, timeoutMs });
  if (braveResult) return braveResult;

  if (!isPlaywrightFallbackEnabled()) return limitedResult(url);
  const browserText = await fetchWithPlaywright({ url, loadPlaywrightImpl }).catch(() => "");
  if (hasEnoughText(browserText)) return successfulResult({ url, text: browserText, method: "playwright" });

  return limitedResult(url);
}
