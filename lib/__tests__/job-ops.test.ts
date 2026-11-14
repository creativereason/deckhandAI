import { describe, expect, it } from "vitest";
import type { JobsData } from "@/lib/jobs";
import { jobsDataToRows, type JobRow } from "@/lib/jobs-mapping";
import { addJobTo, archiveJobIn, getJobIn, patchJobsIn, saveJobIn, updateJobsIn } from "@/lib/job-ops";
import { readJobsFrom, type JobRowStore } from "@/lib/supabase-jobs";

const EMPTY: JobsData = { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };
const prospect = (role: string, company = "Acme") => ({ company, role, fit: "good" as const, salary: "", notes: "", url: "" });

/** In-memory jobs table that records every write, so tests can assert a single row was touched. */
function fakeStore(initial: JobRow[] = []) {
  const rows = new Map(initial.map((r) => [r.id, r]));
  const deleted = new Set<string>();
  const writes: { op: string; ids: string[] }[] = [];
  const store: JobRowStore = {
    selectAll: async () => [...rows.values()].filter((r) => !deleted.has(r.id)),
    insert: async (batch) => { writes.push({ op: "insert", ids: batch.map((r) => r.id) }); batch.forEach((r) => rows.set(r.id, r)); },
    update: async (batch) => { writes.push({ op: "update", ids: batch.map((r) => r.id) }); batch.forEach((r) => rows.set(r.id, r)); },
    softDelete: async (ids) => { writes.push({ op: "softDelete", ids }); ids.forEach((id) => deleted.add(id)); },
  };
  return { store, rows, deleted, writes };
}

function seeded(board: Partial<JobsData>) {
  return fakeStore(jobsDataToRows({ ...EMPTY, ...board }));
}

describe("addJobTo", () => {
  // Z — Zero
  it("puts the first job on an empty board and returns its new id", async () => {
    const { store } = fakeStore();

    const id = await addJobTo(store, "pending", prospect("First"));

    expect((await readJobsFrom(store)).pending).toEqual([expect.objectContaining({ id, role: "First" })]);
  });

  // O — One
  it("puts a new job at the front of its section, like the board's unshift", async () => {
    const { store } = seeded({ prospect: [prospect("Old")] });

    await addJobTo(store, "prospect", prospect("New"));

    expect((await readJobsFrom(store)).prospect.map((j) => j.role)).toEqual(["New", "Old"]);
  });

  // B — Boundary: the whole point of the slice
  it("inserts exactly one row and touches no other", async () => {
    const { store, writes } = seeded({ prospect: [prospect("Old")] });

    const id = await addJobTo(store, "prospect", prospect("New"));

    expect(writes).toEqual([{ op: "insert", ids: [id] }]);
  });
});

describe("getJobIn", () => {
  // O — One
  it("finds a job by id wherever it is", async () => {
    const { store, rows } = seeded({ passed: [prospect("Target")] });
    const id = [...rows.keys()][0];

    expect((await getJobIn(store, { id }))?.section).toBe("passed");
  });

  // M — Many: id wins, so two jobs with the same company and role stay distinguishable
  it("tells apart two jobs with the same company and role when given an id", async () => {
    const { store, rows } = seeded({ prospect: [prospect("Dup"), prospect("Dup")] });
    const [first, second] = [...rows.keys()];

    expect((await getJobIn(store, { id: second }))?.id).toBe(second);
    expect((await getJobIn(store, { id: first }))?.id).toBe(first);
  });

  // I — Interface: JSON-era callers only know section + company + role
  it("falls back to section, company and role when there is no id", async () => {
    const { store } = seeded({ prospect: [prospect("A"), prospect("B")] });

    const found = await getJobIn(store, { section: "prospect", company: "Acme", role: "B" });

    expect(found?.job.role).toBe("B");
  });

  // E — Exception
  it("returns undefined for an unknown id or a deleted job", async () => {
    const { store, rows } = seeded({ prospect: [prospect("Gone")] });
    const id = [...rows.keys()][0];
    await archiveJobIn(store, { id });

    expect(await getJobIn(store, { id })).toBeUndefined();
    expect(await getJobIn(store, { id: "nope" })).toBeUndefined();
  });
});

describe("saveJobIn", () => {
  it("updates one row in place and writes nothing else", async () => {
    const { store, rows, writes } = seeded({ prospect: [prospect("A"), prospect("B")] });
    const id = [...rows.keys()][0];
    const found = (await getJobIn(store, { id }))!;

    await saveJobIn(store, { id }, { section: found.section, job: { ...found.job, notes: "edited" } });

    expect(writes).toEqual([{ op: "update", ids: [id] }]);
    expect((await readJobsFrom(store)).prospect.map((j) => [j.role, j.notes])).toEqual([["A", "edited"], ["B", ""]]);
  });

  it("moves a job to the front of another section and keeps its id", async () => {
    const { store, rows } = seeded({ prospect: [prospect("Mover")], passed: [prospect("Already")] });
    const id = [...rows.keys()][0];
    const found = (await getJobIn(store, { id }))!;

    await saveJobIn(store, { id }, { section: "passed", job: found.job });

    const board = await readJobsFrom(store);
    expect(board.prospect).toEqual([]);
    expect(board.passed.map((j) => [j.role, j.id])).toEqual([["Mover", id], ["Already", expect.any(String)]]);
  });

  // E — Exception
  it("returns false and writes nothing when the job does not exist", async () => {
    const { store, writes } = fakeStore();

    const saved = await saveJobIn(store, { id: "nope" }, { section: "prospect", job: prospect("X") });

    expect(saved).toBe(false);
    expect(writes).toEqual([]);
  });
});

describe("archiveJobIn", () => {
  it("soft-deletes just that row and never removes it from the table", async () => {
    const { store, rows, deleted, writes } = seeded({ prospect: [prospect("Keep"), prospect("Drop")] });
    const [keepId, dropId] = [...rows.keys()];

    const archived = await archiveJobIn(store, { id: dropId });

    expect(archived).toBe(true);
    expect(writes).toEqual([{ op: "softDelete", ids: [dropId] }]);
    expect(rows.has(dropId)).toBe(true);
    expect(deleted).toEqual(new Set([dropId]));
    expect((await readJobsFrom(store)).prospect.map((j) => j.id)).toEqual([keepId]);
  });

  it("returns false for an unknown job", async () => {
    expect(await archiveJobIn(fakeStore().store, { id: "nope" })).toBe(false);
  });
});

describe("updateJobsIn", () => {
  const ref = (role: string) => ({ section: "applied" as const, company: "Acme", role });
  const applied = (role: string) => ({ ...prospect(role), status: "applied" as const, date: "2026-01-01" });

  // O — One
  it("merges the updates into each matching job", async () => {
    const { store } = seeded({ applied: [applied("A"), applied("B")] });

    const result = await updateJobsIn(store, { targets: [ref("A"), ref("B")], updates: { status: "declined" } });

    expect(result).toEqual({ updated: 2, notFound: [] });
    expect((await readJobsFrom(store)).applied.map((j) => (j as { status: string }).status)).toEqual(["declined", "declined"]);
  });

  // B — Boundary: 26 jobs must not mean 26 writes
  it("writes every changed row in a single update and leaves other rows alone", async () => {
    const { store, rows, writes } = seeded({ applied: [applied("A"), applied("B"), applied("C")] });
    const [a, b] = [...rows.keys()];

    await updateJobsIn(store, { targets: [ref("A"), ref("B")], updates: { notes: "x" } });

    expect(writes).toEqual([{ op: "update", ids: [a, b] }]);
  });

  // E — Exception
  it("reports the targets it could not find and still updates the rest", async () => {
    const { store } = seeded({ applied: [applied("A")] });

    const result = await updateJobsIn(store, { targets: [ref("A"), ref("Missing")], updates: { notes: "x" } });

    expect(result).toEqual({ updated: 1, notFound: [ref("Missing")] });
  });

  it("writes nothing when no target matches", async () => {
    const { store, writes } = seeded({ applied: [applied("A")] });

    await updateJobsIn(store, { targets: [ref("Missing")], updates: { notes: "x" } });

    expect(writes).toEqual([]);
  });
});

describe("patchJobsIn", () => {
  const pending = (role: string) => ({ company: "Acme", role, url: "", salary: "", notes: "", scrapeGroup: "remote" as const, scrapeDate: "2026-01-01" });
  const ref = (role: string) => ({ section: "pending" as const, company: "Acme", role });

  // O — One / M — Many: each job gets its own updates
  it("applies different updates to different jobs in one row write", async () => {
    const { store, rows, writes } = seeded({ pending: [pending("A"), pending("B")] });
    const ids = [...rows.keys()];

    const result = await patchJobsIn(store, [
      { target: ref("A"), updates: { fit: "strong" } },
      { target: ref("B"), updates: { fit: "weak" } },
    ]);

    expect(result).toEqual({ updated: 2, notFound: [] });
    expect(writes).toEqual([{ op: "update", ids }]);
    expect((await readJobsFrom(store)).pending.map((j) => (j as { fit?: string }).fit)).toEqual(["strong", "weak"]);
  });

  // B — Boundary: patching by id survives an edit made while the caller was busy (slow AI scoring)
  it("keeps fields changed since the caller last read, touching only the patched ones", async () => {
    const { store, rows } = seeded({ pending: [pending("A")] });
    const id = [...rows.keys()][0];
    rows.set(id, { ...rows.get(id)!, notes: "edited meanwhile" });

    await patchJobsIn(store, [{ target: { id }, updates: { fit: "good" } }]);

    expect((await readJobsFrom(store)).pending[0]).toMatchObject({ notes: "edited meanwhile", fit: "good" });
  });

  // E — Exception
  it("reports unknown targets and writes nothing when none match", async () => {
    const { store, writes } = seeded({ pending: [pending("A")] });

    const result = await patchJobsIn(store, [{ target: ref("Nope"), updates: { fit: "good" } }]);

    expect(result).toEqual({ updated: 0, notFound: [ref("Nope")] });
    expect(writes).toEqual([]);
  });

  it("does nothing for an empty list", async () => {
    const { store, writes } = seeded({});

    expect(await patchJobsIn(store, [])).toEqual({ updated: 0, notFound: [] });
    expect(writes).toEqual([]);
  });
});
