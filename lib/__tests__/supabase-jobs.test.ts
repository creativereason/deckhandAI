import { describe, expect, it } from "vitest";
import type { JobsData } from "@/lib/jobs";
import { jobsDataToRows, type JobRow } from "@/lib/jobs-mapping";
import { readJobsFrom, writeJobsTo, type JobRowStore } from "@/lib/supabase-jobs";

const EMPTY: JobsData = { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };
const prospect = (role: string) => ({ company: "Acme", role, fit: "good" as const, salary: "", notes: "", url: "" });

/** In-memory stand-in for the jobs table; records which operations ran. */
function fakeStore(initial: JobRow[] = []): JobRowStore & { rows: Map<string, JobRow>; calls: string[] } {
  const rows = new Map(initial.map((r) => [r.id, r]));
  const calls: string[] = [];
  return {
    rows,
    calls,
    selectAll: async () => [...rows.values()],
    insert: async (batch) => { calls.push("insert"); batch.forEach((r) => rows.set(r.id, r)); },
    update: async (batch) => { calls.push("update"); batch.forEach((r) => rows.set(r.id, r)); },
    remove: async (ids) => { calls.push("remove"); ids.forEach((id) => rows.delete(id)); },
  };
}

describe("readJobsFrom", () => {
  // Z — Zero
  it("returns an empty board when the table has no rows", async () => {
    expect(await readJobsFrom(fakeStore())).toEqual(EMPTY);
  });
});

describe("writeJobsTo", () => {
  // O — One
  it("inserts a job that is not yet stored and gives it an id", async () => {
    const store = fakeStore();

    await writeJobsTo(store, { ...EMPTY, prospect: [prospect("New")] });

    const board = await readJobsFrom(store);
    expect(board.prospect).toEqual([expect.objectContaining({ role: "New", id: expect.any(String) })]);
  });

  // B — Boundary: read-modify-write round trip must be a no-op for the database
  it("performs no operations when the board is written back unchanged", async () => {
    const store = fakeStore(jobsDataToRows({ ...EMPTY, prospect: [prospect("Same")] }));
    const board = await readJobsFrom(store);

    await writeJobsTo(store, board);

    expect(store.calls).toEqual([]);
  });

  // M — Many: the shape every existing route produces — edit, move, delete in one write
  it("applies an edit, a move and a delete made on the board read earlier", async () => {
    const store = fakeStore(jobsDataToRows({ ...EMPTY, prospect: [prospect("Edit"), prospect("Move"), prospect("Drop")] }));
    const board = await readJobsFrom(store);
    const [edit, move] = board.prospect;

    await writeJobsTo(store, {
      ...board,
      prospect: [{ ...edit, notes: "edited" }],
      applied: [{ ...move, status: "applied", date: "2026-01-02" } as never],
    });

    const after = await readJobsFrom(store);
    expect(after.prospect.map((j) => [j.role, j.notes])).toEqual([["Edit", "edited"]]);
    expect(after.applied.map((j) => j.role)).toEqual(["Move"]);
    expect(store.rows.size).toBe(2);
  });

  // B — Boundary: a moved job keeps its identity (no delete+insert)
  it("keeps the same id when a job moves between sections", async () => {
    const store = fakeStore(jobsDataToRows({ ...EMPTY, prospect: [prospect("Move")] }));
    const board = await readJobsFrom(store);
    const originalId = board.prospect[0].id;

    await writeJobsTo(store, { ...EMPTY, passed: board.prospect as never });

    expect((await readJobsFrom(store)).passed[0].id).toBe(originalId);
  });
});
