// The text the assistant is given about one job, so a question like "should I pursue this?" is answered from the
// job's own data instead of a lookup that cannot find it (an inbox job is not on the board). Same "Label: value"
// lines the job page has always sent as `jobContext` to /api/chat.
export interface JobContextInput {
  company: string;
  role: string;
  section?: string;
  status?: string;
  applied?: string;
  fit?: string;
  type?: string;
  salary?: string;
  url?: string;
  aiSummary?: string;
  notes?: string;
  scoreRationale?: string;
}

export function jobContext(job: JobContextInput): string {
  const lines: [string, string | undefined][] = [
    ["Company", job.company], ["Role", job.role], ["Section", job.section], ["Status", job.status], ["Applied", job.applied],
    ["Fit", job.fit], ["Type", job.type], ["Salary", job.salary], ["URL", job.url],
    ["Role summary", job.aiSummary], ["Notes", job.notes], ["AI Assessment", job.scoreRationale],
  ];
  return lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n");
}

export const jobContextLabel = (job: Pick<JobContextInput, "company" | "role">) => `${job.company} · ${job.role}`;
