// What "Today" shows, derived from the board with no new data: the funnel and the things that need you.
// Pure so the screen and its tests share one rule. Dates come in as an argument so tests do not depend on the clock.
import type { JobsData } from "@/lib/jobs";

export interface FunnelStage { id: "prospect" | "applied" | "screening" | "interview" | "offer"; label: string; count: number }

export type NeedsYouKind = "offer" | "interview" | "strong-fit" | "stale" | "inbox";
export interface NeedsYouItem {
  kind: NeedsYouKind;
  id: string;
  title: string;
  detail: string;
  /** Present for items about one job. */
  job?: { id?: string; company: string; role: string; section: "applied" | "prospect" };
  /** What to ask the assistant about this item. */
  prompt: string;
}

const STALE_AFTER_DAYS = 14;
const MAX_ITEMS_PER_KIND = 5;
const DAY_MS = 86_400_000;

export function buildFunnel(jobs: JobsData): FunnelStage[] {
  const applied = (status: string) => jobs.applied.filter((j) => j.status === status).length;
  const prospects = jobs.prospect.length + (jobs.local ?? []).length + (jobs.staffing ?? []).length;
  return [
    { id: "prospect", label: "Prospects", count: prospects },
    { id: "applied", label: "Applied", count: applied("applied") },
    { id: "screening", label: "Screening", count: applied("screening") },
    { id: "interview", label: "Interview", count: applied("interview") },
    { id: "offer", label: "Offer", count: applied("offer") },
  ];
}

function daysSince(date: string, now: Date): number | null {
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? null : Math.floor((now.getTime() - t) / DAY_MS);
}

export function buildNeedsYou(jobs: JobsData, now: Date): NeedsYouItem[] {
  const items: NeedsYouItem[] = [];
  const pending = (jobs.pending ?? []).length;
  if (pending > 0) {
    items.push({ kind: "inbox", id: "inbox", title: `${pending} new ${pending === 1 ? "job" : "jobs"} to triage`, detail: "From scrapes and agents", prompt: "Which of my pending jobs look most promising, and why?" });
  }
  for (const j of jobs.applied.filter((a) => a.status === "offer")) {
    items.push({ kind: "offer", id: `offer-${j.company}-${j.role}`, title: `${j.company} offer is open`, detail: j.role, job: { id: j.id, company: j.company, role: j.role, section: "applied" }, prompt: `I have an offer from ${j.company} for ${j.role}. Help me think through negotiating it.` });
  }
  for (const j of jobs.applied.filter((a) => a.status === "interview").slice(0, MAX_ITEMS_PER_KIND)) {
    items.push({ kind: "interview", id: `interview-${j.company}-${j.role}`, title: `Prepare for ${j.company}`, detail: j.role, job: { id: j.id, company: j.company, role: j.role, section: "applied" }, prompt: `Prep me for my ${j.company} interview for ${j.role}: likely questions and what to ask them.` });
  }
  for (const j of jobs.prospect.filter((p) => p.isNew && p.fit === "strong").slice(0, MAX_ITEMS_PER_KIND)) {
    items.push({ kind: "strong-fit", id: `strong-${j.company}-${j.role}`, title: `New strong fit: ${j.company}`, detail: j.role, job: { id: j.id, company: j.company, role: j.role, section: "prospect" }, prompt: `Should I apply to ${j.role} at ${j.company}? What should my angle be?` });
  }
  const stale = jobs.applied.filter((a) => a.status === "applied" && !a.isGhost && (daysSince(a.date, now) ?? 0) > STALE_AFTER_DAYS).slice(0, MAX_ITEMS_PER_KIND);
  for (const j of stale) {
    items.push({ kind: "stale", id: `stale-${j.company}-${j.role}`, title: `No news from ${j.company}`, detail: `Applied ${daysSince(j.date, now)} days ago`, job: { id: j.id, company: j.company, role: j.role, section: "applied" }, prompt: `I applied to ${j.company} for ${j.role} ${daysSince(j.date, now)} days ago with no reply. Draft a short follow-up.` });
  }
  return items;
}
