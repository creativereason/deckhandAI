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
}

export interface PassedJob {
  company: string;
  role: string;
  salary: string;
  notes: string;
  url: string;
  type?: JobType;
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

import { githubRead, githubWrite } from "@/lib/github";

const JOBS_PATH = "data/jobs.json";

function emptyJobs(): JobsData {
  return { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };
}

function jobList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeJobsData(value: Partial<JobsData>): JobsData {
  return {
    applied: jobList<AppliedJob>(value.applied),
    prospect: jobList<ProspectJob>(value.prospect),
    local: jobList<ProspectJob>(value.local),
    staffing: jobList<ProspectJob>(value.staffing),
    passed: jobList<PassedJob>(value.passed),
    pending: jobList<PendingJob>(value.pending),
  };
}

export async function readJobs(): Promise<JobsData> {
  try {
    const raw = await githubRead(JOBS_PATH);
    return normalizeJobsData(JSON.parse(raw) as Partial<JobsData>);
  } catch {
    return emptyJobs();
  }
}

export async function writeJobs(data: JobsData): Promise<void> {
  await githubWrite(JOBS_PATH, JSON.stringify(data, null, 2), "Update jobs.json");
}
