import { beforeEach, describe, expect, it, vi } from "vitest";
import { githubRead, githubWrite } from "@/lib/github";
import { readJobs, writeJobs } from "@/lib/jobs-repository";
import type { JobsData } from "@/lib/jobs";

vi.mock("@/lib/github", () => ({
  githubRead: vi.fn(),
  githubWrite: vi.fn(),
}));

const EMPTY_JOBS = { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };

beforeEach(() => {
  vi.mocked(githubRead).mockReset();
  vi.mocked(githubWrite).mockReset();
});

describe("readJobs", () => {
  // Z — Zero: legacy or empty JSON must still hydrate the full board shape.
  it("returns empty arrays for every section when stored JSON is empty", async () => {
    vi.mocked(githubRead).mockResolvedValue("{}");

    const jobs = await readJobs();

    expect(jobs).toEqual(EMPTY_JOBS);
  });

  // O — One: a single stored job should survive hydration unchanged.
  it("returns a populated section when stored JSON contains one job", async () => {
    const stored = {
      prospect: [{
        company: "Acme",
        role: "Design Lead",
        fit: "strong",
        salary: "$160k",
        notes: "Remote",
        url: "https://example.com/job",
      }],
    };
    vi.mocked(githubRead).mockResolvedValue(JSON.stringify(stored));

    const jobs = await readJobs();

    expect(jobs).toEqual({ ...EMPTY_JOBS, prospect: stored.prospect });
  });

  // E — Exception: unavailable storage falls back to a usable empty board.
  it("returns empty arrays for every section when GitHub read fails", async () => {
    vi.mocked(githubRead).mockRejectedValue(new Error("not found"));

    const jobs = await readJobs();

    expect(jobs).toEqual(EMPTY_JOBS);
  });
});

describe("writeJobs", () => {
  // O — One: writing delegates the exact JSON payload to the GitHub adapter.
  it("writes formatted jobs JSON to the data repo path", async () => {
    const jobs: JobsData = { ...EMPTY_JOBS };

    await writeJobs(jobs);

    expect(githubWrite).toHaveBeenCalledWith(
      "data/jobs.json",
      JSON.stringify(jobs, null, 2),
      "Update jobs.json"
    );
  });
});
