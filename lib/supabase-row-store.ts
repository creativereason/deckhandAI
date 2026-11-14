import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobRow } from "@/lib/jobs-mapping";
import type { ExistingJob, JobRowStore } from "@/lib/supabase-jobs";

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

interface MatchRow {
  id: string;
  section: ExistingJob["section"];
  deleted_at: string | null;
}

/** The same row can match by URL and by company + role; report it once. */
function asExisting(rows: MatchRow[]): ExistingJob[] {
  const unique = new Map(rows.map((row) => [row.id, { id: row.id, section: row.section, deleted: row.deleted_at !== null }]));
  return [...unique.values()];
}

/** Who is writing: "user", "scraper", or an agent's name. Recorded in job_events by a database trigger. */
export type Actor = string;

/** Tags each row with the actor; the trigger reads `last_actor` and clears it, so it never goes stale. */
function stamped(rows: JobRow[], actor: Actor): (JobRow & { last_actor: Actor })[] {
  return rows.map((row) => ({ ...row, last_actor: actor }));
}

export function createJobRowStore(client: SupabaseClient, actor: Actor = "user"): JobRowStore {
  return {
    // Writes diff against this result, so a truncated read would delete the
    // missing rows. Read until a page comes back empty (robust to a lower server cap).
    async selectAll() {
      const rows: JobRow[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await client
          .from("jobs").select(COLUMNS).is("deleted_at", null).order("id").range(from, from + PAGE_SIZE - 1);
        check(error, "select");
        if (!data?.length) return rows;
        rows.push(...(data as unknown as JobRow[]));
      }
    },
    // Two plain equality queries, never a composed `or()` filter: company, role and URL
    // come from agents, and PostgREST filter strings would let a crafted value change the query.
    async findExisting({ url, company, role }) {
      const byKey = client.from("jobs").select("id, section, deleted_at").eq("company", company).eq("role", role);
      const byUrl = url ? client.from("jobs").select("id, section, deleted_at").eq("url", url) : undefined;
      const [key, link] = await Promise.all([byKey, byUrl]);
      check(key.error, "find");
      check(link?.error ?? null, "find");
      return asExisting([...(key.data ?? []), ...(link?.data ?? [])] as MatchRow[]);
    },
    async insert(rows) {
      for (const batch of batches(stamped(rows, actor))) check((await client.from("jobs").insert(batch)).error, "insert");
    },
    // Upsert on id with `source`/`legacy_key` absent from the payload leaves those columns untouched.
    async update(rows) {
      for (const batch of batches(stamped(rows, actor))) {
        check((await client.from("jobs").upsert(batch, { onConflict: "id" })).error, "update");
      }
    },
    // The service role has no DELETE privilege on jobs (see the soft-delete migration).
    async softDelete(ids) {
      const deletedAt = new Date().toISOString();
      for (const batch of batches(ids)) {
        check((await client.from("jobs").update({ deleted_at: deletedAt, last_actor: actor }).in("id", batch)).error, "delete");
      }
    },
  };
}
