import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "@/app/api/scrape/review/route";
import { archiveJob, getJob, saveJob } from "@/lib/jobs-repository";

vi.mock("@/lib/jobs-repository", () => ({
  getJob: vi.fn(),
  saveJob: vi.fn(),
  archiveJob: vi.fn(),
}));

const pendingJob = {
  company: "Acme", role: "Designer", url: "https://x.test/1", salary: "$150k",
  notes: "", scrapeGroup: "remote", scrapeDate: "2026-02-01",
};

const call = (handler: typeof POST, method: string, body: unknown) =>
  handler(new NextRequest("http://localhost/api/scrape/review", {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }));

beforeEach(() => {
  [getJob, saveJob, archiveJob].forEach((fn) => vi.mocked(fn).mockReset());
  vi.mocked(getJob).mockResolvedValue({ id: "p1", section: "pending", job: { ...pendingJob } });
  vi.mocked(saveJob).mockResolvedValue(true);
  vi.mocked(archiveJob).mockResolvedValue(true);
});

describe("POST /api/scrape/review", () => {
  // Z — Zero
  it("returns 400 when company, role or action is missing", async () => {
    expect((await call(POST, "POST", { company: "Acme" })).status).toBe(400);
    expect(saveJob).not.toHaveBeenCalled();
  });

  // O — One
  it("approving moves the pending job to prospect, keeping its id", async () => {
    const response = await call(POST, "POST", { id: "p1", company: "Acme", role: "Designer", action: "approve", fit: "strong", scoreRationale: "why" });

    expect(response.status).toBe(200);
    expect(getJob).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", section: "pending" }));
    expect(saveJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: "p1" }),
      { section: "prospect", job: expect.objectContaining({ company: "Acme", fit: "strong", isNew: true, scoreRationale: "why", url: "https://x.test/1" }) },
    );
  });

  // B — Boundary: scrape-only fields do not leak into the tracked job
  it("drops the scrape fields when approving", async () => {
    await call(POST, "POST", { company: "Acme", role: "Designer", action: "approve" });

    const job = vi.mocked(saveJob).mock.calls[0][1].job;
    expect(job).not.toHaveProperty("scrapeGroup");
    expect(job).not.toHaveProperty("scrapeDate");
    expect(job.notes).toBe("Scraped 2026-02-01");
  });

  it("approves a local-group job into the local section", async () => {
    vi.mocked(getJob).mockResolvedValue({ id: "p1", section: "pending", job: { ...pendingJob, scrapeGroup: "local" } });

    await call(POST, "POST", { company: "Acme", role: "Designer", action: "approve" });

    expect(vi.mocked(saveJob).mock.calls[0][1].section).toBe("local");
  });

  it("rejecting moves the job to passed with a note, instead of deleting it", async () => {
    await call(POST, "POST", { company: "Acme", role: "Designer", action: "reject" });

    expect(saveJob).toHaveBeenCalledWith(
      expect.anything(),
      { section: "passed", job: expect.objectContaining({ company: "Acme", notes: "Rejected from scrape queue 2026-02-01" }) },
    );
    expect(archiveJob).not.toHaveBeenCalled();
  });

  // E — Exception
  it("returns 404 and writes nothing when the pending job does not exist", async () => {
    vi.mocked(getJob).mockResolvedValue(undefined);

    const response = await call(POST, "POST", { company: "Nope", role: "Nope", action: "approve" });

    expect(response.status).toBe(404);
    expect(saveJob).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/scrape/review", () => {
  it("returns 400 without company and role", async () => {
    expect((await call(DELETE as never, "DELETE", {})).status).toBe(400);
  });

  it("archives just that pending job", async () => {
    const response = await call(DELETE as never, "DELETE", { id: "p1", company: "Acme", role: "Designer" });

    expect(response.status).toBe(200);
    expect(archiveJob).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", section: "pending" }));
  });

  // B — Boundary: dismissing something already gone stays a success, as before
  it("still succeeds when the job is already gone", async () => {
    vi.mocked(archiveJob).mockResolvedValue(false);

    expect((await call(DELETE as never, "DELETE", { company: "Acme", role: "Designer" })).status).toBe(200);
  });
});
