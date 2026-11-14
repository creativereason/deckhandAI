import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobRepository } from "@/lib/jobs-repository";
import { scoreNewPendingJobs } from "@/lib/score";
import { saveScrapedJobs } from "@/lib/scrape-run";
import type { PendingJob } from "@/lib/jobs";

const addMany = vi.fn();
vi.mock("@/lib/jobs-repository", () => ({ readJobs: vi.fn(), jobRepository: vi.fn(() => ({ addMany })) }));
vi.mock("@/lib/score", () => ({ scoreNewPendingJobs: vi.fn() }));

const job = (role: string): PendingJob => ({
  company: "Acme", role, url: "", salary: "", notes: "", scrapeGroup: "remote", scrapeDate: "2026-01-01",
});

beforeEach(() => {
  addMany.mockReset();
  vi.mocked(jobRepository).mockClear();
  vi.mocked(scoreNewPendingJobs).mockReset();
});

describe("saveScrapedJobs", () => {
  // Z — Zero
  it("does nothing when the scrape found nothing new", async () => {
    await saveScrapedJobs([]);

    expect(scoreNewPendingJobs).not.toHaveBeenCalled();
    expect(addMany).not.toHaveBeenCalled();
  });

  // M — Many
  it("adds every new job to the inbox in a single call", async () => {
    const found = [job("A"), job("B")];

    await saveScrapedJobs(found);

    expect(addMany).toHaveBeenCalledTimes(1);
    expect(addMany).toHaveBeenCalledWith("pending", found);
  });

  // B — Boundary: scoring fills fit in place, so it must finish before the jobs are saved
  it("saves the jobs with the scores that scoring added", async () => {
    vi.mocked(scoreNewPendingJobs).mockImplementation(async (jobs) => { jobs[0].fit = "strong"; });
    let savedFit: unknown;
    addMany.mockImplementation(async (_section, jobs) => { savedFit = jobs[0].fit; });

    await saveScrapedJobs([job("A")]);

    expect(savedFit).toBe("strong");
  });

  // I — Interface: the event log must say these came from the scraper, not the signed-in user
  it("writes as the scraper actor", async () => {
    await saveScrapedJobs([job("A")]);

    expect(jobRepository).toHaveBeenCalledWith("scraper");
  });
});
