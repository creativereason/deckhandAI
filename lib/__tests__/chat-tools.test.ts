import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeTool } from "@/lib/chat-tools";
import { readJobs, writeJobs } from "@/lib/jobs-repository";
import { generateAiSummary } from "@/lib/job-summary-server";
import type { JobsData } from "@/lib/jobs";

vi.mock("@/lib/jobs-repository", () => ({
  readJobs: vi.fn(),
  writeJobs: vi.fn(),
}));

vi.mock("@/lib/profile-server", () => ({
  readProfile: vi.fn(),
}));

vi.mock("@/lib/job-fetcher", () => ({
  fetchJobDetails: vi.fn(),
}));

vi.mock("@/lib/job-summary-server", () => ({
  generateAiSummary: vi.fn(),
}));

function emptyJobs(): JobsData {
  return { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };
}

beforeEach(() => {
  vi.mocked(readJobs).mockResolvedValue(emptyJobs());
  vi.mocked(writeJobs).mockReset();
  vi.mocked(generateAiSummary).mockReset();
});

describe("executeTool add_job", () => {
  it("fills aiSummary from the generator when the model omits it", async () => {
    vi.mocked(generateAiSummary).mockResolvedValue("Acme builds robots. The role owns UX.");

    const result = JSON.parse(await executeTool("add_job", {
      section: "prospect",
      company: "Acme",
      role: "Designer",
      notes: "Team of five, reports to VP.",
    })) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(writeJobs).toHaveBeenCalledWith(expect.objectContaining({
      prospect: [expect.objectContaining({ aiSummary: "Acme builds robots. The role owns UX." })],
    }));
  });

  it("keeps the model-provided aiSummary without calling the generator", async () => {
    await executeTool("add_job", {
      section: "prospect",
      company: "Acme",
      role: "Designer",
      aiSummary: "Provided summary.",
    });

    expect(generateAiSummary).not.toHaveBeenCalled();
    expect(writeJobs).toHaveBeenCalledWith(expect.objectContaining({
      prospect: [expect.objectContaining({ aiSummary: "Provided summary." })],
    }));
  });
});
