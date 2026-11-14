import type { JobRow } from "@/lib/jobs-mapping";
import type { JobRowStore } from "@/lib/supabase-jobs";

/** In-memory jobs table with soft delete and duplicate lookup, like the real one. `rows` keeps archived rows. */
export function fakeJobStore(initial: JobRow[] = []): { store: JobRowStore; rows: Map<string, JobRow>; deleted: Set<string> } {
  const rows = new Map(initial.map((r) => [r.id, r]));
  const deleted = new Set<string>();
  const store: JobRowStore = {
    selectAll: async () => [...rows.values()].filter((r) => !deleted.has(r.id)),
    insert: async (batch) => batch.forEach((r) => rows.set(r.id, r)),
    update: async (batch) => batch.forEach((r) => rows.set(r.id, r)),
    softDelete: async (ids) => ids.forEach((id) => deleted.add(id)),
    findExisting: async ({ url, company, role }) =>
      [...rows.values()]
        .filter((r) => (url !== "" && r.url === url) || (r.company === company && r.role === role))
        .map((r) => ({ id: r.id, section: r.section, deleted: deleted.has(r.id) })),
  };
  return { store, rows, deleted };
}
