import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, PUT } from "@/app/api/evaluate-job/route";
import { getSession } from "@/lib/auth";
import { fetchJobDetails } from "@/lib/job-fetcher";
import { readJobs, writeJobs } from "@/lib/jobs-repository";
import { fetchGenerate } from "@/lib/model";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/config-repository", () => ({
  readConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/job-fetcher", () => ({
  fetchJobDetails: vi.fn(),
}));

vi.mock("@/lib/model", () => ({
  fetchGenerate: vi.fn(),
}));

vi.mock("@/lib/jobs-repository", () => ({
  readJobs: vi.fn(),
  writeJobs: vi.fn(),
}));

function request(method: "POST" | "PUT", body: unknown) {
  return new NextRequest("http://localhost/api/evaluate-job", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function streamText(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text;
    text += decoder.decode(value, { stream: true });
  }
}

function resultEventData(stream: string): { notes?: string } {
  const match = stream.match(/event: result\ndata: (.+)\n/);
  return match ? JSON.parse(match[1]) as { notes?: string } : {};
}

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ authenticated: true } as Awaited<ReturnType<typeof getSession>>);
  vi.mocked(fetchJobDetails).mockReset();
  vi.mocked(fetchGenerate).mockReset();
  vi.mocked(readJobs).mockReset();
  vi.mocked(writeJobs).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/evaluate-job", () => {
  it("returns 400 with a field path when POST body is empty", async () => {
    const response = await POST(request("POST", {}));
    const body = await response.json() as { error: { fieldErrors: Record<string, unknown> } };

    expect(response.status).toBe(400);
    expect(body.error.fieldErrors).toHaveProperty("url");
    expect(fetchJobDetails).not.toHaveBeenCalled();
  });

  it("returns 400 with a field path when PUT body is missing required fields", async () => {
    const response = await PUT(request("PUT", { company: "Acme" }));
    const body = await response.json() as { error: { fieldErrors: Record<string, unknown> } };

    expect(response.status).toBe(400);
    expect(body.error.fieldErrors).toHaveProperty("role");
    expect(body.error.fieldErrors).toHaveProperty("url");
    expect(writeJobs).not.toHaveBeenCalled();
  });

  it("returns 400 when PUT fit is not one of the JobFit enum values", async () => {
    const response = await PUT(request("PUT", {
      company: "Acme",
      role: "Senior UX Designer",
      url: "https://example.com/job",
      fit: "amazing",
    }));
    const body = await response.json() as { error: { fieldErrors: Record<string, unknown> } };

    expect(response.status).toBe(400);
    expect(body.error.fieldErrors).toHaveProperty("fit");
  });

  it("returns 401 before fetching when the session is unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: false } as Awaited<ReturnType<typeof getSession>>);

    const response = await POST(request("POST", { url: "https://example.com/job" }));

    expect(response.status).toBe(401);
    expect(fetchJobDetails).not.toHaveBeenCalled();
  });

  it("streams a status event before the result event", async () => {
    vi.mocked(fetchJobDetails).mockResolvedValue({
      ok: true,
      url: "https://example.com/job",
      text: "Senior UX Designer role focused on research, prototyping, systems thinking, and product strategy.",
      retrieval_method: "fetch_only",
      retrieval_limited: false,
    });

    const response = await POST(request("POST", {
      url: "https://example.com/job",
      company: "Acme",
      role: "Senior UX Designer",
    }));
    const body = await streamText(response);

    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(body.indexOf("event: status")).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("event: result")).toBeGreaterThan(body.indexOf("event: status"));
    expect(fetchJobDetails).toHaveBeenCalledWith({
      url: "https://example.com/job",
      company: "Acme",
      role: "Senior UX Designer",
    });
  });

  it("stores notes as scrape date, company summary, and role summary instead of fit assessment", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.mocked(fetchGenerate).mockResolvedValue(JSON.stringify({
      company: "LifeMD",
      role: "Director of UX",
      salary: "",
      notes: "Weak fit because this is too senior and healthcare-specific.",
      fit: "weak",
      scoreRationale: "Role fit needs review.",
    }));
    vi.mocked(fetchJobDetails).mockResolvedValue({
      ok: true,
      url: "https://lifemd.workable.com/jobs/123",
      text: `Director of UX HybridTechnologyFull time New York, New York, United States
        OVERVIEW APPLICATION Share this job Description About LifeMD LifeMD is a leading provider of virtual primary care, telehealth, and specialized treatment programs serving hundreds of thousands of patients nationwide. The company combines licensed providers, pharmacy and lab integrations, and proprietary technology to make healthcare more accessible.
        About the Role LifeMD is seeking a highly strategic and customer-obsessed Director of UX to lead experience design across patient experiences, physician workflows, and end-to-end digital care journeys. This role owns UX leadership across care journeys, design systems, and cross-functional product strategy.`,
      retrieval_method: "playwright",
      retrieval_limited: false,
    });

    const response = await POST(request("POST", {
      url: "https://lifemd.workable.com/jobs/123",
      company: "LifeMD",
      role: "Director of UX",
    }));
    const result = resultEventData(await streamText(response));

    expect(result.notes).toContain("Scraped ");
    expect(result.notes).toContain("LifeMD is a leading provider of virtual primary care");
    expect(result.notes).toContain("The company combines licensed providers");
    expect(result.notes).toContain("LifeMD is seeking a highly strategic and customer-obsessed Director of UX");
    expect(result.notes).toContain("This role owns UX leadership");
    expect(result.notes).not.toContain("OVERVIEW APPLICATION");
    expect(result.notes).not.toContain("Share this job");
    expect(result.notes).not.toContain("Weak fit");
  });

  it("treats role text with multiple nav-boilerplate hits across many sentences as unusable", async () => {
    vi.mocked(fetchJobDetails).mockResolvedValue({
      ok: true,
      url: "https://example.com/job",
      text: "About Acme\nAcme builds tools for logistics teams worldwide, helping them route freight and manage vendors more efficiently every day.\n\nAbout the Role\nLog in to see more opportunities. Sign in for full access. This role focuses on strategic design leadership. We ship high quality experiences.",
      retrieval_method: "fetch_only",
      retrieval_limited: false,
    });

    const response = await POST(request("POST", {
      url: "https://example.com/job",
      company: "Acme",
      role: "Designer",
    }));
    const result = resultEventData(await streamText(response));

    expect(result.notes).not.toContain("Log in to see more opportunities");
    expect(result.notes).toContain("Role summary unavailable.");
  });

  it("extracts the role summary from a 'What you'll do' heading when no 'About the Role' heading exists", async () => {
    const navShell = "Skip to content Skip to site index Earn up to $2,000 when you buy $50 in crypto Cryptocurrencies Individuals Trade Crypto Buy and sell cryptocurrencies Prediction markets Trade on sports crypto politics and more Derivatives Amplify your trades with futures Stocks Commission-free trading Token sales Get early access to upcoming tokens Advanced Professional-grade trading tools Coinbase One Get zero trading fees Coinbase Wealth Institutional-grade services Credit Card Earn Bitcoin back on every purchase. Terms apply. Debit card Earn crypto rewards Staking Stake your crypto and earn rewards USDC rewards Earn APY Borrow Get a crypto-backed loan Base App Post earn trade discover apps. Businesses Business Crypto trading and payments Asset Listings List your asset Token Manager platform for distributions. Institutions Prime Trading and Financing Custody Securely store digital assets. Sign in Sign up Back to jobs.";
    const jdText = "Staff Product Designer Remote - USA At Coinbase, we are uncompromising on our mission to increase economic freedom around the world. What you'll do: Own end-to-end design vision and execution across the customer experience product surface. Partner with product, engineering, and operations to ship measurable improvements. Required skills & experience: 7+ years of Product Design experience with a strong portfolio.";
    vi.mocked(fetchJobDetails).mockResolvedValue({
      ok: true,
      url: "https://www.coinbase.com/careers/positions/8014564",
      text: `${navShell} ${jdText}`,
      retrieval_method: "fetch_only",
      retrieval_limited: false,
    });

    const response = await POST(request("POST", {
      url: "https://www.coinbase.com/careers/positions/8014564",
      company: "Coinbase",
      role: "Staff Product Designer",
    }));
    const result = resultEventData(await streamText(response));

    expect(result.notes).not.toContain("Skip to site index");
    expect(result.notes).toContain("Own end-to-end design vision");
  });

  it("extracts the role summary even when unrelated boilerplate appears much later on the same page", async () => {
    const companyIntro = "About Acme. Acme builds logistics software for freight teams worldwide, helping them route shipments more efficiently every day.";
    const roleIntro = "About the Role. Own end-to-end design for a cross-functional team shipping enterprise workflows. Partner with product and engineering to deliver measurable outcomes on a quarterly cadence.";
    const distantFooter = ` ${"Filler content about the platform. ".repeat(40)} Sign in Sign up. Copyright 2026 privacy policy terms of service.`;
    vi.mocked(fetchJobDetails).mockResolvedValue({
      ok: true,
      url: "https://example.com/job",
      text: `${companyIntro} ${roleIntro}${distantFooter}`,
      retrieval_method: "fetch_only",
      retrieval_limited: false,
    });

    const response = await POST(request("POST", {
      url: "https://example.com/job",
      company: "Acme",
      role: "Designer",
    }));
    const result = resultEventData(await streamText(response));

    expect(result.notes).not.toContain("Role summary unavailable");
    expect(result.notes).toContain("Own end-to-end design for a cross-functional team");
  });

  it("treats a long site-navigation shell with no boilerplate keywords or section headings as unusable", async () => {
    vi.mocked(fetchJobDetails).mockResolvedValue({
      ok: true,
      url: "https://example.com/job",
      text: "Skip to content Skip to site index Earn up to $2,000 when you buy $50 in crypto Cryptocurrencies Individuals Trade Crypto Buy and sell cryptocurrencies Prediction markets Trade on sports crypto politics and more Derivatives Amplify your trades with futures Stocks Commission-free trading Token sales Get early access to upcoming tokens Advanced Professional-grade trading tools Coinbase One Get zero trading fees Coinbase Wealth Institutional-grade services Credit Card Earn Bitcoin back on every purchase. Terms apply.",
      retrieval_method: "fetch_only",
      retrieval_limited: false,
    });

    const response = await POST(request("POST", {
      url: "https://example.com/job",
      company: "Coinbase",
      role: "Staff Product Designer",
    }));
    const result = resultEventData(await streamText(response));

    expect(result.notes).not.toContain("Skip to site index");
    expect(result.notes).toContain("No relevant job description found");
  });

  it("adds an evaluated job to pending only on confirmation", async () => {
    vi.mocked(readJobs).mockResolvedValue({
      applied: [],
      prospect: [],
      local: [],
      staffing: [],
      passed: [],
      pending: [],
    });

    const response = await PUT(request("PUT", {
      company: "Acme",
      role: "Senior UX Designer",
      url: "https://example.com/job",
      salary: "$160k",
      notes: "Design strategy role",
      fit: "strong",
      scoreRationale: "Strong seniority and domain fit.",
      retrieval: {
        ok: true,
        url: "https://example.com/job",
        text: "Job details",
        retrieval_method: "fetch_only",
        retrieval_limited: false,
      },
    }));

    expect(response.status).toBe(200);
    expect(writeJobs).toHaveBeenCalledWith(expect.objectContaining({
      pending: [expect.objectContaining({
        company: "Acme",
        role: "Senior UX Designer",
        url: "https://example.com/job",
        fit: "strong",
      })],
    }));
  });
});
