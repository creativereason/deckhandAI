// Split out from lib/jobs.ts so client components can import job types and
// pure helpers (jobKey, resolveJobType) without pulling in lib/github.ts —
// which is server-only (it now also reaches into lib/demo-fixtures.ts, which
// touches Node's `fs`). Bundling that into a client component breaks the build.
import { dataBackend } from "@/lib/data-backend";
import { githubRead, githubWrite } from "@/lib/github";
import { getSupabase } from "@/lib/supabase";
import { createJobRowStore } from "@/lib/supabase-row-store";
import { writeJobsTo } from "@/lib/supabase-jobs";
import type { BatchResult, BatchUpdate, FoundJob, JobPatch, JobRef } from "@/lib/job-ops";
import { createJsonRepository, createSupabaseRepository, type JobRepository } from "@/lib/job-repository";
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

async function readGithubBoard(): Promise<JobsData> {
  try {
    const raw = await githubRead(JOBS_PATH);
    return normalizeJobsData(JSON.parse(raw) as Partial<JobsData>);
  } catch {
    return emptyJobs();
  }
}

async function writeGithubBoard(data: JobsData): Promise<void> {
  await githubWrite(JOBS_PATH, JSON.stringify(data, null, 2), "Update jobs.json");
}

/**
 * The repository for the configured backend. On Supabase each operation writes only its
 * own rows, so overlapping writers cannot drop each other's jobs. The JSON file has no
 * ids or soft-delete marker, so there each change is a read-modify-write on section +
 * company + role. Both implementations pass the same contract tests.
 */
export function jobRepository(): JobRepository {
  if (dataBackend() === "supabase") return createSupabaseRepository(createJobRowStore(getSupabase()));
  return createJsonRepository({ read: readGithubBoard, write: writeGithubBoard });
}

// No empty-board fallback on Supabase: writeJobs diffs against stored rows, so writing
// back an empty board after a failed read would soft-delete them all.
export const readJobs = (): Promise<JobsData> => jobRepository().readBoard();

/** Whole-board write, kept for the importer and tests. Application code uses the operations below. */
export async function writeJobs(data: JobsData): Promise<void> {
  if (dataBackend() === "supabase") return writeJobsTo(createJobRowStore(getSupabase()), data);
  await writeGithubBoard(data);
}

type Job = Record<string, unknown>;

/** Returns the new row's id on Supabase; the JSON backend has no ids. */
export const addJob = (section: JobSection, job: Job): Promise<string | undefined> => jobRepository().add(section, job);

/** Adds many jobs at the front of a section: one insert on Supabase, one file write on GitHub. */
export const addJobs = (section: JobSection, jobs: Job[]): Promise<void> => jobRepository().addMany(section, jobs);

/** Merges each patch's updates into its job: one row write on Supabase, one file write on GitHub. */
export const patchJobs = (patches: JobPatch[]): Promise<BatchResult> => jobRepository().patch(patches);

/** The same updates for many jobs. */
export function updateJobs({ targets, updates }: BatchUpdate): Promise<BatchResult> {
  return patchJobs(targets.map((target) => ({ target, updates })));
}

export const getJob = (ref: JobRef): Promise<FoundJob | undefined> => jobRepository().get(ref);

/** Replaces a job's fields; a section change moves it to the front of the new section. False when not found. */
export const saveJob = (ref: JobRef, next: { section: JobSection; job: Job }): Promise<boolean> => jobRepository().save(ref, next);

/** Soft-deletes on Supabase, removes the entry from the JSON file. False when not found. */
export const archiveJob = (ref: JobRef): Promise<boolean> => jobRepository().archive(ref);
