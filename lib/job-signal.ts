import type { AppliedJob, ProspectJob } from "@/lib/jobs";

export const ICON_SORT: Record<string, string> = {
  "⚡": "0",
  "🟢": "1",
  "🟡": "2",
  "👻": "3",
  "🔴": "4",
};

export function iconSortKey(icon: string): string {
  return ICON_SORT[icon] ?? "9";
}

export function getAppliedIcon(job: Pick<AppliedJob, "status" | "date" | "notes">): string {
  const notes = (job.notes ?? "").toLowerCase();
  if (notes.includes("ghost") || notes.includes("closed —")) return "👻";
  if (job.status === "declined") return "🔴";
  if (job.status === "screening" || job.status === "interview" || job.status === "offer") return "⚡";
  if (job.date) {
    const days = (Date.now() - new Date(job.date).getTime()) / 86_400_000;
    if (days > 14) return "🟡";
  }
  return "🟢";
}

export function getProspectIcon(job: Pick<ProspectJob, "fit">): string {
  if (job.fit === "strong") return "⚡";
  if (job.fit === "good") return "🟢";
  if (job.fit === "caution") return "🟡";
  if (job.fit === "weak") return "🔴";
  return "🟢";
}

const SIGNAL_LABELS: Record<string, string> = {
  "⚡": "Needs attention",
  "🟢": "Active / good fit",
  "🟡": "Caution / stale",
  "👻": "Ghost job",
  "🔴": "Declined / poor fit",
};

export function getSignalLabel(icon: string): string {
  return SIGNAL_LABELS[icon] ?? "";
}
