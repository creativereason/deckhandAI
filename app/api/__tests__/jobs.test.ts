import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/jobs/route";
import { readJobs, writeJobs } from "@/lib/jobs-repository";
import { generateAiSummary } from "@/lib/job-summary-server";
import type { JobsData } from "@/lib/jobs";

vi.mock("@/lib/jobs-repository", () => ({
  readJobs: vi.fn(),
  writeJobs: vi.fn(),
}));

vi.mock("@/lib/job-summary-server", () => ({
  generateAiSummary: vi.fn(),
}));

function request(body: unknown) {
  return new NextRequest("http://localhost/api/jobs", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function emptyJobs(): JobsData {
  return { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };
}

beforeEach(() => {
  vi.mocked(readJobs).mockResolvedValue(emptyJobs());
  vi.mocked(writeJobs).mockReset();
  vi.mocked(generateAiSummary).mockReset();
});

describe("POST /api/jobs", () => {
  it("fills aiSummary from the generator when the new job has none", async () => {
    vi.mocked(generateAiSummary).mockResolvedValue("Acme builds robots. The role owns UX.");

    const response = await POST(request({
      section: "prospect",
      job: { company: "Acme", role: "Designer", fit: "good", salary: "", notes: "Team of five.", url: "" },
    }));

    expect(response.status).toBe(200);
    expect(generateAiSummary).toHaveBeenCalledWith(expect.objectContaining({ company: "Acme", role: "Designer" }));
    expect(writeJobs).toHaveBeenCalledWith(expect.objectContaining({
      prospect: [expect.objectContaining({ aiSummary: "Acme builds robots. The role owns UX." })],
    }));
  });

  it("keeps a caller-provided aiSummary without calling the generator", async () => {
    const response = await POST(request({
      section: "prospect",
      job: { company: "Acme", role: "Designer", fit: "good", aiSummary: "Provided summary." },
    }));

    expect(response.status).toBe(200);
    expect(generateAiSummary).not.toHaveBeenCalled();
    expect(writeJobs).toHaveBeenCalledWith(expect.objectContaining({
      prospect: [expect.objectContaining({ aiSummary: "Provided summary." })],
    }));
  });
});
