// Single-row job operations over a JobRowStore. Unlike readJobs/writeJobs (read the
// whole board, mutate, diff, write back) each operation reads to find its target but
// writes only that row, so two overlapping writers can no longer drop each other's jobs.
import type { JobSection } from "@/lib/jobs";
import { jobToRow, rowsToJobsData, type JobRow } from "@/lib/jobs-mapping";
import type { JobRowStore } from "@/lib/supabase-jobs";

type Job = Record<string, unknown>;

/** Identify a job by id, or by section + company + role for callers that predate ids. */
export interface JobRef {
  id?: string;
  section?: JobSection;
  company?: string;
  role?: string;
}

export interface FoundJob {
  id: string;
  section: JobSection;
  job: Job;
}

function matches(row: JobRow, ref: JobRef): boolean {
  if (ref.id) return row.id === ref.id;
  return row.section === ref.section && row.company === ref.company && row.role === ref.role;
}

function toJob(row: JobRow): Job {
  const board = rowsToJobsData([row]) as unknown as Record<JobSection, Job[]>;
  return board[row.section][0];
}

function frontPosition(rows: JobRow[], section: JobSection): number {
  const positions = rows.filter((r) => r.section === section).map((r) => r.position);
  return positions.length ? Math.min(...positions) - 1 : 0;
}

export async function getJobIn(store: JobRowStore, ref: JobRef): Promise<FoundJob | undefined> {
  const row = (await store.selectAll()).find((r) => matches(r, ref));
  return row && { id: row.id, section: row.section, job: toJob(row) };
}

/** Adds at the front of the section (the board's unshift) and returns the new id. */
export async function addJobTo(store: JobRowStore, section: JobSection, job: Job): Promise<string> {
  const position = frontPosition(await store.selectAll(), section);
  const row = jobToRow(section, job, { position, newId: () => crypto.randomUUID() });
  await store.insert([row]);
  return row.id;
}

/**
 * Replaces one job's fields, keeping its id. A section change moves it to the front
 * of the new section. Returns false when the job does not exist.
 */
export async function saveJobIn(store: JobRowStore, ref: JobRef, next: { section: JobSection; job: Job }): Promise<boolean> {
  const rows = await store.selectAll();
  const current = rows.find((r) => matches(r, ref));
  if (!current) return false;
  const moved = next.section !== current.section;
  const position = moved ? frontPosition(rows, next.section) : current.position;
  const row = jobToRow(next.section, { ...next.job, id: current.id }, { position, newId: () => current.id });
  await store.update([row]);
  return true;
}

/** Soft-deletes one job. Returns false when it does not exist. */
export async function archiveJobIn(store: JobRowStore, ref: JobRef): Promise<boolean> {
  const row = (await store.selectAll()).find((r) => matches(r, ref));
  if (!row) return false;
  await store.softDelete([row.id]);
  return true;
}
