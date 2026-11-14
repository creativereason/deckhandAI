import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/scrape/score-pending/route";
import { patchJobs, readJobs } from "@/lib/jobs-repository";
import { scoreNewPendingJobs } from "@/lib/score";
import type { JobsData, PendingJob } from "@/lib/jobs";

vi.mock("@/lib/jobs-repository", () => ({ readJobs: vi.fn(), patchJobs: vi.fn(), writeJobs: vi.fn() }));
vi.mock("@/lib/score", () => ({ scoreNewPendingJobs: vi.fn() }));

const pending = (role: string, extra: Partial<PendingJob> = {}): PendingJob => ({
  id: `id-${role}`, company: "Acme", role, url: "", salary: "", notes: "", scrapeGroup: "remote", scrapeDate: "2026-01-01", ...extra,
});
const board = (list: PendingJob[]): JobsData => ({ applied: [], prospect: [], local: [], staffing: [], passed: [], pending: list });

beforeEach(() => {
  vi.mocked(readJobs).mockReset();
  vi.mocked(patchJobs).mockReset();
  vi.mocked(patchJobs).mockResolvedValue({ updated: 0, notFound: [] });
  vi.mocked(scoreNewPendingJobs).mockReset();
});

describe("POST /api/scrape/score-pending", () => {
  // Z — Zero
  it("scores nothing and writes nothing when the inbox is empty", async () => {
    vi.mocked(readJobs).mockResolvedValue(board([]));

    expect(await (await POST()).json()).toEqual({ scored: 0 });
    expect(patchJobs).not.toHaveBeenCalled();
  });

  it("skips jobs that already have a rationale", async () => {
    vi.mocked(readJobs).mockResolvedValue(board([pending("A", { scoreRationale: "done" })]));

    expect(await (await POST()).json()).toEqual({ scored: 0 });
    expect(scoreNewPendingJobs).not.toHaveBeenCalled();
  });

  // M — Many / B — Boundary: only the fit and rationale of the scored jobs are written
  it("patches only fit and scoreRationale on the jobs that got scored", async () => {
    vi.mocked(readJobs).mockResolvedValue(board([pending("A"), pending("B"), pending("C", { scoreRationale: "old" })]));
    vi.mocked(scoreNewPendingJobs).mockImplementation(async (jobs) => {
      jobs[0].fit = "strong"; jobs[0].scoreRationale = "good match";
      // jobs[1] fails to score and is left alone
    });

    const body = await (await POST()).json();

    expect(body).toEqual({ scored: 1 });
    expect(patchJobs).toHaveBeenCalledTimes(1);
    expect(patchJobs).toHaveBeenCalledWith([
      { target: { id: "id-A", section: "pending", company: "Acme", role: "A" }, updates: { fit: "strong", scoreRationale: "good match" } },
    ]);
  });

  // E — Exception: nothing scored means nothing to write
  it("does not write when every scoring attempt failed", async () => {
    vi.mocked(readJobs).mockResolvedValue(board([pending("A")]));

    expect(await (await POST()).json()).toEqual({ scored: 0 });
    expect(patchJobs).not.toHaveBeenCalled();
  });
});
