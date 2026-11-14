// Zod schemas for the /api/jobs request bodies (Security Invariant 2). Job objects are
// "loose": fields not listed here are kept, because the board has always carried
// extra keys (the Supabase `extra` column exists for them). Known fields are checked
// for type, and values are never transformed.
import { z } from "zod";

export const SectionSchema = z.enum(["applied", "prospect", "local", "staffing", "passed", "pending"]);

const NonBlank = z.string().refine((value) => value.trim().length > 0, "must not be blank");
// The edit form sends "" when the date field is cleared.
const IsoDateOrEmpty = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")]);

const fields = {
  company: NonBlank,
  role: NonBlank,
  url: z.string(),
  salary: z.string(),
  notes: z.string(),
  aiSummary: z.string(),
  scoreRationale: z.string(),
  status: z.enum(["applied", "screening", "interview", "offer", "declined"]),
  fit: z.enum(["strong", "good", "caution", "weak"]),
  type: z.enum(["remote", "hybrid", "local", "contract"]),
  date: IsoDateOrEmpty,
  scrapeGroup: z.enum(["remote", "local"]),
  scrapeDate: IsoDateOrEmpty,
  isNew: z.boolean(),
  isGhost: z.boolean(),
};

/** Changes to an existing job: any known field, but company and role may not be blanked. */
const JobUpdatesSchema = z.looseObject(fields).partial();

/** A job being added: company and role are required, everything else is optional. */
const JobSchema = JobUpdatesSchema.required({ company: true, role: true }).extend({ id: z.string().optional() });

// A job is named by its id, or by section + company + role for callers without ids.
const JobRef = {
  id: z.string().min(1).optional(),
  section: SectionSchema,
  company: z.string().optional(),
  role: z.string().optional(),
};

function namesAJob(ref: { id?: string; company?: string; role?: string }): boolean {
  return !!ref.id || (!!ref.company && !!ref.role);
}
const NAMES_A_JOB = { message: "provide an id, or both company and role", path: ["id"] };

export const PostJobBody = z.object({ section: SectionSchema, job: JobSchema });

export const PatchJobBody = z
  .object({ ...JobRef, updates: JobUpdatesSchema, targetSection: SectionSchema.optional() })
  .refine(namesAJob, NAMES_A_JOB);

export const DeleteJobBody = z
  .object({ ...JobRef, targetSection: SectionSchema.optional() })
  .refine(namesAJob, NAMES_A_JOB);
