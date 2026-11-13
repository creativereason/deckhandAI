import type { JobsData } from "@/lib/jobs";
import { diffRows, jobsDataToRows, rowsToJobsData, type JobRow } from "@/lib/jobs-mapping";

/** The four row operations the jobs repository needs; keeps the logic testable without a database. */
export interface JobRowStore {
  selectAll(): Promise<JobRow[]>;
  insert(rows: JobRow[]): Promise<void>;
  update(rows: JobRow[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
}

export async function readJobsFrom(store: JobRowStore): Promise<JobsData> {
  return rowsToJobsData(await store.selectAll());
}

/**
 * Callers still read the whole board, mutate it and write it back. Diffing
 * against the stored rows turns that into row-level inserts, updates and
 * deletes, so unchanged rows are untouched and a moved job keeps its id.
 */
export async function writeJobsTo(store: JobRowStore, data: JobsData): Promise<void> {
  const { inserts, updates, deleteIds } = diffRows(await store.selectAll(), jobsDataToRows(data));
  if (inserts.length) await store.insert(inserts);
  if (updates.length) await store.update(updates);
  if (deleteIds.length) await store.remove(deleteIds);
}
