export type JobStatus = "applied" | "screening" | "interview" | "offer" | "declined";
export type JobFit = "strong" | "good" | "caution" | "weak";
export type JobSection = "applied" | "prospect" | "local" | "staffing" | "passed";

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
}

export interface PassedJob {
  company: string;
  role: string;
  salary: string;
  notes: string;
  url: string;
}

export interface JobsData {
  applied: AppliedJob[];
  prospect: ProspectJob[];
  local: ProspectJob[];
  staffing: ProspectJob[];
  passed: PassedJob[];
}

import { githubRead, githubWrite } from "@/lib/github";

const JOBS_PATH = "data/jobs.json";

export async function readJobs(): Promise<JobsData> {
  const raw = await githubRead(JOBS_PATH);
  return JSON.parse(raw) as JobsData;
}

export async function writeJobs(data: JobsData): Promise<void> {
  await githubWrite(JOBS_PATH, JSON.stringify(data, null, 2), "Update jobs.json");
}
