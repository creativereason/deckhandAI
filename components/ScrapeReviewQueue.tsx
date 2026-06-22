"use client";
import { useState } from "react";
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

interface Props {
  pending: PendingJob[];
  onUpdate: () => void;
}

export default function ScrapeReviewQueue({ pending, onUpdate }: Props) {
  const [selected, setSelected] = useState<Record<string, { fit: JobFit; notes: string }>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  if (pending.length === 0) return null;

  function key(j: PendingJob) {
    return `${j.company}|${j.role}`;
  }

  function getState(j: PendingJob) {
    return selected[key(j)] ?? { fit: "good" as JobFit, notes: "" };
  }

  function updateState(j: PendingJob, patch: Partial<{ fit: JobFit; notes: string }>) {
    setSelected((prev) => ({ ...prev, [key(j)]: { ...getState(j), ...patch } }));
  }

  async function act(j: PendingJob, action: "approve" | "reject") {
    const k = key(j);
    setBusy((b) => ({ ...b, [k]: true }));
    try {
      const state = getState(j);
      const res = await fetch("/api/scrape/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: j.company,
          role: j.role,
          action,
          fit: state.fit,
          notes: state.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(action === "approve" ? `Added ${j.company} to tracker` : `Dismissed ${j.company}`);
      onUpdate();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy((b) => ({ ...b, [k]: false }));
    }
  }

  async function approveAll() {
    for (const j of pending) {
      await act(j, "approve");
    }
  }

  async function rejectAll() {
    for (const j of pending) {
      await act(j, "reject");
    }
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
          <span className="text-xs text-p-dusk dark:text-gray-400">
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
          const k = key(j);
          const state = getState(j);
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
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {j.url && (
                    <a href={j.url} target="_blank" rel="noreferrer" className="text-xs text-p-accent dark:text-p-accent-inv hover:underline truncate max-w-[260px]">
                      View posting ↗
                    </a>
                  )}
                  <span className="text-xs text-p-dusk dark:text-gray-500">{j.scrapeDate}</span>
                </div>
              </div>

              {/* Fit + actions row on mobile */}
              <div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:flex-col sm:items-end">

              {/* Fit selector */}
              <div className="flex items-center gap-1 shrink-0">
                {FIT_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => updateState(j, { fit: f.value })}
                    className={`text-xs px-2 py-1 rounded transition-colors ${state.fit === f.value ? FIT_STYLES[f.value] : "text-p-dusk dark:text-gray-500 hover:bg-p-linen dark:hover:bg-p-dark-mid"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Actions */}
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

              </div>{/* end mobile fit+actions wrapper */}
            </div>
          );
        })}
      </div>
    </div>
  );
}
