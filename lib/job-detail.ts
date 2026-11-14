// Pure helpers for the job detail page's URL, shared by the board, the chat and the
// page itself. Kept free of server imports so client components can use it.
import type { JobIdentity, JobSection } from "@/lib/jobs";

export interface JobDetailTarget extends JobIdentity {
  section: JobSection | string;
}

export function jobDetailHref({ section, company, role, id }: JobDetailTarget): string {
  const params = new URLSearchParams({ section, company, role });
  if (id) params.set("id", id);
  return `/job?${params.toString()}`;
}

/**
 * The id wins and is exact: a stale id returns nothing rather than quietly opening a
 * different job with the same company and role. Links without an id (older links,
 * JSON-backed boards) match on company + role.
 */
export function findJobForDetail<T extends { id?: string; company: string; role: string }>(
  list: T[],
  target: JobIdentity,
): T | undefined {
  if (target.id) return list.find((job) => job.id === target.id);
  return list.find((job) => job.company === target.company && job.role === target.role);
}
