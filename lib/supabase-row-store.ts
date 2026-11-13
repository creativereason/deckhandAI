import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobRow } from "@/lib/jobs-mapping";
import type { JobRowStore } from "@/lib/supabase-jobs";

const COLUMNS =
  "id, section, company, role, url, salary, notes, ai_summary, score_rationale, status, fit, type, " +
  "applied_date, is_new, is_ghost, scrape_group, scrape_date, position, extra";
const BATCH_SIZE = 500;
// Supabase caps a single response at 1000 rows by default, so reads must page.
const PAGE_SIZE = 1000;

function check(error: { message: string } | null, action: string): void {
  if (error) throw new Error(`Supabase ${action} failed: ${error.message}`);
}

function batches<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) out.push(items.slice(i, i + BATCH_SIZE));
  return out;
}

export function createJobRowStore(client: SupabaseClient): JobRowStore {
  return {
    // Writes diff against this result, so a truncated read would delete the
    // missing rows. Read until a page comes back empty (robust to a lower server cap).
    async selectAll() {
      const rows: JobRow[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await client.from("jobs").select(COLUMNS).order("id").range(from, from + PAGE_SIZE - 1);
        check(error, "select");
        if (!data?.length) return rows;
        rows.push(...(data as unknown as JobRow[]));
      }
    },
    async insert(rows) {
      for (const batch of batches(rows)) check((await client.from("jobs").insert(batch)).error, "insert");
    },
    // Upsert on id with `source`/`legacy_key` absent from the payload leaves those columns untouched.
    async update(rows) {
      for (const batch of batches(rows)) {
        check((await client.from("jobs").upsert(batch, { onConflict: "id" })).error, "update");
      }
    },
    async remove(ids) {
      for (const batch of batches(ids)) check((await client.from("jobs").delete().in("id", batch)).error, "delete");
    },
  };
}
