"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AIInsight, AskAIButton } from "@/components/ai/ai";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { useAssistant } from "@/components/shell/assistant-context";
import { Inbox, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { jobContext, jobContextLabel } from "@/lib/job-context";
import { pursuePrompt } from "@/lib/assistant-prompts";
import { useScorePending } from "@/components/use-score-pending";
import { groupBadgeVariant } from "@/lib/job-badges";
import type { JobsData, PendingJob } from "@/lib/jobs";
import CompanyHistory, { historyFlag } from "@/components/CompanyHistory";
import { companyHistory, type HistoryEntry } from "@/lib/company-history";
import { submitReview } from "@/lib/review-client";
import { rotateQueue, settleOffset, stepOffset, triageKeyAction, type TriageAction } from "@/lib/triage";

const keyOf = (j: PendingJob) => j.id ?? `${j.company}|${j.role}`;

const PRESS_FLASH_MS = 300;

function usePressed() {
  const [pressed, setPressed] = useState<TriageAction | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function flash(action: TriageAction) {
    clearTimeout(timer.current);
    setPressed(action);
    timer.current = setTimeout(() => setPressed(null), PRESS_FLASH_MS);
  }
  return { pressed, flash };
}

function useTriage(pending: PendingJob[], onUpdate: () => void, startOffset = 0) {
  const [offset, setOffset] = useState(startOffset);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const saving = useRef(false);
  const { pressed, flash } = usePressed();
  const queue = pending.filter((j) => !gone.has(keyOf(j)));
  const ordered = rotateQueue(queue, offset);

  async function review(action: "approve" | "reject") {
    const current = ordered[0];
    if (!current || saving.current) return;
    saving.current = true;
    const result = await submitReview({ job: current, action, fit: current.fit ?? "good", scoreRationale: current.scoreRationale });
    saving.current = false;
    if (!result.ok) return void (result.demo ? toast.info("Demo mode — changes are read-only") : toast.error(`Failed: ${result.message}`));
    toast.success(action === "approve" ? `Added ${current.company} to Prospects` : `Passed on ${current.company}`);
    setOffset(settleOffset(offset, queue.length));
    setGone((prev) => new Set(prev).add(keyOf(current)));
    onUpdate();
  }

  function act(action: TriageAction) {
    flash(action);
    if (action === "add") void review("approve");
    else if (action === "pass") void review("reject");
    else setOffset(stepOffset(offset, action === "skip" ? 1 : -1, queue.length));
  }

  return { current: ordered[0], upNext: ordered.slice(1, 6), reviewed: gone.size, total: gone.size + queue.length, act, pressed };
}

function useTriageKeys(act: (action: TriageAction) => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const action = triageKeyAction({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, targetTag: el?.tagName, isEditable: el?.isContentEditable });
      if (!action) return;
      e.preventDefault();
      act(action);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}

function Kbd({ children }: { children: string }) {
  return <kbd className="rounded-sm border border-border bg-muted px-1 font-mono text-xs text-muted-foreground">{children}</kbd>;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      {children}
    </div>
  );
}

function Verdict({ job, scoring }: { job: PendingJob; scoring: boolean }) {
  if (!job.fit) return <p className="text-sm text-muted-foreground">{scoring ? "Scoring…" : "Not scored yet"}</p>;
  return (
    <div className="flex flex-col gap-2">
      <div><StatusBadge kind="fit" value={job.fit} /></div>
      {job.scoreRationale && <AIInsight label="AI fit assessment">{job.scoreRationale}</AIInsight>}
    </div>
  );
}

function JobCard({ job, scoring, history }: { job: PendingJob; scoring: boolean; history: HistoryEntry[] }) {
  const assistant = useAssistant();
  const flag = historyFlag(history);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {job.company}
          <Badge variant={groupBadgeVariant(job.scrapeGroup)}>{job.scrapeGroup}</Badge>
          {flag && <Badge variant={flag.variant}>{flag.label}</Badge>}
        </p>
        <h2 className="text-xl font-semibold text-balance">{job.role}</h2>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {job.salary && <span>{job.salary}</span>}
          <span>Found {job.scrapeDate}</span>
          {job.url && <a href={job.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline underline-offset-4 hover:no-underline">View posting<ExternalLink className="size-4" aria-hidden /><span className="sr-only">(opens in a new tab)</span></a>}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Section label="At a glance"><p className="text-sm">{job.aiSummary ?? "No summary yet."}</p></Section>
        <Section label="Fit"><Verdict job={job} scoring={scoring} /></Section>
      </div>
      <CompanyHistory job={job} entries={history} />
      {job.notes && (
        <Section label="From the posting">
          <p tabIndex={0} role="region" aria-label="Posting text" className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">{job.notes}</p>
        </Section>
      )}
      <div>
        <AskAIButton onClick={() => assistant.ask(pursuePrompt(job), { send: true, context: { label: jobContextLabel(job), text: jobContext({ company: job.company, role: job.role, section: "pending (inbox, not yet on the board)", fit: job.fit, type: job.scrapeGroup, salary: job.salary, url: job.url, aiSummary: job.aiSummary, notes: job.notes, scoreRationale: job.scoreRationale }) } })}>Ask about this job</AskAIButton>
      </div>
    </div>
  );
}

function ActionBar({ act, pressed }: { act: (action: TriageAction) => void; pressed: TriageAction | null }) {
  const mark = (action: TriageAction, extra?: string) => ({
    "data-pressed": pressed === action ? "true" : undefined,
    className: cn("data-[pressed=true]:scale-95 data-[pressed=true]:border-primary transition-transform duration-(--duration-fast)", extra),
  });
  return (
    <div className="sticky bottom-16 -mx-4 -mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 rounded-b-lg border-t border-border bg-card p-4 md:bottom-0">
      <Button variant="outline" size="lg" onClick={() => act("pass")} {...mark("pass")}>Pass <Kbd>P</Kbd></Button>
      <Button variant="outline" size="lg" onClick={() => act("skip")} {...mark("skip")}>Skip <Kbd>S</Kbd></Button>
      <Button size="lg" onClick={() => act("add")} {...mark("add", "order-first col-span-2 sm:order-last sm:col-span-1")}>Add to Prospects <Kbd>A</Kbd></Button>
    </div>
  );
}

function UpNext({ jobs }: { jobs: PendingJob[] }) {
  return (
    <aside className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-muted-foreground">Up next</h3>
      <ul aria-label="Up next" className="flex flex-col gap-2">
        {jobs.map((j) => (
          <li key={keyOf(j)} className="rounded-lg border border-border bg-card px-3 py-2">
            <p className="text-sm font-medium">{j.company}</p>
            <p className="text-xs text-muted-foreground">{j.role}{j.fit ? ` · ${j.fit}` : ""}</p>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Progress({ reviewed, total }: { reviewed: number; total: number }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span>Reviewed {reviewed} of {total}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-muted" role="progressbar" aria-label="Triage progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={reviewed}>
        <div className="h-full bg-primary" style={{ width: `${total ? (reviewed / total) * 100 : 0}%` }} />
      </div>
      <span className="hidden sm:inline">P pass · A add · S or → skip · ← back</span>
    </div>
  );
}

/** `startAt` opens the triage on that job (from the list) instead of the first one in the queue. */
type TriageViewProps = { pending: PendingJob[]; onUpdate: () => void; onBackToBoard: () => void; startAt?: PendingJob; board?: JobsData };

const sameJob = (a: PendingJob, b: PendingJob) => (a.id && b.id ? a.id === b.id : a.company === b.company && a.role === b.role);

export default function TriageView({ pending, onUpdate, onBackToBoard, startAt, board }: TriageViewProps) {
  const { current, upNext, reviewed, total, act, pressed } = useTriage(pending, onUpdate, startAt ? Math.max(0, pending.findIndex((j) => sameJob(j, startAt))) : 0);
  const scoring = useScorePending(pending, onUpdate);
  useTriageKeys(act);

  if (!current) {
    return (
      <Card padding="none">
        <EmptyState icon={<Inbox />} title="All caught up" description="New finds from scrapes and agents show up here." action={<Button onClick={onBackToBoard} variant="outline">Back to board</Button>} />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Progress reviewed={reviewed} total={total} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <Card variant="raised" padding="lg" className="gap-6">
          <JobCard job={current} scoring={scoring} history={board ? companyHistory(board, current) : []} />
          <ActionBar act={act} pressed={pressed} />
        </Card>
        <UpNext jobs={upNext} />
      </div>
    </div>
  );
}
