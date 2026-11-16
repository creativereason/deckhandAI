// Which application statuses the Applied view hides. Pure, so the board, its saved
// preference and the tests share one rule. Hiding is display only: nothing is changed or removed.
import type { JobStatus } from "@/lib/jobs";

export const APPLIED_STATUSES: readonly JobStatus[] = ["applied", "screening", "interview", "offer", "declined"];

/** Declined applications are history, not work in progress, so they start out of the way. */
export const DEFAULT_HIDDEN_STATUSES: readonly JobStatus[] = ["declined"];

const isStatus = (value: unknown): value is JobStatus => APPLIED_STATUSES.includes(value as JobStatus);

/** A job with a missing or unknown status is never hidden: the filter must not lose legacy rows. */
export function filterByStatus<T extends { status: JobStatus }>(jobs: T[], hidden: ReadonlySet<JobStatus>): T[] {
  return jobs.filter((job) => !hidden.has(job.status));
}

export function statusCounts(jobs: { status: JobStatus }[]): Record<JobStatus, number> {
  const counts = Object.fromEntries(APPLIED_STATUSES.map((s) => [s, 0])) as Record<JobStatus, number>;
  for (const { status } of jobs) if (isStatus(status)) counts[status] += 1;
  return counts;
}

export function toggleStatus(hidden: ReadonlySet<JobStatus>, status: JobStatus): Set<JobStatus> {
  const next = new Set(hidden);
  if (next.has(status)) next.delete(status);
  else next.add(status);
  return next;
}

/** Reads a saved choice. Anything that is not a list falls back to the default; unknown entries are dropped. */
export function parseHiddenStatuses(saved: unknown): JobStatus[] {
  return Array.isArray(saved) ? saved.filter(isStatus) : [...DEFAULT_HIDDEN_STATUSES];
}
