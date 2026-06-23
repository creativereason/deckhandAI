"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { PendingJob, JobFit } from "@/lib/jobs";

const FIT_OPTIONS: { value: JobFit; label: string }[] = [
  { value: "strong", label: "Strong" },
  { value: "good", label: "Good" },
  { value: "caution", label: "Caution" },
  { value: "weak", label: "Weak" },
];

const FIT_STYLES: Record<JobFit, string> = {
  strong: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  good: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  caution: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  weak: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
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

export default function ScrapeReviewQueue({ pending, onUpdate }: Props) {
  // Only AI-derived overrides live in state; base defaults come from the pending record
  const [scores, setScores] = useState<Record<string, ScoreState>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  // Track which keys we've already attempted to score (avoids double-fires from StrictMode / re-renders)
  const scoredRef = useRef<Set<string>>(new Set());

  // Auto-score items that don't already have a rationale
  useEffect(() => {
    const toScore = pending.filter((j) => {
      const k = jobKey(j);
      return !j.scoreRationale && !scoredRef.current.has(k);
    });
    if (toScore.length === 0) return;

    for (const j of toScore) scoredRef.current.add(jobKey(j));

    // Mark as scoring (async setState — no synchronous set in effect body)
    const scoringPatch: Record<string, ScoreState> = {};
    for (const j of toScore) {
      scoringPatch[jobKey(j)] = { fit: "good", notes: "", rationale: "", scoring: true };
    }
    setScores((prev) => ({ ...prev, ...scoringPatch }));

    Promise.all(
      toScore.map(async (j) => {
        const k = jobKey(j);
        try {
          const res = await fetch("/api/score-fit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company: j.company,
              role: j.role,
              salary: j.salary || undefined,
              notes: j.notes || undefined,
              url: j.url || undefined,
            }),
          });
          if (!res.ok) throw new Error(await res.text());
          const data = await res.json() as { fit: JobFit; rationale: string };
          setScores((prev) => ({
            ...prev,
            [k]: { fit: data.fit, notes: "", rationale: data.rationale ?? "", scoring: false },
          }));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Try to parse JSON error body
          let detail = msg;
          try { detail = JSON.parse(msg).error ?? msg; } catch { /* use raw */ }
          setScores((prev) => ({
            ...prev,
            [k]: { ...(prev[k] ?? { fit: "good", notes: "" }), rationale: `Score unavailable: ${detail}`, scoring: false },
          }));
        }
      })
    );
  }, [pending]);

  if (pending.length === 0) return null;

  function getScore(j: PendingJob): ScoreState {
    const k = jobKey(j);
    return scores[k] ?? { fit: "good", notes: "", rationale: j.scoreRationale ?? "", scoring: false };
  }

  function patchScore(j: PendingJob, patch: Partial<ScoreState>) {
    const k = jobKey(j);
    setScores((prev) => ({ ...prev, [k]: { ...getScore(j), ...prev[k], ...patch } }));
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
        if (res.status === 403) {
          toast.info("Demo mode — changes are read-only");
          return;
        }
        throw new Error(body.error ?? `Error ${res.status}`);
      }
      toast.success(action === "approve" ? `Added ${j.company} to tracker` : `Dismissed ${j.company}`);
      onUpdate();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
    }
  }

  async function approveAll() {
    for (const j of pending) await act(j, "approve");
  }

  async function rejectAll() {
    for (const j of pending) await act(j, "reject");
  }

  return (
    <div className="bg-white dark:bg-p-dark-surface rounded-xl shadow-sm border border-amber-200 dark:border-amber-700">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 dark:border-amber-800">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs font-bold">
            {pending.length}
          </span>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Scrape review queue
          </h2>
          <span className="text-xs text-p-dusk dark:text-gray-400 hidden sm:inline">
            Approve to add to tracker, dismiss to skip
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={rejectAll}
            className="text-xs text-p-dusk dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors px-2 py-1"
          >
            Dismiss all
          </button>
          <button
            onClick={approveAll}
            className="text-xs bg-p-blue dark:bg-p-accent-inv text-white rounded-lg px-3 py-1 hover:bg-p-navy dark:hover:opacity-90 transition-colors"
          >
            Approve all
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-50 dark:divide-gray-800">
        {pending.map((j) => {
          const k = jobKey(j);
          const score = getScore(j);
          const loading = busy[k];

          return (
            <div key={k} className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{j.company}</span>
                  <span className="text-p-dusk dark:text-gray-400 text-xs">—</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{j.role}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${j.scrapeGroup === "local" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                    {j.scrapeGroup}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {j.url && (
                    <a href={j.url} target="_blank" rel="noreferrer" className="text-xs text-p-accent dark:text-p-accent-inv hover:underline truncate max-w-[260px]">
                      View posting ↗
                    </a>
                  )}
                  <span className="text-xs text-p-dusk dark:text-gray-500">{j.scrapeDate}</span>
                  {j.salary && <span className="text-xs text-p-dusk dark:text-gray-500">{j.salary}</span>}
                </div>
                {score.scoring && (
                  <p className="mt-1.5 text-xs text-p-dusk dark:text-gray-400 italic flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                    Scoring…
                  </p>
                )}
                {!score.scoring && score.rationale && (
                  <p className="mt-1.5 text-xs text-p-dusk dark:text-gray-400 italic">{score.rationale}</p>
                )}
              </div>

              {/* Fit + actions */}
              <div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:flex-col sm:items-end">
                <div className="flex items-center gap-1 shrink-0">
                  {FIT_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => patchScore(j, { fit: f.value })}
                      className={`text-xs px-2 py-1 rounded transition-colors ${score.fit === f.value ? FIT_STYLES[f.value] : "text-p-dusk dark:text-gray-500 hover:bg-p-linen dark:hover:bg-p-dark-mid"}`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => act(j, "reject")}
                    disabled={loading}
                    className="text-xs text-p-dusk dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors px-2 py-1 disabled:opacity-40"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => act(j, "approve")}
                    disabled={loading}
                    className="text-xs bg-p-blue dark:bg-p-accent-inv text-white rounded px-3 py-1 hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-40 transition-colors"
                  >
                    {loading ? "…" : "Approve"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
