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

  // B — Boundary: HTML entities in the body (not just the meta description) must decode too.
  it("decodes HTML entities in the page body, not just the meta description", async () => {
    const html = `<html><body><h1>Staff Product Designer (Experience &amp; Engagement)</h1>
      <p>Own end-to-end design vision and execution across the customer experience product surface. Partner with product, engineering, and operations to ship measurable improvements every quarter.&nbsp; The role requires 7+ years of product design experience with a strong portfolio demonstrating systems thinking and cross-functional leadership on consumer-facing products. Compensation: $190k&#8211;$230k. Fully remote.</p>
      </body></html>`;
    const fetchImpl = vi.fn().mockResolvedValue(response(html));

    const result = await fetchJobDetails({ url: "https://jobs.example.com/designer", fetchImpl });

    expect(result.text).toContain("Experience & Engagement");
    expect(result.text).not.toContain("&amp;");
    expect(result.text).not.toContain("&nbsp;");
    expect(result.text).toContain("$190k–$230k");
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

  describe("time budget", () => {
    // B — Boundary: once the cumulative budget is spent, remaining fallback legs
    // must be skipped instead of hanging past the route's maxDuration.
    it("skips the markdown, Brave, and Playwright legs once the budget is exhausted after the raw fetch", async () => {
      vi.stubEnv("BRAVE_SEARCH_API_KEY", "brave-key");
      vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "true");
      let elapsedMs = 0;
      const nowMs = () => elapsedMs;
      // The raw fetch itself is what spends the whole budget.
      const fetchImpl = vi.fn().mockImplementationOnce(async () => {
        elapsedMs = 46000;
        return response("");
      });
      const loadPlaywrightImpl = vi.fn();

      const result = await fetchJobDetails({
        url: "https://jobs.example.com/empty",
        fetchImpl,
        loadPlaywrightImpl,
        nowMs,
      });

      expect(result).toMatchObject({ ok: false, retrieval_limited: true });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(loadPlaywrightImpl).not.toHaveBeenCalled();
    });

    // M — Many: the Brave-alternates loop must stop trying candidates once
    // the budget runs out instead of always attempting every result.
    it("stops trying further Brave alternate candidates once the budget runs out mid-loop", async () => {
      vi.stubEnv("BRAVE_SEARCH_API_KEY", "brave-key");
      let elapsedMs = 0;
      const nowMs = () => elapsedMs;
      const fetchImpl = vi
        .fn()
        .mockImplementationOnce(async () => response(""))
        .mockImplementationOnce(async () => Response.json({
          web: {
            results: [
              { title: "Job A", url: "https://jobs.lever.co/acme/a" },
              { title: "Job B", url: "https://jobs.lever.co/acme/b" },
            ],
          },
        }))
        // Fetching the first candidate is what spends the remaining budget.
        .mockImplementationOnce(async () => {
          elapsedMs = 46000;
          return response("");
        });

      const result = await fetchJobDetails({
        url: "https://acme.myworkdayjobs.com/job/123",
        company: "Acme",
        role: "Designer",
        fetchImpl,
        nowMs,
      });

      expect(result).toMatchObject({ ok: false, retrieval_limited: true });
      // raw fetch + brave search + exactly one alternate candidate fetch, no second candidate
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    });

  });

  describe("company-homepage fallback", () => {
    // M — Many: when every other leg comes up empty, homepage context beats nothing.
    it("falls back to the company homepage when the JD page and all other legs yield nothing", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(response("")) // raw JD fetch — empty
        .mockResolvedValueOnce(response(
          "<main>" + "Acme builds logistics software for freight teams worldwide, helping them route shipments and manage vendors more efficiently every day. ".repeat(3) + "</main>"
        )); // homepage fetch

      const result = await fetchJobDetails({
        url: "https://careers.acme.com/jobs/123",
        company: "Acme",
        fetchImpl,
      });

      expect(result).toMatchObject({
        ok: true,
        source_url: "https://acme.com",
        retrieval_limited: true,
      });
      expect(result.text).toContain("Acme builds logistics software");
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    // B — Boundary: third-party ATS hosts have no meaningful homepage of their own.
    it("does not treat a third-party ATS host as a homepage, and uses the company name instead", async () => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(response("")) // raw JD fetch on the ATS host — empty
        .mockResolvedValueOnce(response(
          "Acme builds logistics software for freight teams worldwide, helping them route shipments and manage vendors more efficiently every day. ".repeat(3)
        )); // fetch of the company-name-derived homepage

      const result = await fetchJobDetails({
        url: "https://jobs.ashbyhq.com/acme/123",
        company: "Acme",
        fetchImpl,
      });

      expect(result.source_url).toBe("https://www.acme.com");
      expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://www.acme.com", expect.any(Object));
    });

    // E — Exception: an exhausted time budget must skip the homepage leg too.
    it("skips the homepage fallback once the time budget is exhausted", async () => {
      let elapsedMs = 0;
      const nowMs = () => elapsedMs;
      const fetchImpl = vi.fn().mockImplementationOnce(async () => {
        elapsedMs = 46000;
        return response("");
      });

      const result = await fetchJobDetails({
        url: "https://careers.acme.com/jobs/123",
        company: "Acme",
        fetchImpl,
        nowMs,
      });

      expect(result).toMatchObject({ ok: false, retrieval_limited: true });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe("brave timeout", () => {
    // E — Exception: the Brave Search API call itself must not hang indefinitely.
    it("passes an abort signal to the Brave Search API request", async () => {
      vi.stubEnv("BRAVE_SEARCH_API_KEY", "brave-key");
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(response(""))
        .mockResolvedValueOnce(Response.json({ web: { results: [] } }));

      await fetchJobDetails({
        url: "https://jobs.example.com/empty",
        fetchImpl,
      });

      const braveCall = fetchImpl.mock.calls.find(([url]) => String(url).includes("api.search.brave.com"));
      expect(braveCall?.[1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("content-quality gate", () => {
    // E — Exception: a long SPA app-shell (site-wide nav/mega-menu) can be long enough
    // and free of nav-boilerplate keywords, yet still isn't a job description — it must
    // not be accepted as "enough text" just because of its length.
    it("falls through to Playwright when the raw fetch returns a long site-navigation shell with no job-description signal", async () => {
      vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "true");
      const navShell = "Skip to content Skip to site index Earn up to $2,000 when you buy $50 in crypto Cryptocurrencies Individuals Trade Crypto Buy and sell cryptocurrencies Prediction markets Trade on sports crypto politics and more Derivatives Amplify your trades with futures Stocks Commission-free trading Token sales Get early access to upcoming tokens Advanced Professional-grade trading tools Coinbase One Get zero trading fees Coinbase Wealth Institutional-grade services Credit Card Earn Bitcoin back on every purchase Terms apply Debit card Earn crypto rewards Staking Stake your crypto and earn rewards USDC rewards Earn APY Borrow Get a crypto-backed loan Base App Post earn trade discover apps Businesses Business Crypto trading and payments Asset Listings List your asset Token Manager platform for distributions Coinbase Business All-in-one crypto account Institutions Prime Trading and Financing Professional prime brokerage services Custody Securely store digital assets Staking Explore staking Onchain Wallet Institutional-grade wallet Markets Exchange Spot market data".repeat(3);
      const fetchImpl = vi.fn().mockResolvedValue(response(`<body>${navShell}</body>`));
      const close = vi.fn();
      const page = {
        goto: vi.fn(),
        waitForTimeout: vi.fn(),
        locator: vi.fn().mockReturnValue({
          innerText: vi.fn().mockResolvedValue(
            "Staff Product Designer (Experience & Engagement) at Coinbase. You will own end-to-end design for engagement surfaces spanning notifications, onboarding, and retention flows across the Coinbase app. The role requires 8+ years of product design experience with a strong portfolio demonstrating systems thinking and cross-functional leadership on consumer-facing products. Familiarity with design systems, user research methods, and experimentation is essential. Compensation: $190k–$230k depending on experience. This is a fully remote position open to candidates in the US."
          ),
        }),
      };
      const browser = { newPage: vi.fn().mockResolvedValue(page), close };
      const loadPlaywrightImpl = vi.fn().mockResolvedValue({ chromium: { launch: vi.fn().mockResolvedValue(browser) } });

      const result = await fetchJobDetails({
        url: "https://www.coinbase.com/careers/positions/8014564",
        fetchImpl,
        loadPlaywrightImpl,
      });

      expect(result.retrieval_method).toBe("playwright");
      expect(result.text).toContain("Staff Product Designer");
      expect(result.text).not.toContain("Skip to site index");
    });
  });
});
