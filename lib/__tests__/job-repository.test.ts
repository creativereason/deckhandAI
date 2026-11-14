import { describe, expect, it } from "vitest";
import { createJsonRepository, createSupabaseRepository } from "@/lib/job-repository";
import { jobsDataToRows, type JobRow } from "@/lib/jobs-mapping";
import type { JobsData } from "@/lib/jobs";
import type { JobRowStore } from "@/lib/supabase-jobs";
import { describeJobRepositoryContract } from "./helpers/job-repository-contract";

const EMPTY: JobsData = { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };

/** In-memory jobs table with soft delete, like the real one. */
function fakeStore(): { store: JobRowStore; load(rows: JobRow[]): void } {
  const rows = new Map<string, JobRow>();
  const deleted = new Set<string>();
  const store: JobRowStore = {
    selectAll: async () => [...rows.values()].filter((r) => !deleted.has(r.id)),
    insert: async (batch) => batch.forEach((r) => rows.set(r.id, r)),
    update: async (batch) => batch.forEach((r) => rows.set(r.id, r)),
    softDelete: async (ids) => ids.forEach((id) => deleted.add(id)),
  };
  return { store, load: (initial) => initial.forEach((r) => rows.set(r.id, r)) };
}

describeJobRepositoryContract("supabase rows", () => {
  const { store, load } = fakeStore();
  return {
    repo: createSupabaseRepository(store),
    seed: async (board) => load(jobsDataToRows({ ...EMPTY, ...board })),
  };
});

describeJobRepositoryContract("JSON file", () => {
  let board: JobsData = structuredClone(EMPTY);
  return {
    repo: createJsonRepository({ read: async () => structuredClone(board), write: async (next) => { board = structuredClone(next); } }),
    seed: async (initial) => { board = { ...structuredClone(EMPTY), ...structuredClone(initial) }; },
  };
});

describe("JobRepository by id (Supabase rows only)", () => {
  // The JSON file has no ids, so these cannot be part of the shared contract.
  it("returns the new row's id from add, and finds the job by it", async () => {
    const { store } = fakeStore();
    const repo = createSupabaseRepository(store);

    const id = await repo.add("prospect", { company: "Acme", role: "A", salary: "", notes: "", url: "" });

    expect(id).toEqual(expect.any(String));
    expect((await repo.get({ id: id! }))?.job.role).toBe("A");
  });

  it("returns no id from add on the JSON backend", async () => {
    const repo = createJsonRepository({ read: async () => structuredClone(EMPTY), write: async () => {} });

    expect(await repo.add("prospect", { company: "Acme", role: "A" })).toBeUndefined();
  });
});
