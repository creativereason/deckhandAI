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

/** Adds many jobs with one insert. The last job ends up first, as if each had been added in turn. */
export async function addJobsTo(store: JobRowStore, section: JobSection, jobs: Job[]): Promise<string[]> {
  if (!jobs.length) return [];
  const start = frontPosition(await store.selectAll(), section);
  const rows = jobs.map((job, i) => jobToRow(section, job, { position: start - i, newId: () => crypto.randomUUID() }));
  await store.insert(rows);
  return rows.map((row) => row.id);
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

export interface BatchUpdate {
  targets: JobRef[];
  updates: Job;
}

export interface JobPatch {
  target: JobRef;
  updates: Job;
}

export interface BatchResult {
  updated: number;
  notFound: JobRef[];
}

/**
 * Merges each patch's updates into its job, reading the stored job at write time, with
 * one read and one row write. Fields the caller did not name keep whatever is stored now,
 * so a slow caller (AI scoring) cannot overwrite an edit made while it was busy.
 * Section never changes.
 */
export async function patchJobsIn(store: JobRowStore, patches: JobPatch[]): Promise<BatchResult> {
  const rows = await store.selectAll();
  const changed: JobRow[] = [];
  const notFound: JobRef[] = [];
  for (const { target, updates } of patches) {
    const row = rows.find((r) => matches(r, target));
    if (!row) notFound.push(target);
    else changed.push(jobToRow(row.section, { ...toJob(row), ...updates, id: row.id }, { position: row.position, newId: () => row.id }));
  }
  if (changed.length) await store.update(changed);
  return { updated: changed.length, notFound };
}

/** The same updates for every target. */
export function updateJobsIn(store: JobRowStore, { targets, updates }: BatchUpdate): Promise<BatchResult> {
  return patchJobsIn(store, targets.map((target) => ({ target, updates })));
}
