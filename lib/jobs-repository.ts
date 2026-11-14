// Split out from lib/jobs.ts so client components can import job types and
// pure helpers (jobKey, resolveJobType) without pulling in lib/github.ts —
// which is server-only (it now also reaches into lib/demo-fixtures.ts, which
// touches Node's `fs`). Bundling that into a client component breaks the build.
import { dataBackend } from "@/lib/data-backend";
import { githubRead, githubWrite } from "@/lib/github";
import { getSupabase } from "@/lib/supabase";
import { createJobRowStore } from "@/lib/supabase-row-store";
import { readJobsFrom, writeJobsTo } from "@/lib/supabase-jobs";
import { addJobTo, archiveJobIn, getJobIn, saveJobIn, type FoundJob, type JobRef } from "@/lib/job-ops";
import type { AppliedJob, ProspectJob, PassedJob, PendingJob, JobsData, JobSection } from "@/lib/jobs";

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
  // No empty-board fallback on Supabase: the write path diffs against stored
  // rows, so writing back an empty board after a failed read would delete them all.
  if (dataBackend() === "supabase") return readJobsFrom(createJobRowStore(getSupabase()));
  try {
    const raw = await githubRead(JOBS_PATH);
    return normalizeJobsData(JSON.parse(raw) as Partial<JobsData>);
  } catch {
    return emptyJobs();
  }
}

export async function writeJobs(data: JobsData): Promise<void> {
  if (dataBackend() === "supabase") return writeJobsTo(createJobRowStore(getSupabase()), data);
  await githubWrite(JOBS_PATH, JSON.stringify(data, null, 2), "Update jobs.json");
}

// Single-job operations. On Supabase each writes only its own row, so overlapping
// writers cannot drop each other's jobs. The JSON file has no row ids or soft-delete
// marker, so there they keep the original read-modify-write, matched on section +
// company + role.
type Job = Record<string, unknown>;

function boardList(board: JobsData, section: JobSection): Job[] {
  return board[section] as unknown as Job[];
}

function githubIndex(board: JobsData, ref: JobRef): number {
  if (!ref.section) return -1;
  return boardList(board, ref.section).findIndex((j) => j.company === ref.company && j.role === ref.role);
}

function supabaseStore() {
  return createJobRowStore(getSupabase());
}

export async function addJob(section: JobSection, job: Job): Promise<void> {
  if (dataBackend() === "supabase") {
    await addJobTo(supabaseStore(), section, job);
    return;
  }
  const board = await readJobs();
  boardList(board, section).unshift(job);
  await writeJobs(board);
}

export async function getJob(ref: JobRef): Promise<FoundJob | undefined> {
  if (dataBackend() === "supabase") return getJobIn(supabaseStore(), ref);
  const board = await readJobs();
  const index = githubIndex(board, ref);
  if (index === -1 || !ref.section) return undefined;
  return { id: "", section: ref.section, job: boardList(board, ref.section)[index] };
}

/** Replaces a job's fields; a section change moves it to the front of the new section. False when not found. */
export async function saveJob(ref: JobRef, next: { section: JobSection; job: Job }): Promise<boolean> {
  if (dataBackend() === "supabase") return saveJobIn(supabaseStore(), ref, next);
  const board = await readJobs();
  const index = githubIndex(board, ref);
  if (index === -1 || !ref.section) return false;
  if (next.section === ref.section) {
    boardList(board, ref.section)[index] = next.job;
  } else {
    boardList(board, ref.section).splice(index, 1);
    boardList(board, next.section).unshift(next.job);
  }
  await writeJobs(board);
  return true;
}

/** Soft-deletes on Supabase, removes the entry from the JSON file. False when not found. */
export async function archiveJob(ref: JobRef): Promise<boolean> {
  if (dataBackend() === "supabase") return archiveJobIn(supabaseStore(), ref);
  const board = await readJobs();
  const index = githubIndex(board, ref);
  if (index === -1 || !ref.section) return false;
  boardList(board, ref.section).splice(index, 1);
  await writeJobs(board);
  return true;
}
