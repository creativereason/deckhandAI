"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScorePending } from "@/components/use-score-pending";
import { fitBadgeVariant, groupBadgeVariant } from "@/lib/job-badges";
import type { PendingJob } from "@/lib/jobs";
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

function useTriage(pending: PendingJob[], onUpdate: () => void) {
  const [offset, setOffset] = useState(0);
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
    toast.success(action === "approve" ? `Kept ${current.company}` : `Passed on ${current.company}`);
    setOffset(settleOffset(offset, queue.length));
    setGone((prev) => new Set(prev).add(keyOf(current)));
    onUpdate();
  }

  function act(action: TriageAction) {
    flash(action);
    if (action === "keep") void review("approve");
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
  return <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{children}</kbd>;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</h3>
      {children}
    </div>
  );
}

function Verdict({ job, scoring }: { job: PendingJob; scoring: boolean }) {
  if (!job.fit) return <p className="text-sm text-muted-foreground italic">{scoring ? "Scoring…" : "Not scored yet"}</p>;
  return (
    <div className="space-y-2">
      <Badge variant={fitBadgeVariant(job.fit)} className="capitalize">{job.fit} fit</Badge>
      {job.scoreRationale && <p className="text-sm leading-relaxed text-foreground/90">{job.scoreRationale}</p>}
    </div>
  );
}

function JobCard({ job, scoring }: { job: PendingJob; scoring: boolean }) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {job.company}
          <Badge variant={groupBadgeVariant(job.scrapeGroup)} className="rounded font-medium">{job.scrapeGroup}</Badge>
        </p>
        <h2 className="text-3xl font-semibold leading-tight tracking-tight">{job.role}</h2>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {job.salary && <span>{job.salary}</span>}
          <span>Found {job.scrapeDate}</span>
          {job.url && <a href={job.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">View posting ↗</a>}
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <Section label="At a glance"><p className="text-sm leading-relaxed">{job.aiSummary ?? "No summary yet."}</p></Section>
        <Section label="Fit"><Verdict job={job} scoring={scoring} /></Section>
      </div>
      {job.notes && (
        <Section label="From the posting">
          <p className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">{job.notes}</p>
        </Section>
      )}
    </div>
  );
}

function ActionBar({ act, pressed }: { act: (action: TriageAction) => void; pressed: TriageAction | null }) {
  const mark = (action: TriageAction) => ({
    "data-pressed": pressed === action ? "true" : undefined,
    className: "transition-transform duration-150 data-[pressed=true]:scale-95 data-[pressed=true]:ring-2 data-[pressed=true]:ring-primary data-[pressed=true]:ring-offset-2",
  });
  return (
    <div className="grid grid-cols-3 gap-3">
      <Button variant="outline" size="lg" onClick={() => act("pass")} {...mark("pass")}>Pass <Kbd>P</Kbd></Button>
      <Button variant="outline" size="lg" onClick={() => act("skip")} {...mark("skip")}>Skip <Kbd>S</Kbd></Button>
      <Button size="lg" onClick={() => act("keep")} {...mark("keep")}>Keep <Kbd>K</Kbd></Button>
    </div>
  );
}

function UpNext({ jobs }: { jobs: PendingJob[] }) {
  return (
    <aside className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Up next</h3>
      <ul aria-label="Up next" className="space-y-2">
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
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={reviewed}>
        <div className="h-full bg-primary" style={{ width: `${total ? (reviewed / total) * 100 : 0}%` }} />
      </div>
      <span className="hidden sm:inline">P pass · K keep · S or → skip · ← back</span>
    </div>
  );
}

export default function TriageView({ pending, onUpdate, onBackToBoard }: { pending: PendingJob[]; onUpdate: () => void; onBackToBoard: () => void }) {
  const { current, upNext, reviewed, total, act, pressed } = useTriage(pending, onUpdate);
  const scoring = useScorePending(pending, onUpdate);
  useTriageKeys(act);

  if (!current) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card px-6 py-10 text-center shadow-sm">
        <p className="text-sm font-medium">All caught up</p>
        <p className="text-xs text-muted-foreground">New finds from scrapes and agents show up here.</p>
        <Button onClick={onBackToBoard} variant="outline" size="sm">Back to board</Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Progress reviewed={reviewed} total={total} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <JobCard job={current} scoring={scoring} />
          <ActionBar act={act} pressed={pressed} />
        </section>
        <UpNext jobs={upNext} />
      </div>
    </div>
  );
}
