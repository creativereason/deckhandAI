"use client";
import Link from "next/link";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { AskAIButton } from "@/components/ai/ai";
import { useAssistant } from "@/components/shell/assistant-context";
import { jobDetailHref } from "@/lib/job-detail";
import { jobContext, jobContextLabel } from "@/lib/job-context";
import { historyPrompt } from "@/lib/assistant-prompts";
import type { HistoryEntry } from "@/lib/company-history";
import type { JobStatus } from "@/lib/jobs";

const SECTION_LABEL: Record<HistoryEntry["section"], string> = {
  applied: "Applied", prospect: "In prospects", passed: "Passed", pending: "Also in your inbox",
};

/** The one-word flag shown beside the company name, strongest fact first. */
export function historyFlag(entries: HistoryEntry[]): { label: string; variant: "warning" | "info" | "neutral" } | null {
  if (entries.some((e) => e.section === "applied")) return { label: "Applied before", variant: "warning" };
  if (entries.some((e) => e.section === "passed")) return { label: "Passed before", variant: "neutral" };
  if (entries.some((e) => e.section === "prospect")) return { label: "Already in prospects", variant: "info" };
  return null;
}

function Entry({ entry }: { entry: HistoryEntry }) {
  const body = (
    <>
      <span className="font-medium text-foreground">{entry.role}</span>
      {entry.date && <span className="text-muted-foreground"> · {entry.date}</span>}
    </>
  );
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <Badge variant={entry.section === "applied" ? "warning" : "neutral"}>{SECTION_LABEL[entry.section]}</Badge>
      {entry.status && <StatusBadge kind="status" value={entry.status as JobStatus} />}
      {entry.section === "pending"
        ? <span>{body}</span>
        : <Link href={jobDetailHref({ id: entry.id, company: entry.company, role: entry.role, section: entry.storedSection })} className="underline-offset-4 hover:underline">{body}</Link>}
    </li>
  );
}

/**
 * What the board already holds for this company, so a place that keeps coming back is noticed. The list is
 * read straight from the board; the button asks the assistant for the judgment (is it worth another look?).
 */
export default function CompanyHistory({ job, entries }: {
  job: { company: string; role: string; url?: string; salary?: string; notes?: string; aiSummary?: string; fit?: string };
  entries: HistoryEntry[];
}) {
  const assistant = useAssistant();
  const ask = () => assistant.ask(
    historyPrompt(job),
    { send: true, context: { label: jobContextLabel(job), text: jobContext({ ...job, section: "pending (inbox, not yet on the board)" }) } },
  );
  return (
    <section aria-label={`History at ${job.company}`} className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><History className="size-4" aria-hidden />History at {job.company}</h3>
      {entries.length === 0
        ? <p className="text-sm text-muted-foreground">Nothing on your board yet. First time seeing {job.company}.</p>
        : <ul className="divide-y divide-border rounded-md border border-border px-3">{entries.map((e, i) => <Entry key={`${e.storedSection}-${e.id ?? e.role}-${i}`} entry={e} />)}</ul>}
      <div><AskAIButton onClick={ask}>Ask about my history here</AskAIButton></div>
    </section>
  );
}
