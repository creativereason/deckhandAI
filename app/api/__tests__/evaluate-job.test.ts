import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST, PUT } from "@/app/api/evaluate-job/route";
import { getSession } from "@/lib/auth";
import { fetchJobDetails } from "@/lib/job-fetcher";
import { readJobs, writeJobs } from "@/lib/jobs";
import { fetchGenerate } from "@/lib/model";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/config", () => ({
  readConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/job-fetcher", () => ({
  fetchJobDetails: vi.fn(),
}));

vi.mock("@/lib/model", () => ({
  fetchGenerate: vi.fn(),
}));

vi.mock("@/lib/jobs", () => ({
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
        OVERVIEW APPLICATION Share this job Description About LifeMD LifeMD is a leading provider of virtual primary care, telehealth, and specialized treatment programs serving hundreds of thousands of patients nationwide.
        About the Role LifeMD is seeking a highly strategic and customer-obsessed Director of UX to lead experience design across patient experiences, physician workflows, and end-to-end digital care journeys.`,
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
    expect(result.notes).toContain("LifeMD is seeking a highly strategic and customer-obsessed Director of UX");
    expect(result.notes).not.toContain("OVERVIEW APPLICATION");
    expect(result.notes).not.toContain("Share this job");
    expect(result.notes).not.toContain("Weak fit");
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
