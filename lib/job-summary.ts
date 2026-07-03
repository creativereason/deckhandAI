// AI role summary (M14): a 1–2 sentence "at a glance" line per job — what the
// role is and what the company does — distinct from the user's own `notes` and
// from the fit-assessment `scoreRationale`.

export interface SummaryJobContext {
  company: string;
  role: string;
  salary?: string;
  notes?: string;
  jdText?: string;
}

const MAX_SENTENCES = 2;
const MAX_JD_CHARS = 6000;

/**
 * Clean a model response into a stable, display-ready summary: strips fences,
 * quotes, markdown emphasis, and a leading "Summary:" label; collapses
 * whitespace; clamps to two sentences. Idempotent, so re-normalizing a stored
 * value is safe.
 */
export function normalizeAiSummary(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw
    .replace(/```[a-z]*\s*/gi, "")
    .replace(/[*_]{1,3}/g, "")
    .replace(/^\s*["'“‘]+|["'”’]+\s*$/g, "")
    .replace(/^\s*summary\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[a-z0-9]/i.test(cleaned)) return "";
  return cleaned.split(/(?<=[.!?])\s+/).slice(0, MAX_SENTENCES).join(" ");
}

/** Prompt for generating the summary from whatever source text is available (JD excerpt or user notes). */
export function buildAiSummaryPrompt(job: SummaryJobContext): { system: string; user: string } {
  const system =
    "You write a 1–2 sentence at-a-glance summary of a job posting: what the role is (scope, team, key responsibilities) and what the company does. Plain text only — no preamble, no quotes, no markdown, no fit assessment.";

  const source = job.jdText
    ? `JOB DESCRIPTION EXCERPT:\n${job.jdText.slice(0, MAX_JD_CHARS)}`
    : `NOTES:\n${job.notes ?? ""}`;

  const user = `Summarize this job in 1–2 sentences.

Company: ${job.company}
Role: ${job.role}
Salary: ${job.salary || "not listed"}

${source}`;

  return { system, user };
}
