import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { jobsDataToRows } from "@/lib/jobs-mapping";
import { createJobRowStore } from "@/lib/supabase-row-store";

const job = (role: string) => ({ company: "A", role, fit: "good" as const, salary: "", notes: "", url: "" });
const manyRows = (n: number) =>
  jobsDataToRows({ applied: [], prospect: Array.from({ length: n }, (_, i) => job(`r${i}`)), local: [], staffing: [], passed: [], pending: [] });

function clientWith(result: { data?: unknown; error: { message: string } | null }) {
  const insert = vi.fn().mockResolvedValue(result);
  const query = { limit: vi.fn().mockResolvedValue(result) };
  const client = { from: () => ({ insert, select: () => query }) } as unknown as SupabaseClient;
  return { client, insert };
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

  // Z — Zero
  it("returns an empty list when the table has no rows", async () => {
    const { client } = clientWith({ data: null, error: null });

    expect(await createJobRowStore(client).selectAll()).toEqual([]);
  });
});
