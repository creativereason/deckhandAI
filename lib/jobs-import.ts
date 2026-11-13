// Pure planning for the jobs.json -> Supabase import. scripts/migrate-to-supabase.ts
// does the I/O; everything decidable without a network lives here so it is testable.
import { jobKey, type JobSection, type JobsData } from "@/lib/jobs";
import { jobsDataToRows, SECTIONS, type JobRow } from "@/lib/jobs-mapping";

export type ImportRow = Omit<JobRow, "id"> & { source: "import"; legacy_key: string };

export interface ImportReport {
  counts: Record<JobSection, number>;
  /** company::role pairs that occur more than once in the same section. */
  duplicates: string[];
  /** Fields the schema has no column for, with how many jobs carry each. */
  extraKeys: Record<string, number>;
}

/**
 * legacy_key = section::company::role::n, where n counts earlier jobs with the
 * same key in that section. Unlike an array index it survives jobs being added
 * above, so re-running the import upserts the same rows instead of duplicating.
 */
function legacyKeys(rows: JobRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const base = `${row.section}::${jobKey(row.company, row.role)}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}::${n}`;
  });
}

function buildReport(rows: JobRow[], keys: string[]): ImportReport {
  const counts = Object.fromEntries(SECTIONS.map((s) => [s, 0])) as Record<JobSection, number>;
  const extraKeys: Record<string, number> = {};
  for (const row of rows) {
    counts[row.section] += 1;
    for (const key of Object.keys(row.extra)) extraKeys[key] = (extraKeys[key] ?? 0) + 1;
  }
  const duplicates = keys.filter((k) => k.endsWith("::1")).map((k) => k.slice(0, -"::1".length));
  return { counts, duplicates, extraKeys };
}

export function planImport(data: JobsData): { rows: ImportRow[]; report: ImportReport } {
  const mapped = jobsDataToRows(data, () => "");
  const keys = legacyKeys(mapped);
  const rows = mapped.map(({ id: _id, ...row }, i) => ({ ...row, source: "import" as const, legacy_key: keys[i] }));
  return { rows, report: buildReport(mapped, keys) };
}
