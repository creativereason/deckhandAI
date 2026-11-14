import type { JobSection } from "@/lib/jobs";

/** What an agent sees for a job: its fields plus its id and section. */
export function agentJobView(found: { id: string; section: JobSection; job: Record<string, unknown> }): Record<string, unknown> {
  return { ...found.job, id: found.id, section: found.section };
}
