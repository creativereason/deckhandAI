// Pure mapping between the jobs.json shape (six arrays) and rows of the
// `jobs` table (one row per job, `section` column). No I/O, so the importer
// and the Supabase repository share it and it is fully unit-testable.
import type { JobSection, JobsData } from "@/lib/jobs";

export interface JobRow {
  id: string;
  section: JobSection;
  company: string;
  role: string;
  url: string;
  salary: string;
  notes: string;
  ai_summary: string | null;
  score_rationale: string | null;
  status: string | null;
  fit: string | null;
  type: string | null;
  applied_date: string | null;
  is_new: boolean;
  is_ghost: boolean;
  scrape_group: string | null;
  scrape_date: string | null;
  position: number;
  extra: Record<string, unknown>;
}

export const SECTIONS: JobSection[] = ["applied", "prospect", "local", "staffing", "passed", "pending"];

type Fields = Record<string, unknown>;
type IdFactory = () => string;

const REQUIRED_TEXT: [string, keyof JobRow][] = [
  ["company", "company"], ["role", "role"], ["url", "url"], ["salary", "salary"], ["notes", "notes"],
];
const OPTIONAL_TEXT: [string, keyof JobRow][] = [
  ["aiSummary", "ai_summary"], ["scoreRationale", "score_rationale"],
];
const ENUMS: [string, keyof JobRow, string[]][] = [
  ["status", "status", ["applied", "screening", "interview", "offer", "declined"]],
  ["fit", "fit", ["strong", "good", "caution", "weak"]],
  ["type", "type", ["remote", "hybrid", "local", "contract"]],
  ["scrapeGroup", "scrape_group", ["remote", "local"]],
];
const DATES: [string, keyof JobRow][] = [["date", "applied_date"], ["scrapeDate", "scrape_date"]];
const FLAGS: [string, keyof JobRow][] = [["isNew", "is_new"], ["isGhost", "is_ghost"]];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Moves `key` from `rest` into `row[column]` only when `accept` approves the value. */
function claim(rest: Fields, row: Fields, spec: { key: string; column: string; accept: (v: unknown) => boolean }) {
  if (!spec.accept(rest[spec.key])) return;
  row[spec.column] = rest[spec.key];
  delete rest[spec.key];
}

function toRowFields(rest: Fields): Fields {
  const row: Fields = { is_new: false, is_ghost: false };
  for (const [key, column] of REQUIRED_TEXT) {
    row[column] = "";
    claim(rest, row, { key, column, accept: (v) => typeof v === "string" });
  }
  for (const [key, column] of OPTIONAL_TEXT) {
    row[column] = null;
    claim(rest, row, { key, column, accept: (v) => typeof v === "string" });
  }
  for (const [key, column, allowed] of ENUMS) {
    row[column] = null;
    claim(rest, row, { key, column, accept: (v) => typeof v === "string" && allowed.includes(v) });
  }
  for (const [key, column] of DATES) {
    row[column] = null;
    claim(rest, row, { key, column, accept: (v) => typeof v === "string" && ISO_DATE.test(v) });
  }
  for (const [key, column] of FLAGS) {
    claim(rest, row, { key, column, accept: (v) => typeof v === "boolean" });
  }
  return row;
}

export function jobToRow(section: JobSection, job: Fields, ctx: { position: number; newId: IdFactory }): JobRow {
  const { id, ...rest } = job;
  const fields = toRowFields(rest);
  const rowId = typeof id === "string" && id ? id : ctx.newId();
  return { ...fields, id: rowId, section, position: ctx.position, extra: rest } as unknown as JobRow;
}

// Legacy files may omit a section or hold a non-array; treat both as empty.
function asList(value: unknown): Fields[] {
  return Array.isArray(value) ? (value as Fields[]) : [];
}

export function jobsDataToRows(data: JobsData, newId: IdFactory = () => crypto.randomUUID()): JobRow[] {
  return SECTIONS.flatMap((section) =>
    asList(data[section]).map((job, position) => jobToRow(section, job, { position, newId })),
  );
}

function rowToJob(row: JobRow): Fields {
  const job: Fields = { ...row.extra, id: row.id };
  const columns = row as unknown as Fields;
  for (const [key, column] of [...REQUIRED_TEXT, ...OPTIONAL_TEXT, ...ENUMS, ...DATES]) {
    if (columns[column as string] !== null) job[key] = columns[column as string];
  }
  for (const [key, column] of FLAGS) {
    if (columns[column as string] === true) job[key] = true;
  }
  return job;
}

export function rowsToJobsData(rows: JobRow[]): JobsData {
  const data: Record<string, Fields[]> = Object.fromEntries(SECTIONS.map((s) => [s, []]));
  const ordered = [...rows].sort((a, b) => a.position - b.position);
  for (const row of ordered) data[row.section].push(rowToJob(row));
  return data as unknown as JobsData;
}

export interface RowDiff {
  inserts: JobRow[];
  updates: JobRow[];
  deleteIds: string[];
}

/** Compares stored rows with the desired rows so a write only touches what changed. */
export function diffRows(existing: JobRow[], next: JobRow[]): RowDiff {
  const stored = new Map(existing.map((row) => [row.id, row]));
  const wanted = new Set(next.map((row) => row.id));
  return {
    inserts: next.filter((row) => !stored.has(row.id)),
    updates: next.filter((row) => stored.has(row.id) && !sameRow(stored.get(row.id)!, row)),
    deleteIds: existing.filter((row) => !wanted.has(row.id)).map((row) => row.id),
  };
}

function sameRow(a: JobRow, b: JobRow): boolean {
  return canonicalJson(a) === canonicalJson(b);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonical(value));
}

// Key order must not matter, so serialise with sorted keys (extra included).
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]),
  );
}
