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
          <p>Lead discovery, prototyping, and product strategy for enterprise SaaS teams.
          You will collaborate with product managers, engineers, and stakeholders to define
          user needs, create design specifications, and oversee delivery of high-quality
          experiences. The role requires 7+ years of product design experience with a strong
          portfolio demonstrating systems thinking and cross-functional leadership. Familiarity
          with Figma, user research methods, and agile workflows is essential. Compensation
          range is $160k–$190k depending on experience. This is a fully remote position open
          to candidates in the US.</p>
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

  // B — Boundary: SPAs that embed JD in meta description (Ashby) should be read directly.
  it("returns readable text from meta description when body is an SPA shell", async () => {
    const ashbyShell = `<!DOCTYPE html><html><head>
      <title>Senior Product Designer @ Owner.com</title>
      <meta name="description" content="About Owner&#10;&#10;Owner is the AI-native system local business owners use to succeed, starting with restaurants. We&#39;re building the system that replaces the many tools owners use to run their business. It powers everything from the restaurant&#39;s website, online ordering, CRM, POS, and more.&#10;&#10;About the Role&#10;&#10;We are looking for a Senior Product Designer to join our growing design team. You will own design for core product areas, lead discovery, and ship user-tested solutions. 7+ years of product design experience required. Compensation: $190k&#8211;$270k. Fully remote." />
    </head><body><div id="root"></div></body></html>`;
    const fetchImpl = vi.fn().mockResolvedValue(response(ashbyShell));

    const result = await fetchJobDetails({
      url: "https://jobs.ashbyhq.com/owner/0ab7a1e4-0164-499e-9b2f-b10d8b2fae41",
      company: "Owner",
      role: "Senior Product Designer",
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: true,
      retrieval_method: "fetch_only",
      retrieval_limited: false,
    });
    expect(result.text).toContain("Owner is the AI-native system");
    expect(result.text).toContain("Senior Product Designer");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  // B — Boundary: SPA shells that advertise a markdown alternate should use it.
  it("returns readable text from a markdown alternate link when the main page is an SPA shell", async () => {
    const spaShell = `<!doctype html><html><head>
      <title>Director of UX - LifeMD</title>
      <link rel="alternate" type="text/markdown" title="Markdown version" href="https://apply.workable.com/lifemdcareers/jobs/view/52BB9B1B01.md"/>
    </head><body><div id="app"><div class="loader"></div></div></body></html>`;
    const mdContent = `# Director of UX\n\n> LifeMD · New York (Hybrid)\n\n**Salary:** USD 180,000–210,000\n\n## Description\n\n**About LifeMD**\n\nLifeMD is a leading provider of virtual primary care, telehealth, and specialized treatment programs serving hundreds of thousands of patients nationwide. Our platform combines 50-state licensed providers, in-house pharmacy, and proprietary technology.\n\n**About the Role**\n\nLifeMD is seeking a Director of UX to lead experience design across patient journeys, physician workflows, and digital care experiences.\n\n## Requirements\n\n- 10+ years UX experience\n- Healthcare or regulated environment experience preferred\n- Strong portfolio demonstrating systems thinking`;
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(spaShell))
      .mockResolvedValueOnce(response(mdContent, { headers: { "Content-Type": "text/markdown" } }));

    const result = await fetchJobDetails({
      url: "https://apply.workable.com/lifemdcareers/j/52BB9B1B01/",
      company: "LifeMD",
      role: "Director of UX",
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: true,
      url: "https://apply.workable.com/lifemdcareers/j/52BB9B1B01/",
      source_url: "https://apply.workable.com/lifemdcareers/jobs/view/52BB9B1B01.md",
      retrieval_method: "fetch_only",
      retrieval_limited: false,
    });
    expect(result.text).toContain("Director of UX");
    expect(result.text).toContain("leading provider of virtual primary care");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
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
      .mockResolvedValueOnce(response("<main><h1>Senior Product Designer</h1><p>Own design strategy for Acme teams, lead discovery, partner with product and engineering, and shape enterprise workflows. You will define the design vision, establish interaction patterns, and mentor a small team of designers embedded in cross-functional squads. The role requires 8+ years of experience and a track record of shipping at scale. Compensation: $170k–$200k. Remote-first, US-based candidates preferred.</p></main>"));

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
          "Lead UX strategy for complex SaaS workflows, facilitate discovery with cross-functional teams, and translate customer insights into product direction. You will own the end-to-end design process from research through delivery, partnering closely with engineering and product leadership. The role requires 8+ years of UX experience including at least 3 years in a lead or principal capacity. Strong background in enterprise software, design systems, and accessibility standards. Compensation: $160k–$195k. Fully remote."
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
    });
    expect(result.text).toContain("Lead UX strategy for complex SaaS workflows");
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
          "LifeMD Senior Product Designer role focused on patient experience, funnel optimization, and design systems. You will lead UX across telehealth patient journeys and internal clinical workflows. The role requires 7+ years of product design experience with demonstrated impact in regulated or healthcare environments. Strong portfolio showing end-to-end ownership, from research to shipped product. Compensation: $155k–$185k. Hybrid, New York preferred."
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
