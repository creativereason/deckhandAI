"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListGroup, ListRow } from "@/components/ui/list-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { useScorePending } from "@/components/use-score-pending";
import { groupBadgeVariant } from "@/lib/job-badges";
import { submitReview } from "@/lib/review-client";
import type { PendingJob, JobFit } from "@/lib/jobs";

const FIT_OPTIONS: { value: JobFit; label: string }[] = [
  { value: "strong", label: "Strong" },
  { value: "good", label: "Good" },
  { value: "caution", label: "Caution" },
  { value: "weak", label: "Weak" },
];

interface ScoreState {
  fit: JobFit;
  notes: string;
  rationale: string;
  scoring: boolean;
}

interface Props {
  pending: PendingJob[];
  onUpdate: () => void;
  /** Opens this job in the one-at-a-time triage view. */
  onOpen?: (job: PendingJob) => void;
}

function jobKey(j: PendingJob) {
  return `${j.company}|${j.role}`;
}

function FitSelector({ company, score, onFit }: { company: string; score: ScoreState; onFit: (f: JobFit) => void }) {
  return <SegmentedControl<JobFit> label={`Fit for ${company}`} value={score.fit} onChange={onFit} options={FIT_OPTIONS} />;
}

function ActionButtons({ company, loading, onApprove, onReject }: { company: string; loading: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={onReject} disabled={loading} aria-label={`Dismiss ${company}`}>Dismiss</Button>
      <Button size="sm" onClick={onApprove} loading={loading} aria-label={`Approve ${company}`}>Approve</Button>
    </div>
  );
}

export default function ScrapeReviewQueue({ pending, onUpdate, onOpen }: Props) {
  const [scores, setScores] = useState<Record<string, ScoreState>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const batchScoring = useScorePending(pending, onUpdate);

  const visible = pending.filter((j) => !dismissed.has(jobKey(j)));
  if (visible.length === 0) return null;

  function getScore(j: PendingJob): ScoreState {
    const k = jobKey(j);
    if (scores[k]) return scores[k];
    return { fit: j.fit ?? "good", notes: "", rationale: j.scoreRationale ?? "", scoring: batchScoring && !j.scoreRationale };
  }

  function patchScore(j: PendingJob, patch: Partial<ScoreState>) {
    setScores((prev) => ({ ...prev, [jobKey(j)]: { ...getScore(j), ...prev[jobKey(j)], ...patch } }));
  }

  async function act(j: PendingJob, action: "approve" | "reject") {
    const k = jobKey(j);
    setBusy((b) => ({ ...b, [k]: true }));
    try {
      const score = getScore(j);
      const result = await submitReview({ job: j, action, fit: score.fit, notes: score.notes || undefined, scoreRationale: score.rationale || undefined });
      if (!result.ok && result.demo) { toast.info("Demo mode — changes are read-only"); return; }
      if (!result.ok) throw new Error(result.message);
      toast.success(action === "approve" ? `Added ${j.company} to tracker` : `Dismissed ${j.company}`);
      setDismissed((prev) => new Set([...prev, k]));
      onUpdate();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
    }
  }

  async function approveAll() { for (const j of visible) await act(j, "approve"); }
  async function rejectAll() { for (const j of visible) await act(j, "reject"); }

  return (
    <Card padding="none">
      <CardHeader className="flex-wrap items-center p-4">
        <div className="flex items-center gap-2">
          <Badge variant="solid">{visible.length}</Badge>
          <CardTitle as="h2">Scrape review queue</CardTitle>
          <span className="hidden text-sm text-muted-foreground sm:inline">Approve to add, dismiss to skip</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={rejectAll} variant="ghost" size="sm">Dismiss all</Button>
          <Button onClick={approveAll} size="sm">Approve all</Button>
        </div>
      </CardHeader>
      <ListGroup className="rounded-none border-x-0 border-b-0">
        {visible.map((j) => {
          const score = getScore(j);
          const loading = !!busy[jobKey(j)];
          return (
            <ListRow
              key={jobKey(j)}
              title={onOpen ? <button type="button" onClick={() => onOpen(j)} aria-label={`Review ${j.company}, ${j.role}`} className="font-medium text-foreground underline-offset-4 hover:underline">{j.company}</button> : j.company}
              meta={j.role}
              trailing={<Badge variant={groupBadgeVariant(j.scrapeGroup)}>{j.scrapeGroup}</Badge>}
              actions={onOpen ? <Button variant="outline" size="sm" onClick={() => onOpen(j)} aria-label={`Open ${j.company} in triage`}>Triage<ArrowRight aria-hidden /></Button> : undefined}
            >
              <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                {j.salary && <span>{j.salary}</span>}
                <span>{j.scrapeDate}</span>
                {j.url && <a href={j.url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4 hover:no-underline">View posting<span className="sr-only"> for {j.company} (opens in a new tab)</span></a>}
              </p>
              {score.scoring && <p role="status" className="text-xs text-muted-foreground">Scoring…</p>}
              {!score.scoring && score.rationale && <p className="text-xs text-ai-subtle-foreground">{score.rationale}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <FitSelector company={j.company} score={score} onFit={(f) => patchScore(j, { fit: f })} />
                <ActionButtons company={j.company} loading={loading} onApprove={() => act(j, "approve")} onReject={() => act(j, "reject")} />
              </div>
            </ListRow>
          );
        })}
      </ListGroup>
    </Card>
  );
}
