// The fields a job must have to live in a section. Used whenever a job is added to or
// moved into a section, whoever is doing it (UI, chat, agents).
import type { JobSection } from "@/lib/jobs";

type Job = Record<string, unknown>;

const today = () => new Date().toISOString().split("T")[0];

/** Returns a copy with the section's required fields filled in; existing values are never overwritten. */
export function normalizeForSection(job: Job, section: JobSection): Job {
  const out = { ...job };
  if (section === "applied") {
    if (!out.status) out.status = "applied";
    if (!out.date) out.date = today();
  } else if (section === "prospect" || section === "local" || section === "staffing") {
    if (!out.fit) out.fit = "good";
  } else if (section === "pending") {
    if (!out.scrapeGroup) out.scrapeGroup = "remote";
    if (!out.scrapeDate) out.scrapeDate = today();
  }
  return out;
}
