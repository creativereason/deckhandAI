"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  JobSection,
  JobFit,
  JobStatus,
  JobType,
  AppliedJob,
  ProspectJob,
  PassedJob,
  resolveJobType,
} from "@/lib/jobs";
import { getAppliedIcon, getProspectIcon, getSignalLabel } from "@/lib/job-signal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchAiSummary, fetchSummarizerConfigured } from "@/lib/summarize-job-client";

type JobRecord = AppliedJob | ProspectJob | PassedJob;
type Board = "applied" | "prospects" | "passed";

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "local", label: "Local" },
  { value: "contract", label: "Contract" },
];

function boardFromSection(section: JobSection): Board {
  if (section === "applied") return "applied";
  if (section === "passed") return "passed";
  return "prospects";
}

function sectionFromBoardAndType(board: Board, jobType: JobType): JobSection {
  if (board === "applied") return "applied";
  if (board === "passed") return "passed";
  if (jobType === "contract") return "staffing";
  if (jobType === "hybrid" || jobType === "local") return "local";
  return "prospect";
}

interface Props {
  mode: "add" | "edit";
  section: JobSection;
  job?: JobRecord;
  originalCompany?: string;
  originalRole?: string;
  onClose: () => void;
  onSaved: () => void;
  secondaryAction?: { label: string; onClick: () => void };
}

function jobToForm(section: JobSection, job?: JobRecord) {
  const base = {
    company: job?.company ?? "",
    role: job?.role ?? "",
    salary: job?.salary ?? "",
    notes: job?.notes ?? "",
    url: job?.url ?? "",
    aiSummary: job?.aiSummary ?? "",
    fit: "good" as JobFit,
    status: "applied" as JobStatus,
    date: new Date().toISOString().split("T")[0],
  };

  if (section === "applied" && job) {
    const j = job as AppliedJob;
    return { ...base, status: j.status ?? "applied", date: j.date || base.date, isGhost: j.isGhost ?? false };
  }
  if ((section === "prospect" || section === "local" || section === "staffing") && job) {
    const j = job as ProspectJob;
    return { ...base, fit: j.fit ?? "good" };
  }
  return base;
}

function buildJobPayload(section: JobSection, form: ReturnType<typeof jobToForm>): Record<string, unknown> {
  if (section === "applied") {
    return {
      company: form.company,
      role: form.role,
      status: form.status,
      date: form.date,
      salary: form.salary,
      notes: form.notes,
      url: form.url,
      aiSummary: form.aiSummary,
      isGhost: (form as { isGhost?: boolean }).isGhost ?? false,
    };
  }
  if (section === "passed") {
    return {
      company: form.company,
      role: form.role,
      salary: form.salary,
      notes: form.notes,
      url: form.url,
      aiSummary: form.aiSummary,
    };
  }
  return {
    company: form.company,
    role: form.role,
    fit: form.fit,
    salary: form.salary,
    notes: form.notes,
    url: form.url,
    aiSummary: form.aiSummary,
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
  secondaryAction,
}: Props) {
  const [board, setBoard] = useState<Board>(() => boardFromSection(initialSection));
  const [jobType, setJobType] = useState<JobType>(() => {
    const j = job as (ProspectJob & { type?: JobType }) | undefined;
    return resolveJobType(initialSection, j ?? {});
  });
  const section = sectionFromBoardAndType(board, jobType);
  const [form, setForm] = useState(() => jobToForm(initialSection, job));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [scoreRationale, setScoreRationale] = useState<string>("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Form state already holds every field for every board (unused ones are just
  // ignored by buildJobPayload), so a board change must NOT re-initialize the
  // form — doing so silently discarded in-progress edits (see ROADMAP bug).
  function onBoardChange(next: Board) {
    setBoard(next);
  }

  const [summarizerReady, setSummarizerReady] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryHint, setSummaryHint] = useState("");

  useEffect(() => {
    fetchSummarizerConfigured().then(setSummarizerReady);
  }, []);

  async function regenerateSummary() {
    if (!form.company || !form.role) return;
    setSummarizing(true);
    setSummaryHint("");
    try {
      const summary = await fetchAiSummary({
        company: form.company,
        role: form.role,
        salary: form.salary || undefined,
        notes: form.notes || undefined,
      });
      if (!summary) {
        setSummaryHint("Nothing to summarize yet — add some notes first.");
        return;
      }
      set("aiSummary", summary);
    } catch {
      setSummaryHint("Could not generate a summary — check AI settings.");
    } finally {
      setSummarizing(false);
    }
  }

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = { ...buildJobPayload(section, form), type: jobType };

    try {
      if (mode === "add") {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ section, job: payload }),
        });
        if (!res.ok) {
          if (res.status === 403) { toast.info("Demo mode — changes are read-only"); onClose(); return; }
          const data = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(data.error ?? "Failed to add job");
        }
      } else {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/jobs`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: job?.id,
            section: initialSection,
            company: originalCompany ?? job?.company,
            role: originalRole ?? job?.role,
            updates: payload,
            targetSection: section !== initialSection ? section : undefined,
          }),
        });
        if (!res.ok) {
          if (res.status === 403) { toast.info("Demo mode — changes are read-only"); onClose(); return; }
          const data = await res.json().catch(() => ({})) as { error?: string };
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

  const isProspect = board === "prospects";
  const signal = board === "applied"
    ? getAppliedIcon({ status: form.status, date: form.date, notes: form.notes })
    : isProspect ? getProspectIcon({ fit: form.fit }) : "";
  const signalLabel = signal ? getSignalLabel(signal, isProspect ? "prospect" : "applied") : "";
  const formId = "job-form";

  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose(); }}>
      <ModalContent
        title={mode === "add" ? "Add job" : "Edit job"}
        description={signalLabel || undefined}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" form={formId} loading={saving}>{saving ? "Saving…" : mode === "add" ? "Add Job" : "Save Changes"}</Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {secondaryAction && (
            <div className="sm:col-span-2">
              <Button type="button" variant="link" size="sm" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>
            </div>
          )}

          <Field label="Board" className={board === "passed" ? "sm:col-span-2" : undefined}>
            {(p) => (
              <Select {...p} value={board} onChange={(e) => onBoardChange(e.target.value as Board)}>
                <option value="applied">Applied</option>
                <option value="prospects">Prospects</option>
                <option value="passed">Passed</option>
              </Select>
            )}
          </Field>

          {board !== "passed" && (
            <Field label="Type">
              {(p) => (
                <Select {...p} value={jobType} onChange={(e) => setJobType(e.target.value as JobType)}>
                  {JOB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              )}
            </Field>
          )}

          <Field label="Company" required>{(p) => <Input {...p} value={form.company} onChange={(e) => set("company", e.target.value)} />}</Field>
          <Field label="Role" required>{(p) => <Input {...p} value={form.role} onChange={(e) => set("role", e.target.value)} />}</Field>

          {board === "prospects" && (
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Field label="Fit" hint={scoreRationale || undefined}>
                {(p) => (
                  <Select {...p} value={form.fit} onChange={(e) => set("fit", e.target.value)}>
                    <option value="strong">Strong</option>
                    <option value="good">Good</option>
                    <option value="caution">Caution</option>
                    <option value="weak">Weak</option>
                  </Select>
                )}
              </Field>
              <div><Button type="button" variant="ai" size="sm" onClick={scoreFit} disabled={!form.company || !form.role} loading={scoring}>{scoring ? "Scoring…" : "Score fit with AI"}</Button></div>
            </div>
          )}

          {board === "applied" && (
            <>
              <Field label="Status">
                {(p) => (
                  <Select {...p} value={form.status} onChange={(e) => set("status", e.target.value)}>
                    <option value="applied">Applied</option>
                    <option value="screening">Screening</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="declined">Declined</option>
                  </Select>
                )}
              </Field>
              <Field label="Date applied">{(p) => <Input {...p} type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />}</Field>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <Checkbox
                  label="Ghost job risk"
                  checked={(form as { isGhost?: boolean }).isGhost ?? false}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isGhost: checked }))}
                />
                <p className="text-xs text-muted-foreground">Flag if this posting looks like a ghost job or has been reposted repeatedly.</p>
              </div>
            </>
          )}

          <Field label="Salary">{(p) => <Input {...p} placeholder="$150k–$200k" value={form.salary} onChange={(e) => set("salary", e.target.value)} />}</Field>
          <Field label="URL">{(p) => <Input {...p} placeholder="https://…" value={form.url} onChange={(e) => set("url", e.target.value)} />}</Field>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Field label="At-a-glance summary" hint={summaryHint || "Shown on the board card and job detail header."}>
              {(p) => <Textarea {...p} rows={2} className="min-h-16" placeholder="1–2 sentence summary of the role and company" value={form.aiSummary} onChange={(e) => set("aiSummary", e.target.value)} />}
            </Field>
            {summarizerReady && (
              <div><Button type="button" variant="ai" size="sm" onClick={regenerateSummary} disabled={!form.company || !form.role} loading={summarizing}>{summarizing ? "Generating…" : "Regenerate with AI"}</Button></div>
            )}
          </div>

          <Field label="Notes" className="sm:col-span-2">{(p) => <Textarea {...p} rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />}</Field>

          {error && <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">{error}</p>}
        </form>
      </ModalContent>
    </Modal>
  );
}
