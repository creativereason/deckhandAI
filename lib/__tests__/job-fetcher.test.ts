import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJobDetails } from "@/lib/job-fetcher";

function response(html: string, init?: ResponseInit) {
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("fetchJobDetails", () => {
  // Z — Zero: empty fetched content must be explicit, not silently usable.
  it("returns retrieval_limited when fetch returns an empty page and browser fallback is disabled", async () => {
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "false");
    const fetchImpl = vi.fn().mockResolvedValue(response(""));

    const result = await fetchJobDetails({ url: "https://jobs.example.com/empty", fetchImpl });

    expect(result).toEqual({
      ok: false,
      url: "https://jobs.example.com/empty",
      text: "",
      retrieval_method: "fetch_only",
      retrieval_limited: true,
      warning: "Content could not be retrieved automatically. Copy the job description text and paste it directly.",
    });
  });

  // O — One: plain HTML job pages should become readable text.
  it("returns readable text when fetch returns a populated HTML page", async () => {
    const html = `
      <html>
        <head><style>.hidden { display: none; }</style></head>
        <body>
          <script>window.__DATA__ = {}</script>
          <h1>Senior Product Designer</h1>
          <p>Lead discovery, prototyping, and product strategy for enterprise teams.</p>
        </body>
      </html>
    `;
    const fetchImpl = vi.fn().mockResolvedValue(response(html));

    const result = await fetchJobDetails({ url: "https://jobs.example.com/designer", fetchImpl });

    expect(result).toMatchObject({
      ok: true,
      url: "https://jobs.example.com/designer",
      retrieval_method: "fetch_only",
      retrieval_limited: false,
    });
    expect(result.text).toContain("Senior Product Designer");
    expect(result.text).toContain("Lead discovery, prototyping, and product strategy");
    expect(result.text).not.toContain("window.__DATA__");
  });

  // E — Exception: blocked fetches should become a user-actionable retrieval limit.
  it("returns retrieval_limited when fetch throws", async () => {
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "false");
    const fetchImpl = vi.fn().mockRejectedValue(new Error("blocked"));

    const result = await fetchJobDetails({ url: "https://jobs.example.com/blocked", fetchImpl });

    expect(result).toMatchObject({
      ok: false,
      url: "https://jobs.example.com/blocked",
      retrieval_method: "fetch_only",
      retrieval_limited: true,
    });
  });

  // M — Many: blocked primary URLs can recover through a fetchable cross-post.
  it("returns readable text from a Brave Search alternate when the original page is empty", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "brave-key");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(""))
      .mockResolvedValueOnce(Response.json({
        web: {
          results: [
            { title: "Senior Product Designer - Acme", url: "https://jobs.lever.co/acme/123" },
          ],
        },
      }))
      .mockResolvedValueOnce(response("<main><h1>Senior Product Designer</h1><p>Own design strategy for Acme teams, lead discovery, partner with product and engineering, and shape enterprise workflows.</p></main>"));

    const result = await fetchJobDetails({
      url: "https://acme.myworkdayjobs.com/job/123",
      company: "Acme",
      role: "Senior Product Designer",
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: true,
      url: "https://acme.myworkdayjobs.com/job/123",
      source_url: "https://jobs.lever.co/acme/123",
      retrieval_method: "brave_search",
      retrieval_limited: false,
    });
    expect(result.text).toContain("Own design strategy for Acme teams");
  });

  // B — Boundary: Chromium is only attempted when explicitly enabled.
  it("returns readable text from Playwright when search fails and browser fallback is enabled", async () => {
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "true");
    const close = vi.fn();
    const page = {
      goto: vi.fn(),
      waitForTimeout: vi.fn(),
      locator: vi.fn().mockReturnValue({
        innerText: vi.fn().mockResolvedValue(
          "Lead UX strategy for complex SaaS workflows, facilitate discovery with cross-functional teams, and translate customer insights into product direction."
        ),
      }),
    };
    const browser = { newPage: vi.fn().mockResolvedValue(page), close };
    const loadPlaywrightImpl = vi.fn().mockResolvedValue({ chromium: { launch: vi.fn().mockResolvedValue(browser) } });
    const fetchImpl = vi.fn().mockResolvedValue(response(""));

    const result = await fetchJobDetails({
      url: "https://acme.myworkdayjobs.com/job/123",
      fetchImpl,
      loadPlaywrightImpl,
    });

    expect(result).toMatchObject({
      ok: true,
      retrieval_method: "playwright",
      retrieval_limited: false,
      text: "Lead UX strategy for complex SaaS workflows, facilitate discovery with cross-functional teams, and translate customer insights into product direction.",
    });
    expect(page.goto).toHaveBeenCalledWith("https://acme.myworkdayjobs.com/job/123", expect.any(Object));
    expect(close).toHaveBeenCalled();
  });

  it("skips scraper documentation search results before trying Playwright", async () => {
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "brave-key");
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "true");
    const close = vi.fn();
    const page = {
      goto: vi.fn(),
      waitForTimeout: vi.fn(),
      locator: vi.fn().mockReturnValue({
        innerText: vi.fn().mockResolvedValue(
          "LifeMD Senior Product Designer role focused on patient experience, funnel optimization, and design systems."
        ),
      }),
    };
    const browser = { newPage: vi.fn().mockResolvedValue(page), close };
    const loadPlaywrightImpl = vi.fn().mockResolvedValue({ chromium: { launch: vi.fn().mockResolvedValue(browser) } });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(""))
      .mockResolvedValueOnce(Response.json({
        web: {
          results: [
            { title: "Greenhouse Lever Ashby Job Scraper", url: "https://apify.com/bovi/greenhouse-lever-ashby-job-scraper" },
          ],
        },
      }));

    const result = await fetchJobDetails({
      url: "https://lifemd.workable.com/jobs/123",
      company: "LifeMD",
      role: "Senior Product Designer",
      fetchImpl,
      loadPlaywrightImpl,
    });

    expect(result.retrieval_method).toBe("playwright");
    expect(result.text).toContain("LifeMD Senior Product Designer");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
