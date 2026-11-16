// The Pipeline board's columns and the moves between them. Pure, so the board, the
// page and the tests share one rule. A column is a stage, not a stored section:
// Prospects is the three prospect sections together, the rest are application statuses.
import type { AppliedJob, JobFit, JobSection, JobStatus, ProspectJob } from "@/lib/jobs";

export type ColumnId = "prospect" | JobStatus;
export type MoveTarget = ColumnId | "passed";
type ProspectSection = "prospect" | "local" | "staffing";

export interface PipelineCard {
  key: string;
  id?: string;
  company: string;
  role: string;
  summary?: string;
  fit?: JobFit;
  salary: string;
  section: ProspectSection | "applied";
  status?: JobStatus;
}

export interface PipelineColumn {
  id: ColumnId;
  title: string;
  cards: PipelineCard[];
}

export type TaggedProspect = ProspectJob & { _section: ProspectSection };

const COLUMNS: { id: ColumnId; title: string }[] = [
  { id: "prospect", title: "Prospects" },
  { id: "applied", title: "Applied" },
  { id: "screening", title: "Screening" },
  { id: "interview", title: "Interview" },
  { id: "offer", title: "Offer" },
  { id: "declined", title: "Declined" },
];

const cardKey = (job: { id?: string; company: string; role: string }, section: string) => job.id ?? `${section}|${job.company}|${job.role}`;

function prospectCard(job: TaggedProspect): PipelineCard {
  return { key: cardKey(job, job._section), id: job.id, company: job.company, role: job.role, summary: job.aiSummary, fit: job.fit, salary: job.salary, section: job._section };
}

function appliedCard(job: AppliedJob): PipelineCard {
  return { key: cardKey(job, "applied"), id: job.id, company: job.company, role: job.role, summary: job.aiSummary, salary: job.salary, section: "applied", status: job.status };
}

const knownStatus = (status: unknown): status is JobStatus => COLUMNS.some((c) => c.id === status && c.id !== "prospect");

/** A status the board does not know still shows the job, in Applied, so a legacy row is never hidden. */
const columnOf = (job: AppliedJob): ColumnId => (knownStatus(job.status) ? job.status : "applied");

export function buildPipeline(jobs: { prospects: TaggedProspect[]; applied: AppliedJob[] }, hidden: ReadonlySet<JobStatus>): PipelineColumn[] {
  return COLUMNS.filter((c) => c.id === "prospect" || !hidden.has(c.id as JobStatus)).map((column) => ({
    ...column,
    cards: column.id === "prospect"
      ? jobs.prospects.map(prospectCard)
      : jobs.applied.filter((j) => columnOf(j) === column.id).map(appliedCard),
  }));
}

export interface MoveAction {
  section: JobSection;
  status?: JobStatus;
}

/** What to do to put a card in another column, or null when it is already there. */
export function moveAction(card: PipelineCard, to: MoveTarget): MoveAction | null {
  const inApplied = card.section === "applied";
  if (to === "passed") return { section: "passed" };
  if (to === "prospect") return inApplied ? { section: "prospect" } : null;
  if (inApplied) return card.status === to ? null : { section: "applied", status: to };
  return to === "applied" ? { section: "applied" } : { section: "applied", status: to };
}
