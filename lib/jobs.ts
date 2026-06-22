export type JobStatus = "applied" | "screening" | "interview" | "offer" | "declined";
export type JobFit = "strong" | "good" | "caution" | "weak";
export type JobSection = "applied" | "prospect" | "local" | "staffing" | "passed" | "pending";

export interface AppliedJob {
  company: string;
  role: string;
  status: JobStatus;
  date: string;
  salary: string;
  notes: string;
  url: string;
}

export interface ProspectJob {
  company: string;
  role: string;
  fit: JobFit;
  salary: string;
  notes: string;
  url: string;
  isNew?: boolean;
  scoreRationale?: string;
}

export interface PassedJob {
  company: string;
  role: string;
  salary: string;
  notes: string;
  url: string;
}

export interface PendingJob {
  company: string;
  role: string;
  url: string;
  salary: string;
  notes: string;
  scrapeGroup: "remote" | "local";
  scrapeDate: string;
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

import { githubRead, githubWrite } from "@/lib/github";

const JOBS_PATH = "data/jobs.json";

const EMPTY_JOBS: JobsData = { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };

export async function readJobs(): Promise<JobsData> {
  try {
    const raw = await githubRead(JOBS_PATH);
    return JSON.parse(raw) as JobsData;
  } catch {
    return { ...EMPTY_JOBS };
  }
}

export async function writeJobs(data: JobsData): Promise<void> {
  await githubWrite(JOBS_PATH, JSON.stringify(data, null, 2), "Update jobs.json");
}
