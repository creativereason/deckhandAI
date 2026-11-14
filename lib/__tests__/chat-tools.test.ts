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

describe("executeTool update_jobs", () => {
  const applied = (company: string, status = "applied") =>
    ({ company, role: "Designer", status, date: "2026-01-01", salary: "", notes: "", url: "" });
  const board = (names: string[]): JobsData => ({ ...emptyJobs(), applied: names.map((n) => applied(n)) as never });
  const target = (company: string) => ({ company, role: "Designer" });

  // Z — Zero
  it("changes nothing and writes nothing when the job list is empty", async () => {
    const result = JSON.parse(await executeTool("update_jobs", { section: "applied", jobs: [], updates: { status: "declined" } }));

    expect(result).toMatchObject({ ok: true, updated: 0 });
    expect(writeJobs).not.toHaveBeenCalled();
  });

  // M — Many: the case that exhausted the step limit one job at a time
  it("applies the same updates to every listed job with a single write", async () => {
    vi.mocked(readJobs).mockResolvedValue(board(["A", "B", "C"]));

    const result = JSON.parse(await executeTool("update_jobs", {
      section: "applied",
      jobs: [target("A"), target("C")],
      updates: { status: "declined" },
    }));

    expect(result).toMatchObject({ ok: true, updated: 2 });
    expect(writeJobs).toHaveBeenCalledTimes(1);
    const written = vi.mocked(writeJobs).mock.calls[0][0].applied as unknown as { company: string; status: string }[];
    expect(written.map((j) => [j.company, j.status])).toEqual([["A", "declined"], ["B", "applied"], ["C", "declined"]]);
  });

  // B — Boundary: a job that cannot be found is reported, not silently skipped, and the rest still apply
  it("reports jobs it could not find and still updates the others", async () => {
    vi.mocked(readJobs).mockResolvedValue(board(["A"]));

    const result = JSON.parse(await executeTool("update_jobs", {
      section: "applied",
      jobs: [target("A"), target("Missing")],
      updates: { status: "declined" },
    }));

    expect(result).toMatchObject({ ok: true, updated: 1, notFound: [target("Missing")] });
    expect(writeJobs).toHaveBeenCalledTimes(1);
  });

  // E — Exception: nothing matched means nothing to save
  it("does not write when none of the jobs are found", async () => {
    vi.mocked(readJobs).mockResolvedValue(board(["A"]));

    const result = JSON.parse(await executeTool("update_jobs", {
      section: "applied", jobs: [target("Nope")], updates: { status: "declined" },
    }));

    expect(result).toMatchObject({ updated: 0, notFound: [target("Nope")] });
    expect(writeJobs).not.toHaveBeenCalled();
  });

  // I — Interface: the model can discover the tool
  it("is offered to the model alongside update_job", async () => {
    const { ANTHROPIC_TOOLS } = await import("@/lib/chat-tools");

    expect(ANTHROPIC_TOOLS.map((t) => t.name)).toContain("update_jobs");
  });
});
