import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("with the supabase backend", () => {
  const selectAll = vi.fn();
  const insert = vi.fn();

  beforeEach(async () => {
    vi.stubEnv("DATA_BACKEND", "supabase");
    selectAll.mockReset();
    insert.mockReset();
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => ({}) }));
    vi.doMock("@/lib/supabase-row-store", () => ({
      createJobRowStore: () => ({ selectAll, insert, update: vi.fn(), remove: vi.fn() }),
    }));
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/supabase");
    vi.doUnmock("@/lib/supabase-row-store");
  });

  // O — One: reads come from rows, not from GitHub
  it("reads the board from the jobs table", async () => {
    selectAll.mockResolvedValue([]);
    const repo = await import("@/lib/jobs-repository");

    expect(await repo.readJobs()).toEqual(EMPTY_JOBS);
    expect(githubRead).not.toHaveBeenCalled();
  });

  // E — Exception: an empty fallback here would let the next write delete every row
  it("throws instead of returning an empty board when the read fails", async () => {
    selectAll.mockRejectedValue(new Error("connection reset"));
    const repo = await import("@/lib/jobs-repository");

    await expect(repo.readJobs()).rejects.toThrow("connection reset");
  });

  // O — One: writes go to rows, not to GitHub
  it("writes new jobs as rows", async () => {
    selectAll.mockResolvedValue([]);
    const repo = await import("@/lib/jobs-repository");

    await repo.writeJobs({ ...EMPTY_JOBS, passed: [{ company: "A", role: "R", salary: "", notes: "", url: "" }] });

    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ section: "passed", company: "A" })]);
    expect(githubWrite).not.toHaveBeenCalled();
  });
});

describe("single-job operations on the github backend", () => {
  const stored = {
    prospect: [
      { company: "Acme", role: "A", fit: "good", salary: "", notes: "", url: "" },
      { company: "Acme", role: "B", fit: "good", salary: "", notes: "", url: "" },
    ],
  };
  const written = () => JSON.parse(vi.mocked(githubWrite).mock.calls[0][1] as string) as JobsData;

  beforeEach(() => vi.mocked(githubRead).mockResolvedValue(JSON.stringify(stored)));

  // O — One
  it("adds a job at the front of its section", async () => {
    const { addJob } = await import("@/lib/jobs-repository");

    await addJob("pending", { company: "New", role: "N", salary: "", notes: "", url: "" });

    expect(written().pending.map((j) => j.role)).toEqual(["N"]);
  });

  // O — One
  it("finds a job by section, company and role", async () => {
    const { getJob } = await import("@/lib/jobs-repository");

    expect((await getJob({ section: "prospect", company: "Acme", role: "B" }))?.job.role).toBe("B");
  });

  // B — Boundary: edit in place without disturbing the neighbours
  it("saves an edited job in place", async () => {
    const { saveJob } = await import("@/lib/jobs-repository");

    const saved = await saveJob(
      { section: "prospect", company: "Acme", role: "A" },
      { section: "prospect", job: { ...stored.prospect[0], notes: "edited" } },
    );

    expect(saved).toBe(true);
    expect(written().prospect.map((j) => [j.role, j.notes])).toEqual([["A", "edited"], ["B", ""]]);
  });

  // B — Boundary: a section change puts it at the front of the new section
  it("moves a job to the front of another section", async () => {
    const { saveJob } = await import("@/lib/jobs-repository");

    await saveJob(
      { section: "prospect", company: "Acme", role: "A" },
      { section: "passed", job: stored.prospect[0] },
    );

    expect(written().prospect.map((j) => j.role)).toEqual(["B"]);
    expect(written().passed.map((j) => j.role)).toEqual(["A"]);
  });

  // E — Exception
  it("reports false and writes nothing for an unknown job", async () => {
    const { saveJob, archiveJob } = await import("@/lib/jobs-repository");
    const ref = { section: "prospect" as const, company: "Nope", role: "Nope" };

    expect(await saveJob(ref, { section: "prospect", job: stored.prospect[0] })).toBe(false);
    expect(await archiveJob(ref)).toBe(false);
    expect(githubWrite).not.toHaveBeenCalled();
  });

  // O — One: the JSON file has no deleted marker, so archive removes the entry
  it("removes an archived job from the JSON board", async () => {
    const { archiveJob } = await import("@/lib/jobs-repository");

    await archiveJob({ section: "prospect", company: "Acme", role: "A" });

    expect(written().prospect.map((j) => j.role)).toEqual(["B"]);
  });
});

describe("single-job operations on the supabase backend", () => {
  const insert = vi.fn();
  const update = vi.fn();
  const softDelete = vi.fn();
  const selectAll = vi.fn();

  beforeEach(() => {
    vi.stubEnv("DATA_BACKEND", "supabase");
    [insert, update, softDelete, selectAll].forEach((fn) => fn.mockReset());
    selectAll.mockResolvedValue([]);
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => ({}) }));
    vi.doMock("@/lib/supabase-row-store", () => ({
      createJobRowStore: () => ({ selectAll, insert, update, softDelete }),
    }));
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/supabase");
    vi.doUnmock("@/lib/supabase-row-store");
  });

  // B — Boundary: one row written, GitHub never touched
  it("adds a job as a single inserted row", async () => {
    const { addJob } = await import("@/lib/jobs-repository");

    await addJob("pending", { company: "New", role: "N", salary: "", notes: "", url: "" });

    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ section: "pending", role: "N" })]);
    expect(githubWrite).not.toHaveBeenCalled();
  });
});
