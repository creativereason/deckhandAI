export function jobKey(company: string, role: string): string {
  return `${company}::${role}`;
}

export type JobStatus = "applied" | "screening" | "interview" | "offer" | "declined";
export type JobFit = "strong" | "good" | "caution" | "weak";
export type JobType = "remote" | "hybrid" | "local" | "contract";
export type JobSection = "applied" | "prospect" | "local" | "staffing" | "passed" | "pending";

export interface AppliedJob {
  company: string;
  role: string;
  status: JobStatus;
  date: string;
  salary: string;
  notes: string;
  url: string;
  type?: JobType;
  isGhost?: boolean;
  /** AI-generated 1–2 sentence "at a glance" summary of the role and company (M14). */
  aiSummary?: string;
}

export interface ProspectJob {
  company: string;
  role: string;
  fit: JobFit;
  salary: string;
  notes: string;
  url: string;
  type?: JobType;
  isNew?: boolean;
  scoreRationale?: string;
  aiSummary?: string;
}

export interface PassedJob {
  company: string;
  role: string;
  salary: string;
  notes: string;
  url: string;
  type?: JobType;
  aiSummary?: string;
}

export interface PendingJob {
  company: string;
  role: string;
  url: string;
  salary: string;
  notes: string;
  scrapeGroup: "remote" | "local";
  scrapeDate: string;
  fit?: JobFit;
  scoreRationale?: string;
  aiSummary?: string;
}

export interface JobsData {
  applied: AppliedJob[];
  prospect: ProspectJob[];
  local: ProspectJob[];
  staffing: ProspectJob[];
  passed: PassedJob[];
  pending: PendingJob[];
}

type JobTypeSource = {
  type?: JobType;
  notes?: string;
  role?: string;
  salary?: string;
};

/** Resolve work arrangement when `type` is missing (legacy jobs.json). */
export function resolveJobType(section: JobSection, job: JobTypeSource): JobType {
  if (job.type) return job.type;
  if (section === "staffing") return "contract";
  if (section === "local") return "hybrid";

  const text = `${job.notes ?? ""} ${job.role ?? ""} ${job.salary ?? ""}`.toLowerCase();
  if (/\bcontract\b|\/hr\b|\bhourly\b|staffing/.test(text)) return "contract";
  if (/\bhybrid\b/.test(text)) return "hybrid";
  if (/\bon-?site\b|\bin-office\b/.test(text)) return "local";
  if (/\bremote\b/.test(text)) return "remote";

  return "remote";
}

