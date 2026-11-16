import type { AppliedJob, JobFit, JobSection, JobStatus, JobType, PassedJob, ProspectJob } from "@/lib/jobs";
import { resolveJobType } from "@/lib/jobs";
import { getAppliedIcon, getProspectIcon, getSignalLabel, iconSortKey } from "@/lib/job-signal";

export type BoardSection = "applied" | "prospect" | "local" | "staffing" | "passed";

/** One shape for every job in a list, so applied, prospect and passed rows render and sort the same way. */
export interface BoardRow {
  key: string;
  id?: string;
  section: BoardSection;
  company: string;
  role: string;
  url: string;
  salary: string;
  date?: string;
  summary?: string;
  rationale?: string;
  fit?: JobFit;
  status?: JobStatus;
  type?: JobType;
  isNew?: boolean;
  /** Only "Stale" or "Ghost job": every other state is already said by status and fit. */
  attention?: string;
  signalSort: string;
  job: AppliedJob | ProspectJob | PassedJob;
}

const ATTENTION = new Set(["Stale", "Ghost job"]);
const rowKey = (job: { id?: string; company: string; role: string }, section: string) => job.id ?? `${section}|${job.company}|${job.role}`;

export function appliedRow(job: AppliedJob): BoardRow {
  const icon = getAppliedIcon(job);
  const label = getSignalLabel(icon, "applied");
  return {
    key: rowKey(job, "applied"), id: job.id, section: "applied", company: job.company, role: job.role, url: job.url, salary: job.salary, date: job.date,
    summary: job.aiSummary || job.notes, status: job.status, type: resolveJobType("applied", job),
    attention: ATTENTION.has(label) ? label : undefined, signalSort: iconSortKey(icon), job,
  };
}

export function prospectRow(job: ProspectJob, section: "prospect" | "local" | "staffing"): BoardRow {
  return {
    key: rowKey(job, section), id: job.id, section, company: job.company, role: job.role, url: job.url, salary: job.salary,
    summary: job.aiSummary || job.notes, rationale: job.scoreRationale, fit: job.fit, type: resolveJobType(section, job), isNew: job.isNew,
    signalSort: iconSortKey(getProspectIcon(job)), job,
  };
}

export function passedRow(job: PassedJob): BoardRow {
  return { key: rowKey(job, "passed"), id: job.id, section: "passed", company: job.company, role: job.role, url: job.url, salary: job.salary, summary: job.aiSummary || job.notes, signalSort: "4", job };
}

export const asJobSection = (section: BoardSection): JobSection => section;
