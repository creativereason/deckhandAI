// Request shapes for the agent API (Security Invariant 2). Every object is strict: an
// unknown field is an error, so an agent cannot slip in a change its scope does not allow
// (a section, a status, an id, another job's URL).
import { z } from "zod";
import { SectionSchema } from "@/lib/job-schemas";

const Text = (max: number) => z.string().max(max);
const NonBlank = (max: number) => z.string().max(max).refine((v) => v.trim().length > 0, "must not be blank");
const Fit = z.enum(["strong", "good", "caution", "weak"]);

// A stored URL becomes a clickable link in the UI, so anything but a web URL (javascript:,
// data:, file:) is refused. Empty is allowed: a job can be added before its link is known.
const WebUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    if (value === "") return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "must be an http(s) URL");

/** Add to the inbox. No section field: agents add to pending and nowhere else. */
export const AgentCreateJob = z.strictObject({
  company: NonBlank(200),
  role: NonBlank(200),
  url: WebUrl.default(""),
  salary: Text(200).default(""),
  notes: Text(20_000).default(""),
  aiSummary: Text(2_000).optional(),
  scrapeGroup: z.enum(["remote", "local"]).optional(),
});

/** The fields the jobs:edit scope covers, and only those. */
export const AgentEditJob = z
  .strictObject({
    notes: Text(20_000),
    aiSummary: Text(2_000),
    scoreRationale: Text(5_000),
    fit: Fit,
  })
  .partial()
  .refine((edit) => Object.keys(edit).length > 0, "provide at least one field to change");

export const AgentMoveJob = z.strictObject({ to: SectionSchema });

/** Query strings arrive as text, so numbers are coerced. */
export const AgentListQuery = z.strictObject({
  section: SectionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const JobId = z.uuid();
