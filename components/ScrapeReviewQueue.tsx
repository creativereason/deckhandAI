"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { groupBadgeVariant } from "@/lib/job-badges";
import type { PendingJob, JobFit } from "@/lib/jobs";

const FIT_OPTIONS: { value: JobFit; label: string }[] = [
  { value: "strong", label: "Strong" },
  { value: "good", label: "Good" },
  { value: "caution", label: "Caution" },
  { value: "weak", label: "Weak" },
];

const FIT_ACTIVE_STYLES: Record<JobFit, string> = {
  strong: "bg-tone-success/15 text-tone-success",
  good: "bg-primary/10 text-primary",
  caution: "bg-tone-warning/20 text-tone-warning",
  weak: "bg-destructive/10 text-destructive",
};

interface ScoreState {
  fit: JobFit;
  notes: string;
  rationale: string;
  scoring: boolean;
}

interface Props {
  pending: PendingJob[];
  onUpdate: () => void;
}

function jobKey(j: PendingJob) {
  return `${j.company}|${j.role}`;
}

function FitSelector({ score, onFit }: { score: ScoreState; onFit: (f: JobFit) => void }) {
  return (
    <div className="flex items-center gap-1">
      {FIT_OPTIONS.map((f) => (
        <button
          key={f.value}
          onClick={() => onFit(f.value)}
          className={`text-xs px-2 py-1 rounded transition-colors ${score.fit === f.value ? FIT_ACTIVE_STYLES[f.value] : "text-muted-foreground hover:bg-muted"}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function ActionButtons({ loading, onApprove, onReject }: { loading: boolean; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onReject}
        disabled={loading}
        className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 disabled:opacity-40"
      >
        Dismiss
      </button>
      <Button onClick={onApprove} loading={loading} size="xs">
        Approve
      </Button>
    </div>
  );
}

export default function ScrapeReviewQueue({ pending, onUpdate }: Props) {
  const [scores, setScores] = useState<Record<string, ScoreState>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [batchScoring, setBatchScoring] = useState(false);
  const batchFiredRef = useRef(false);

  useEffect(() => {
    const hasUnscored = pending.some((j) => !j.scoreRationale);
    if (!hasUnscored || batchFiredRef.current) return;

    batchFiredRef.current = true;
    setBatchScoring(true);

    fetch("/api/scrape/score-pending", { method: "POST" })
      .then(() => onUpdate())
      .catch(() => { /* soft-fail — jobs show without scores */ })
      .finally(() => setBatchScoring(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const visible = pending.filter((j) => !dismissed.has(jobKey(j)));
  if (visible.length === 0) return null;

  function getScore(j: PendingJob): ScoreState {
    const k = jobKey(j);
    if (scores[k]) return scores[k];
    return {
      fit: j.fit ?? "good",
      notes: "",
      rationale: j.scoreRationale ?? "",
      scoring: batchScoring && !j.scoreRationale,
    };
  }

  function patchScore(j: PendingJob, patch: Partial<ScoreState>) {
    setScores((prev) => ({ ...prev, [jobKey(j)]: { ...getScore(j), ...prev[jobKey(j)], ...patch } }));
  }

  async function act(j: PendingJob, action: "approve" | "reject") {
    const k = jobKey(j);
    setBusy((b) => ({ ...b, [k]: true }));
    try {
      const score = getScore(j);
      const res = await fetch("/api/scrape/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: j.company,
          role: j.role,
          action,
          fit: score.fit,
          notes: score.notes || undefined,
          scoreRationale: score.rationale || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        if (res.status === 403) { toast.info("Demo mode — changes are read-only"); return; }
        throw new Error(body.error ?? `Error ${res.status}`);
      }
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
    <div className="bg-card rounded-xl shadow-sm border border-tone-warning/30">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-tone-warning/20 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-tone-warning/15 text-tone-warning text-xs font-bold">
            {visible.length}
          </span>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Scrape review queue</h2>
          <span className="text-xs text-muted-foreground hidden sm:inline">— approve to add, dismiss to skip</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={rejectAll} variant="ghost" size="xs">
            Dismiss all
          </Button>
          <Button onClick={approveAll} size="xs">
            Approve all
          </Button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-gray-50 dark:divide-gray-800">
        {visible.map((j) => {
          const score = getScore(j);
          const loading = busy[jobKey(j)];
          return (
            <div key={jobKey(j)} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 dark:text-white text-base">{j.company}</span>
                    <Badge variant={groupBadgeVariant(j.scrapeGroup)} className="rounded font-medium">{j.scrapeGroup}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{j.role}</p>
                </div>
                {j.url && (
                  <a href={j.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline shrink-0">↗</a>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                {j.salary && <span>{j.salary}</span>}
                <span>{j.scrapeDate}</span>
              </div>
              {score.scoring && (
                <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                  Scoring…
                </p>
              )}
              {!score.scoring && score.rationale && (
                <p className="text-xs text-muted-foreground italic">{score.rationale}</p>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-border gap-2 flex-wrap">
                <FitSelector score={score} onFit={(f) => patchScore(j, { fit: f })} />
                <ActionButtons loading={loading} onApprove={() => act(j, "approve")} onReject={() => act(j, "reject")} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop rows */}
      <div className="hidden lg:block divide-y divide-gray-50 dark:divide-gray-800">
        {visible.map((j) => {
          const score = getScore(j);
          const loading = busy[jobKey(j)];
          return (
            <div key={jobKey(j)} className="px-5 py-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{j.company}</span>
                  <span className="text-muted-foreground text-xs">—</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{j.role}</span>
                  <Badge variant={groupBadgeVariant(j.scrapeGroup)} className="rounded font-medium">{j.scrapeGroup}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {j.url && (
                    <a href={j.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate max-w-[260px]">
                      View posting ↗
                    </a>
                  )}
                  <span className="text-xs text-muted-foreground">{j.scrapeDate}</span>
                  {j.salary && <span className="text-xs text-muted-foreground">{j.salary}</span>}
                </div>
                {score.scoring && (
                  <p className="mt-1.5 text-xs text-muted-foreground italic flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                    Scoring…
                  </p>
                )}
                {!score.scoring && score.rationale && (
                  <p className="mt-1.5 text-xs text-muted-foreground italic">{score.rationale}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <FitSelector score={score} onFit={(f) => patchScore(j, { fit: f })} />
                <ActionButtons loading={loading} onApprove={() => act(j, "approve")} onReject={() => act(j, "reject")} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
