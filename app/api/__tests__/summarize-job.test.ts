import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/summarize-job/route";
import { getSession } from "@/lib/auth";
import { generateAiSummary } from "@/lib/job-summary-server";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/config-repository", () => ({
  readConfig: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/job-summary-server", () => ({
  generateAiSummary: vi.fn(),
}));

function request(body: unknown) {
  return new NextRequest("http://localhost/api/summarize-job", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.mocked(getSession).mockResolvedValue({ authenticated: true } as Awaited<ReturnType<typeof getSession>>);
  vi.mocked(generateAiSummary).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/summarize-job", () => {
  it("returns 401 before generating when the session is unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue({ authenticated: false } as Awaited<ReturnType<typeof getSession>>);

    const response = await POST(request({ company: "Acme", role: "Designer" }));

    expect(response.status).toBe(401);
    expect(generateAiSummary).not.toHaveBeenCalled();
  });

  it("returns 400 with a field path when the body is empty", async () => {
    const response = await POST(request({}));
    const body = await response.json() as { error: { fieldErrors: Record<string, unknown> } };

    expect(response.status).toBe(400);
    expect(body.error.fieldErrors).toHaveProperty("company");
    expect(body.error.fieldErrors).toHaveProperty("role");
    expect(generateAiSummary).not.toHaveBeenCalled();
  });

  it("returns the generated summary for a valid request", async () => {
    vi.mocked(generateAiSummary).mockResolvedValue("Acme builds robots. The role owns UX.");

    const response = await POST(request({
      company: "Acme",
      role: "Designer",
      notes: "Team of five, reports to VP Design.",
    }));
    const body = await response.json() as { aiSummary: string };

    expect(response.status).toBe(200);
    expect(body.aiSummary).toBe("Acme builds robots. The role owns UX.");
    expect(generateAiSummary).toHaveBeenCalledWith(expect.objectContaining({
      company: "Acme",
      role: "Designer",
      notes: "Team of five, reports to VP Design.",
    }));
  });
});

describe("GET /api/summarize-job", () => {
  it("reports configured=false when no AI key or Ollama provider is set", async () => {
    const response = await GET();
    const body = await response.json() as { configured: boolean };

    expect(body.configured).toBe(false);
  });

  it("reports configured=true when an AI key is set", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");

    const response = await GET();
    const body = await response.json() as { configured: boolean };

    expect(body.configured).toBe(true);
  });
});
