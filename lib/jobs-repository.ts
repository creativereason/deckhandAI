// Split out from lib/jobs.ts so client components can import job types and
// pure helpers (jobKey, resolveJobType) without pulling in lib/github.ts —
// which is server-only (it now also reaches into lib/demo-fixtures.ts, which
// touches Node's `fs`). Bundling that into a client component breaks the build.
import { githubRead, githubWrite } from "@/lib/github";
import type { AppliedJob, ProspectJob, PassedJob, PendingJob, JobsData } from "@/lib/jobs";

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
