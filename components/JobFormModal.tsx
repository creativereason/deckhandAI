"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  JobSection,
  JobFit,
  JobStatus,
  AppliedJob,
  ProspectJob,
  PassedJob,
} from "@/lib/jobs";
import { getAppliedIcon, getProspectIcon, getSignalLabel } from "@/lib/job-signal";

type JobRecord = AppliedJob | ProspectJob | PassedJob;

const SECTIONS: { value: JobSection; label: string }[] = [
  { value: "prospect", label: "Prospect (remote)" },
  { value: "local", label: "Local / Hybrid" },
  { value: "staffing", label: "Staffing / Contract" },
  { value: "applied", label: "Applied" },
  { value: "passed", label: "Passed" },
];

interface Props {
  mode: "add" | "edit";
  section: JobSection;
  job?: JobRecord;
  originalCompany?: string;
  originalRole?: string;
  onClose: () => void;
  onSaved: () => void;
}

function jobToForm(section: JobSection, job?: JobRecord) {
  const base = {
    company: job?.company ?? "",
    role: job?.role ?? "",
    salary: job?.salary ?? "",
    notes: job?.notes ?? "",
    url: job?.url ?? "",
    fit: "good" as JobFit,
    status: "applied" as JobStatus,
    date: new Date().toISOString().split("T")[0],
  };

  if (section === "applied" && job) {
    const j = job as AppliedJob;
    return { ...base, status: j.status ?? "applied", date: j.date || base.date };
  }
  if ((section === "prospect" || section === "local" || section === "staffing") && job) {
    const j = job as ProspectJob;
    return { ...base, fit: j.fit ?? "good" };
  }
  return base;
}

function buildJobPayload(section: JobSection, form: ReturnType<typeof jobToForm>): Record<string, string> {
  if (section === "applied") {
    return {
      company: form.company,
      role: form.role,
      status: form.status,
      date: form.date,
      salary: form.salary,
      notes: form.notes,
      url: form.url,
    };
  }
  if (section === "passed") {
    return {
      company: form.company,
      role: form.role,
      salary: form.salary,
      notes: form.notes,
      url: form.url,
    };
  }
  return {
    company: form.company,
    role: form.role,
    fit: form.fit,
    salary: form.salary,
    notes: form.notes,
    url: form.url,
  };
}

export default function JobFormModal({
  mode,
  section: initialSection,
  job,
  originalCompany,
  originalRole,
  onClose,
  onSaved,
}: Props) {
  const [section, setSection] = useState<JobSection>(initialSection);
  const [form, setForm] = useState(() => jobToForm(initialSection, job));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreRationale, setScoreRationale] = useState<string>("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function scoreFit() {
    if (!form.company || !form.role) return;
    setScoring(true);
    setScoreRationale("");
    try {
      const res = await fetch("/api/score-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: form.company,
          role: form.role,
          salary: form.salary || undefined,
          notes: form.notes || undefined,
          url: form.url || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as { fit: JobFit; rationale: string };
      set("fit", data.fit);
      setScoreRationale(data.rationale ?? "");
    } catch {
      setScoreRationale("Could not score — check AI settings.");
    } finally {
      setScoring(false);
    }
  }

  function onSectionChange(next: JobSection) {
    setSection(next);
    setForm(jobToForm(next, job));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = buildJobPayload(section, form);

    try {
      if (mode === "add") {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section, job: payload }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to add job");
        }
      } else {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/jobs`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section: initialSection,
            company: originalCompany ?? job?.company,
            role: originalRole ?? job?.role,
            updates: payload,
            targetSection: section !== initialSection ? section : undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to save job");
        }
      }
      toast.success(mode === "add" ? "Job added" : "Changes saved");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-p-light dark:bg-p-dark-surface rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {mode === "add" ? "Add Job" : "Edit Job"}
          </h2>
          {(() => {
            const icon =
              section === "applied"
                ? getAppliedIcon({ status: form.status, date: form.date, notes: form.notes })
                : section === "prospect" || section === "local"
                ? getProspectIcon({ fit: form.fit })
                : "🔴";
            return (
              <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                <span className="text-xl leading-none">{icon}</span>
                <span>{getSignalLabel(icon)}</span>
              </span>
            );
          })()}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">Section</label>
            <select
              className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
              value={section}
              onChange={(e) => onSectionChange(e.target.value as JobSection)}
            >
              {SECTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">Company</label>
            <input
              required
              className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">Role</label>
            <input
              required
              className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
            />
          </div>

          {(section === "prospect" || section === "local" || section === "staffing") && (
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">Fit</label>
                <button
                  type="button"
                  onClick={scoreFit}
                  disabled={scoring || !form.company || !form.role}
                  className="text-xs text-p-accent dark:text-p-accent-inv hover:underline disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {scoring ? (
                    <>
                      <span className="inline-block w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                      Scoring…
                    </>
                  ) : "AI score"}
                </button>
              </div>
              <select
                className="w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
                value={form.fit}
                onChange={(e) => set("fit", e.target.value)}
              >
                <option value="strong">Strong</option>
                <option value="good">Good</option>
                <option value="caution">Caution</option>
                <option value="weak">Weak</option>
              </select>
              {scoreRationale && (
                <p className="mt-1.5 text-xs text-p-dusk dark:text-gray-400 italic">{scoreRationale}</p>
              )}
            </div>
          )}

          {section === "applied" && (
            <>
              <div>
                <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">Status</label>
                <select
                  className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="applied">Applied</option>
                  <option value="screening">Screening</option>
                  <option value="interview">Interview</option>
                  <option value="offer">Offer</option>
                  <option value="declined">Declined</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">Date Applied</label>
                <input
                  type="date"
                  className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
                  value={form.date}
                  onChange={(e) => set("date", e.target.value)}
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">Salary</label>
            <input
              className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
              placeholder="$150k–$200k"
              value={form.salary}
              onChange={(e) => set("salary", e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">URL</label>
            <input
              className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
              placeholder="https://..."
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-semibold text-p-dusk dark:text-gray-400 uppercase tracking-widest">Notes</label>
            <textarea
              className="mt-1 w-full border border-p-linen dark:border-p-dark-mid rounded-lg px-3 py-2 text-sm bg-white dark:bg-p-dark-mid dark:text-white"
              rows={3}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

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
            disabled={saving}
            className="flex-1 bg-p-blue dark:bg-p-accent-inv text-white dark:text-white rounded py-2 text-sm font-semibold hover:bg-p-navy dark:hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : mode === "add" ? "Add Job" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
