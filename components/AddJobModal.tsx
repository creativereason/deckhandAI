"use client";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import JobFormModal from "@/components/JobFormModal";
import {
  evaluateJobUrl,
  evaluationMissingIdentity,
  addEvaluationToPending,
  type EvaluationPayload,
} from "@/lib/evaluate-job-client";

interface Props {
  onClose: () => void;
  onAdded: () => void;
}

type Mode = "url" | "manual";

export default function AddJobModal({ onClose, onAdded }: Props) {
  const [mode, setMode] = useState<Mode>("url");

  if (mode === "manual") {
    return (
      <JobFormModal
        mode="add"
        section="prospect"
        onClose={onClose}
        onSaved={onAdded}
        secondaryAction={{ label: "Paste a URL instead", onClick: () => setMode("url") }}
      />
    );
  }

  return <UrlEvaluateForm onClose={onClose} onAdded={onAdded} onSwitchToManual={() => setMode("manual")} />;
}

function UrlEvaluateForm({ onClose, onAdded, onSwitchToManual }: {
  onClose: () => void;
  onAdded: () => void;
  onSwitchToManual: () => void;
}) {
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationPayload | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim() || pending) return;
    setPending(true);
    setError("");
    setStatusText("");
    try {
      const result = await evaluateJobUrl(url.trim(), setStatusText);
      setEvaluation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Job evaluation failed");
    } finally {
      setPending(false);
      setStatusText("");
    }
  }

  async function confirmAdd() {
    if (!evaluation || saving || evaluationMissingIdentity(evaluation)) return;
    setSaving(true);
    setError("");
    try {
      await addEvaluationToPending(evaluation);
      toast.success("Added to pending for review");
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add job to pending");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-p-light dark:bg-p-dark-surface rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Job</h2>
          <button
            type="button"
            onClick={onSwitchToManual}
            className="text-xs text-p-accent dark:text-p-accent-inv hover:underline"
          >
            Enter details manually
          </button>
        </div>

        {!evaluation && (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">
                Job posting URL
              </label>
              <input
                autoFocus
                required
                type="url"
                placeholder="https://..."
                className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={pending}
              />
              <p className="mt-1.5 text-xs text-stone-400 dark:text-gray-500">
                We&apos;ll fetch the description, summarize the role, and score fit before adding it to pending.
              </p>
            </div>

            {pending && (
              <p className="text-xs text-stone-400 dark:text-gray-500 italic">{statusText || "Working…"}</p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-p-linen dark:border-p-dark-mid rounded-lg py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-p-linen dark:hover:bg-p-dark-mid"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !url.trim()}
                className="flex-1 bg-p-blue dark:bg-p-accent-inv text-white rounded py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Evaluating…" : "Evaluate"}
              </button>
            </div>
          </form>
        )}

        {evaluation && (
          <div className="space-y-3">
            <div className="rounded-lg border border-p-linen dark:border-p-dark-mid p-3 space-y-2 bg-p-linen/40 dark:bg-p-dark-mid/40">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {evaluation.role || "Role"} at {evaluation.company || "Company"}
              </p>
              <p className="text-xs text-p-dusk dark:text-gray-400">
                Fit: <strong>{evaluation.fit}</strong>
              </p>
              {evaluation.scoreRationale && (
                <p className="text-xs text-gray-600 dark:text-gray-300">{evaluation.scoreRationale}</p>
              )}
              {evaluation.notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{evaluation.notes}</p>
              )}
              {evaluation.retrieval?.retrieval_limited && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {evaluation.retrieval.warning ?? "Automatic retrieval was limited — review before adding."}
                </p>
              )}
            </div>

            {evaluationMissingIdentity(evaluation) && (
              <p className="text-xs text-stone-400 dark:text-gray-500">
                Couldn&apos;t detect company/role automatically — switch to manual entry instead.
              </p>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEvaluation(null)}
                className="flex-1 border border-p-linen dark:border-p-dark-mid rounded-lg py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-p-linen dark:hover:bg-p-dark-mid"
              >
                Back
              </button>
              <button
                type="button"
                onClick={confirmAdd}
                disabled={saving || evaluationMissingIdentity(evaluation)}
                className="flex-1 bg-p-blue dark:bg-p-accent-inv text-white rounded py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Adding…" : "Add to pending"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
