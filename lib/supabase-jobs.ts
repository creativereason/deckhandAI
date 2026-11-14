import type { JobSection, JobsData } from "@/lib/jobs";
import { diffRows, jobsDataToRows, rowsToJobsData, type JobRow } from "@/lib/jobs-mapping";

/** A job that already exists, found by URL or by company + role, deleted or not. */
export interface ExistingJob {
  id: string;
  section: JobSection;
  deleted: boolean;
}

/** The row operations the jobs repository needs; keeps the logic testable without a database. */
export interface JobRowStore {
  /** Live rows only: soft-deleted rows are never returned. */
  selectAll(): Promise<JobRow[]>;
  insert(rows: JobRow[]): Promise<void>;
  update(rows: JobRow[]): Promise<void>;
  /** Marks rows deleted. Rows are never physically removed. */
  softDelete(ids: string[]): Promise<void>;
  /** Rows matching by URL (when there is one) or by company + role. Unlike selectAll, includes soft-deleted rows. */
  findExisting(candidate: { url: string; company: string; role: string }): Promise<ExistingJob[]>;
}

export async function readJobsFrom(store: JobRowStore): Promise<JobsData> {
  return rowsToJobsData(await store.selectAll());
}

/**
 * Callers still read the whole board, mutate it and write it back. Diffing
 * against the stored rows turns that into row-level inserts, updates and
 * soft-deletes, so unchanged rows are untouched and a moved job keeps its id.
 */
export async function writeJobsTo(store: JobRowStore, data: JobsData): Promise<void> {
  const { inserts, updates, deleteIds } = diffRows(await store.selectAll(), jobsDataToRows(data));
  if (inserts.length) await store.insert(inserts);
  if (updates.length) await store.update(updates);
  if (deleteIds.length) await store.softDelete(deleteIds);
}
