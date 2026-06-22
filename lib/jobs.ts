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

const OWNER = process.env.GITHUB_REPO_OWNER!;
const REPO = process.env.GITHUB_REPO_NAME!;
const TOKEN = process.env.GITHUB_TOKEN!;
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}/contents/jobs.json`;

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export async function readJobs(): Promise<JobsData> {
  const res = await fetch(API_BASE, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  const { content } = await res.json();
  return JSON.parse(Buffer.from(content, "base64").toString("utf-8"));
}

export async function writeJobs(data: JobsData): Promise<void> {
  // GET current sha (required for PUT)
  const getRes = await fetch(API_BASE, { headers: HEADERS, cache: "no-store" });
  if (!getRes.ok) throw new Error(`GitHub API error ${getRes.status}: ${await getRes.text()}`);
  const { sha } = await getRes.json();

  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  const putRes = await fetch(API_BASE, {
    method: "PUT",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Update jobs.json", content, sha }),
  });
  if (!putRes.ok) throw new Error(`GitHub API write error ${putRes.status}: ${await putRes.text()}`);
}
