// The storage-independent contract for jobs. Route handlers and tools depend on this
// shape, not on a backend (Dependency Inversion); every implementation must pass the
// shared suite in lib/__tests__/helpers/job-repository-contract.ts (Liskov).
import type { JobSection, JobsData } from "@/lib/jobs";
import {
  addJobsTo, addJobTo, archiveJobIn, getJobIn, patchJobsIn, saveJobIn,
  type BatchResult, type FoundJob, type JobPatch, type JobRef,
} from "@/lib/job-ops";
import { readJobsFrom, type JobRowStore } from "@/lib/supabase-jobs";

type Job = Record<string, unknown>;

export interface JobRepository {
  readBoard(): Promise<JobsData>;
  /** Adds at the front of the section. Returns the new id where the backend has ids. */
  add(section: JobSection, job: Job): Promise<string | undefined>;
  /** Adds many at the front, last added first, as if added one at a time. */
  addMany(section: JobSection, jobs: Job[]): Promise<void>;
  get(ref: JobRef): Promise<FoundJob | undefined>;
  /** Replaces a job's fields; a section change moves it to the front of the new section. False when not found. */
  save(ref: JobRef, next: { section: JobSection; job: Job }): Promise<boolean>;
  /** Merges each patch's updates into its job and reports the targets it could not find. */
  patch(patches: JobPatch[]): Promise<BatchResult>;
  /** Takes the job off the board. Rows are soft-deleted where the backend can; false when not found. */
  archive(ref: JobRef): Promise<boolean>;
}

/** One row per job. Each operation writes only the rows it touches. */
export function createSupabaseRepository(store: JobRowStore): JobRepository {
  return {
    readBoard: () => readJobsFrom(store),
    add: (section, job) => addJobTo(store, section, job),
    addMany: async (section, jobs) => void (await addJobsTo(store, section, jobs)),
    get: (ref) => getJobIn(store, ref),
    save: (ref, next) => saveJobIn(store, ref, next),
    patch: (patches) => patchJobsIn(store, patches),
    archive: (ref) => archiveJobIn(store, ref),
  };
}

export interface BoardIo {
  read(): Promise<JobsData>;
  write(board: JobsData): Promise<void>;
}

function list(board: JobsData, section: JobSection): Job[] {
  return board[section] as unknown as Job[];
}

function indexOf(board: JobsData, ref: JobRef): number {
  if (!ref.section) return -1;
  return list(board, ref.section).findIndex((j) => j.company === ref.company && j.role === ref.role);
}

function saveIn(board: JobsData, ref: JobRef, next: { section: JobSection; job: Job }): boolean {
  const index = indexOf(board, ref);
  if (index === -1 || !ref.section) return false;
  if (next.section === ref.section) {
    list(board, ref.section)[index] = next.job;
  } else {
    list(board, ref.section).splice(index, 1);
    list(board, next.section).unshift(next.job);
  }
  return true;
}

function patchIn(board: JobsData, patches: JobPatch[]): BatchResult {
  const notFound: JobRef[] = [];
  let updated = 0;
  for (const { target, updates } of patches) {
    const index = indexOf(board, target);
    if (index === -1 || !target.section) {
      notFound.push(target);
      continue;
    }
    const jobs = list(board, target.section);
    jobs[index] = { ...jobs[index], ...updates };
    updated++;
  }
  return { updated, notFound };
}

function archiveIn(board: JobsData, ref: JobRef): boolean {
  const index = indexOf(board, ref);
  if (index === -1 || !ref.section) return false;
  list(board, ref.section).splice(index, 1);
  return true;
}

function addManyIn(board: JobsData, section: JobSection, jobs: Job[]): boolean {
  for (const job of jobs) list(board, section).unshift(job);
  return jobs.length > 0;
}

/** The whole board is one JSON file with no ids, so each change reads it, edits it and writes it back. */
export function createJsonRepository(io: BoardIo): JobRepository {
  /** Reads, applies `edit`, and writes only when the edit says it changed something. */
  async function change<T>(edit: (board: JobsData) => { changed: boolean; result: T }): Promise<T> {
    const board = await io.read();
    const { changed, result } = edit(board);
    if (changed) await io.write(board);
    return result;
  }
  const flag = (changed: boolean) => ({ changed, result: changed });
  return {
    readBoard: () => io.read(),
    add: (section, job) => change((board) => ({ changed: !!addManyIn(board, section, [job]), result: undefined })),
    addMany: (section, jobs) => change((board) => ({ changed: addManyIn(board, section, jobs), result: undefined })),
    async get(ref) {
      const board = await io.read();
      const index = indexOf(board, ref);
      return index === -1 || !ref.section ? undefined : { id: "", section: ref.section, job: list(board, ref.section)[index] };
    },
    save: (ref, next) => change((board) => flag(saveIn(board, ref, next))),
    patch: (patches) => change((board) => {
      const result = patchIn(board, patches);
      return { changed: result.updated > 0, result };
    }),
    archive: (ref) => change((board) => flag(archiveIn(board, ref))),
  };
}
