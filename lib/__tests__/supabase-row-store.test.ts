import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { jobsDataToRows } from "@/lib/jobs-mapping";
import { createJobRowStore } from "@/lib/supabase-row-store";

const job = (role: string) => ({ company: "A", role, fit: "good" as const, salary: "", notes: "", url: "" });
const manyRows = (n: number) =>
  jobsDataToRows({ applied: [], prospect: Array.from({ length: n }, (_, i) => job(`r${i}`)), local: [], staffing: [], passed: [], pending: [] });

function clientWith(result: { data?: unknown; error: { message: string } | null }) {
  const insert = vi.fn().mockResolvedValue(result);
  const range = vi.fn().mockResolvedValue(result);
  const isFilter = vi.fn(() => ({ order: () => ({ range }) }));
  const inFilter = vi.fn().mockResolvedValue(result);
  const update = vi.fn(() => ({ in: inFilter }));
  const hardDelete = vi.fn();
  const client = {
    from: () => ({ insert, update, delete: hardDelete, select: () => ({ is: isFilter }) }),
  } as unknown as SupabaseClient;
  return { client, insert, range, isFilter, update, inFilter, hardDelete };
}

describe("createJobRowStore", () => {
  // B — Boundary: PostgREST payloads are chunked, so 501 rows must become two inserts
  it("inserts in batches of 500", async () => {
    const { client, insert } = clientWith({ error: null });

    await createJobRowStore(client).insert(manyRows(501));

    expect(insert.mock.calls.map(([batch]) => batch.length)).toEqual([500, 1]);
  });

  // E — Exception: a failed write must throw so callers never assume it saved
  it("throws with the database message when an insert fails", async () => {
    const { client } = clientWith({ error: { message: "violates check constraint" } });

    await expect(createJobRowStore(client).insert(manyRows(1))).rejects.toThrow(/insert failed: violates check constraint/);
  });

  // E — Exception: a failed read must throw, never look like an empty table
  it("throws when the select fails", async () => {
    const { client } = clientWith({ error: { message: "timeout" } });

    await expect(createJobRowStore(client).selectAll()).rejects.toThrow(/select failed: timeout/);
  });

  // B — Boundary: deleted rows must not reach the board, or the next write would resurrect them
  it("reads only rows that are not marked deleted", async () => {
    const { client, isFilter } = clientWith({ data: [], error: null });

    await createJobRowStore(client).selectAll();

    expect(isFilter).toHaveBeenCalledWith("deleted_at", null);
  });

  // B — Boundary: "never delete" means the row stays; only a timestamp is set
  it("marks rows deleted with a timestamp and never issues a delete", async () => {
    const { client, update, inFilter, hardDelete } = clientWith({ error: null });

    await createJobRowStore(client).softDelete(["a", "b"]);

    expect(update).toHaveBeenCalledWith({ deleted_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) });
    expect(inFilter).toHaveBeenCalledWith("id", ["a", "b"]);
    expect(hardDelete).not.toHaveBeenCalled();
  });

  // E — Exception
  it("throws with the database message when marking rows deleted fails", async () => {
    const { client } = clientWith({ error: { message: "boom" } });

    await expect(createJobRowStore(client).softDelete(["a"])).rejects.toThrow(/delete failed: boom/);
  });

  // Z — Zero
  it("returns an empty list when the table has no rows", async () => {
    const { client } = clientWith({ data: null, error: null });

    expect(await createJobRowStore(client).selectAll()).toEqual([]);
  });

  // B — Boundary: Supabase caps a response at 1000 rows; a short read would look like deletions
  it("keeps reading pages until one comes back empty", async () => {
    const { client, range } = clientWith({ error: null });
    const page = (n: number) => ({ data: Array.from({ length: n }, (_, i) => ({ id: `${i}` })), error: null });
    range.mockResolvedValueOnce(page(1000)).mockResolvedValueOnce(page(3)).mockResolvedValueOnce(page(0));

    const rows = await createJobRowStore(client).selectAll();

    expect(rows).toHaveLength(1003);
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
});
