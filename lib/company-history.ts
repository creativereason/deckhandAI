// What the board already knows about a company, so the same place showing up again in the inbox is noticed.
// Pure: matches on a normalised company name across every section.
import type { JobsData } from "@/lib/jobs";

export type HistorySection = "applied" | "prospect" | "passed" | "pending";

export interface HistoryEntry {
  section: HistorySection;
  /** The stored section it lives in, for linking to its detail page (prospects can be local or staffing). */
  storedSection: "applied" | "prospect" | "local" | "staffing" | "passed" | "pending";
  id?: string;
  company: string;
  role: string;
  /** Application status, for applied jobs. */
  status?: string;
  date?: string;
  fit?: string;
}

const LEGAL_SUFFIXES = /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|gmbh|plc|lp|llp)\b/g;

/** "Acme, Inc." and "The Acme Company" are the same place; "Acme Labs" is not. */
export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/^the\s+/, "")
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ORDER: HistorySection[] = ["applied", "prospect", "passed", "pending"];

export function companyHistory(board: JobsData, job: { id?: string; company: string; role: string }): HistoryEntry[] {
  const key = normalizeCompany(job.company);
  if (!key) return [];
  const isSelf = (j: { id?: string; company: string; role: string }) => (job.id && j.id ? j.id === job.id : j.company === job.company && j.role === job.role);
  const entries: HistoryEntry[] = [];
  const add = (section: HistorySection, list: { id?: string; company: string; role: string; status?: string; date?: string; fit?: string }[] = [], storedSection: HistoryEntry["storedSection"] = section) => {
    for (const j of list) {
      if (normalizeCompany(j.company) !== key || (section === "pending" && isSelf(j))) continue;
      entries.push({ section, storedSection, id: j.id, company: j.company, role: j.role, status: j.status, date: j.date, fit: j.fit });
    }
  };
  add("applied", board.applied);
  add("prospect", board.prospect);
  add("prospect", board.local, "local");
  add("prospect", board.staffing, "staffing");
  add("passed", board.passed);
  add("pending", board.pending);
  return entries.sort((a, b) => ORDER.indexOf(a.section) - ORDER.indexOf(b.section));
}
