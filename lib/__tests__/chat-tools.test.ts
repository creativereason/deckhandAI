import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeTool } from "@/lib/chat-tools";
import { addJob, archiveJob, getJob, readJobs, saveJob, updateJobs } from "@/lib/jobs-repository";
import { generateAiSummary } from "@/lib/job-summary-server";
import type { JobsData } from "@/lib/jobs";

vi.mock("@/lib/jobs-repository", () => ({
  readJobs: vi.fn(),
  writeJobs: vi.fn(),
  addJob: vi.fn(),
  getJob: vi.fn(),
  saveJob: vi.fn(),
  archiveJob: vi.fn(),
  updateJobs: vi.fn(),
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
  [addJob, getJob, saveJob, archiveJob, updateJobs].forEach((fn) => vi.mocked(fn).mockReset());
  vi.mocked(saveJob).mockResolvedValue(true);
  vi.mocked(archiveJob).mockResolvedValue(true);
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
    expect(addJob).toHaveBeenCalledWith("prospect", expect.objectContaining({ aiSummary: "Acme builds robots. The role owns UX." }));
  });

  it("keeps the model-provided aiSummary without calling the generator", async () => {
    await executeTool("add_job", { section: "prospect", company: "Acme", role: "Designer", aiSummary: "Provided summary." });

    expect(generateAiSummary).not.toHaveBeenCalled();
    expect(addJob).toHaveBeenCalledWith("prospect", expect.objectContaining({ aiSummary: "Provided summary." }));
  });

  // E — Exception
  it("rejects an unknown section without adding anything", async () => {
    const result = JSON.parse(await executeTool("add_job", { section: "nowhere", company: "A", role: "B" }));

    expect(result.error).toMatch(/unknown section/i);
    expect(addJob).not.toHaveBeenCalled();
  });

  // I — Interface: the link the chat shows must carry the new row's id
  it("returns a detail link carrying the id of the added job", async () => {
    vi.mocked(addJob).mockResolvedValue("new-id");

    const result = JSON.parse(await executeTool("add_job", { section: "prospect", company: "Acme", role: "Designer", aiSummary: "x" }));

    expect(new URL(result.detailUrl, "http://x").searchParams.get("id")).toBe("new-id");
  });
});

describe("executeTool single-job tools", () => {
  const found = (job: Record<string, unknown>, section = "prospect") =>
    vi.mocked(getJob).mockResolvedValue({ id: "job-1", section: section as never, job });
  const acme = { company: "Acme", role: "Designer", fit: "good", salary: "", notes: "", url: "" };

  // B — Boundary: none of these may read the whole board any more
  it("update_job saves the merged job and never reads the whole board", async () => {
    found(acme);

    const result = JSON.parse(await executeTool("update_job", { section: "prospect", company: "Acme", role: "Designer", updates: { notes: "n" } }));

    expect(result).toMatchObject({ ok: true, updated: { notes: "n", company: "Acme" } });
    expect(saveJob).toHaveBeenCalledWith(expect.objectContaining({ company: "Acme" }), { section: "prospect", job: expect.objectContaining({ notes: "n" }) });
    expect(readJobs).not.toHaveBeenCalled();
  });

  it("move_job moves to the target section, clears isNew and fills the section's defaults", async () => {
    found({ ...acme, isNew: true });

    await executeTool("move_job", { from_section: "prospect", to_section: "applied", company: "Acme", role: "Designer" });

    const [, next] = vi.mocked(saveJob).mock.calls[0];
    expect(next.section).toBe("applied");
    expect(next.job).not.toHaveProperty("isNew");
    expect(next.job).toMatchObject({ status: "applied", date: expect.any(String) });
  });

  it("flag_ghost marks an applied job", async () => {
    found({ ...acme, status: "applied" }, "applied");

    await executeTool("flag_ghost", { company: "Acme", role: "Designer" });

    expect(saveJob).toHaveBeenCalledWith(expect.anything(), { section: "applied", job: expect.objectContaining({ isGhost: true }) });
  });

  it("delete_job archives instead of deleting", async () => {
    const result = JSON.parse(await executeTool("delete_job", { section: "prospect", company: "Acme", role: "Designer" }));

    expect(result).toEqual({ ok: true });
    expect(archiveJob).toHaveBeenCalledWith(expect.objectContaining({ company: "Acme" }));
  });

  // E — Exception
  it.each([
    ["update_job", { section: "prospect", company: "X", role: "Y", updates: {} }],
    ["move_job", { from_section: "prospect", to_section: "passed", company: "X", role: "Y" }],
    ["flag_ghost", { company: "X", role: "Y" }],
  ])("%s reports not found and writes nothing", async (tool, input) => {
    vi.mocked(getJob).mockResolvedValue(undefined);

    const result = JSON.parse(await executeTool(tool, input));

    expect(result.error).toMatch(/not found/i);
    expect(saveJob).not.toHaveBeenCalled();
  });

  it("delete_job reports not found when nothing was archived", async () => {
    vi.mocked(archiveJob).mockResolvedValue(false);

    expect(JSON.parse(await executeTool("delete_job", { section: "prospect", company: "X", role: "Y" })).error).toMatch(/not found/i);
  });
});

describe("executeTool update_jobs", () => {
  const target = (company: string) => ({ company, role: "Designer" });
  const ref = (company: string) => ({ section: "applied" as const, ...target(company) });

  // M — Many: the case that exhausted the step limit one job at a time
  it("hands every listed job and the same updates to one batch update", async () => {
    vi.mocked(updateJobs).mockResolvedValue({ updated: 2, notFound: [] });

    const result = JSON.parse(await executeTool("update_jobs", {
      section: "applied", jobs: [target("A"), target("C")], updates: { status: "declined" },
    }));

    expect(result).toEqual({ ok: true, updated: 2, notFound: [] });
    expect(updateJobs).toHaveBeenCalledTimes(1);
    expect(updateJobs).toHaveBeenCalledWith({ targets: [ref("A"), ref("C")], updates: { status: "declined" } });
  });

  // B — Boundary: a job that cannot be found is reported, not silently skipped
  it("reports jobs the batch could not find", async () => {
    vi.mocked(updateJobs).mockResolvedValue({ updated: 1, notFound: [ref("Missing")] });

    const result = JSON.parse(await executeTool("update_jobs", {
      section: "applied", jobs: [target("A"), target("Missing")], updates: { status: "declined" },
    }));

    expect(result).toMatchObject({ updated: 1, notFound: [target("Missing")] });
  });

  // I — Interface: the model can discover the tool
  it("is offered to the model alongside update_job", async () => {
    const { ANTHROPIC_TOOLS } = await import("@/lib/chat-tools");

    expect(ANTHROPIC_TOOLS.map((t) => t.name)).toContain("update_jobs");
  });
});

describe("executeTool list_jobs detail links", () => {
  const listed = async () => {
    const out = JSON.parse(await executeTool("list_jobs", { section: "prospect" })) as { detailUrl: string }[];
    return out.map((j) => new URL(j.detailUrl, "http://x").searchParams);
  };

  // B — Boundary: two jobs share a company and role, so each link must carry its own id
  it("gives each job a link with its own id", async () => {
    const job = (id: string) => ({ id, company: "Acme", role: "Designer", fit: "good" as const, salary: "", notes: "", url: "" });
    vi.mocked(readJobs).mockResolvedValue({ ...emptyJobs(), prospect: [job("a"), job("b")] });

    expect((await listed()).map((p) => p.get("id"))).toEqual(["a", "b"]);
  });

  // I — Interface: JSON-backed jobs have no id and still link by company + role
  it("links by company and role when a job has no id", async () => {
    vi.mocked(readJobs).mockResolvedValue({
      ...emptyJobs(),
      prospect: [{ company: "Acme", role: "Designer", fit: "good", salary: "", notes: "", url: "" }],
    });

    const [params] = await listed();
    expect([params.get("id"), params.get("company")]).toEqual([null, "Acme"]);
  });
});

describe("delete_job tool description", () => {
  // The model decides based on this text, and removal is no longer permanent
  it("does not tell the model the deletion is permanent", async () => {
    const { ANTHROPIC_TOOLS } = await import("@/lib/chat-tools");

    const description = ANTHROPIC_TOOLS.find((t) => t.name === "delete_job")!.description;

    expect(description).not.toMatch(/permanent/i);
    expect(description).toMatch(/archived/i);
  });
});
