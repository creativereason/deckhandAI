"use client";
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type JobsData,
  type AppliedJob,
  type ProspectJob,
  type PassedJob,
  type JobSection,
  type JobType,
  type JobFit,
  type JobStatus,
  resolveJobType,
} from "@/lib/jobs";
import { MarkdownContent } from "@/components/MarkdownContent";
import AIGenerationCard from "@/components/AIGenerationCard";
import AppShell from "@/components/shell/AppShell";
import { AIInsight, AssistantPanel, PromptChip } from "@/components/ai/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { typeBadgeVariant } from "@/lib/job-badges";
import { findJobForDetail, jobDetailHref } from "@/lib/job-detail";
import { fetchAiSummary, fetchSummarizerConfigured } from "@/lib/summarize-job-client";
import { ChevronDown, ExternalLink, FileSearch, Pencil } from "lucide-react";
import { JOBS_CHANGED_EVENT } from "@/components/shell/assistant-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnyJob = AppliedJob | ProspectJob | PassedJob;
type ClientMsg = { role: "user" | "assistant"; content: string };

const SECTION_LABELS: Record<JobSection, string> = {
  applied: "Applied",
  prospect: "Prospects",
  local: "Local / Hybrid",
  staffing: "Staffing",
  passed: "Passed",
  pending: "Pending",
};

// ─── Inline edit form ─────────────────────────────────────────────────────────

interface EditFormProps {
  job: AnyJob;
  section: JobSection;
  onCancel: () => void;
  onSaved: () => void;
}

function InlineEditForm({ job, section, onCancel, onSaved }: EditFormProps) {
  const isApplied = section === "applied";
  const isProspect = section === "prospect" || section === "local" || section === "staffing";

  const [company, setCompany] = useState(job.company);
  const [role, setRole] = useState(job.role);
  const [salary, setSalary] = useState(job.salary ?? "");
  const [url, setUrl] = useState(job.url ?? "");
  const [notes, setNotes] = useState(job.notes ?? "");
  const [aiSummary, setAiSummary] = useState(job.aiSummary ?? "");
  const [summarizerReady, setSummarizerReady] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryHint, setSummaryHint] = useState("");
  const [status, setStatus] = useState((job as AppliedJob).status ?? "applied");
  const [date, setDate] = useState((job as AppliedJob).date ?? "");
  const [fit, setFit] = useState((job as ProspectJob).fit ?? "good");
  const [jobType, setJobType] = useState<JobType>(() => resolveJobType(section, job));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSummarizerConfigured().then(setSummarizerReady);
  }, []);

  async function regenerateSummary() {
    if (!company || !role) return;
    setSummarizing(true);
    setSummaryHint("");
    try {
      const summary = await fetchAiSummary({
        company,
        role,
        salary: salary || undefined,
        notes: notes || undefined,
      });
      if (!summary) {
        setSummaryHint("Nothing to summarize yet — add some notes first.");
        return;
      }
      setAiSummary(summary);
    } catch {
      setSummaryHint("Could not generate a summary — check AI settings.");
    } finally {
      setSummarizing(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const updates: Record<string, unknown> = { company, role, salary, url, notes, aiSummary, type: jobType };
    if (isApplied) { updates.status = status; updates.date = date; }
    if (isProspect) { updates.fit = fit; }

    const res = await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: job.id, section, company: job.company, role: job.role, updates }),
    });

    if (!res.ok) {
      if (res.status === 403) { onSaved(); return; }
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Save failed");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" required>{(p) => <Input {...p} value={company} onChange={(e) => setCompany(e.target.value)} />}</Field>
        <Field label="Role" required>{(p) => <Input {...p} value={role} onChange={(e) => setRole(e.target.value)} />}</Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Salary">{(p) => <Input {...p} value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="e.g. $180,000–$220,000" />}</Field>
        <Field label="Type">
          {(p) => (
            <Select {...p} value={jobType} onChange={(e) => setJobType(e.target.value as JobType)}>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="local">Local</option>
              <option value="contract">Contract</option>
            </Select>
          )}
        </Field>
      </div>

      {isApplied && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            {(p) => (
              <Select {...p} value={status} onChange={(e) => setStatus(e.target.value as JobStatus)}>
                <option value="applied">Applied</option>
                <option value="screening">Screening</option>
                <option value="interview">Interview</option>
                <option value="offer">Offer</option>
                <option value="declined">Declined</option>
              </Select>
            )}
          </Field>
          <Field label="Date applied">{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        </div>
      )}

      {isProspect && (
        <Field label="Fit">
          {(p) => (
            <Select {...p} value={fit} onChange={(e) => setFit(e.target.value as JobFit)}>
              <option value="strong">Strong</option>
              <option value="good">Good</option>
              <option value="caution">Caution</option>
              <option value="weak">Weak</option>
            </Select>
          )}
        </Field>
      )}

      <Field label="Job posting URL">{(p) => <Input {...p} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />}</Field>

      <div className="flex flex-col gap-2">
        <Field label="At-a-glance summary" hint={summaryHint || "Shown on the board card and in the header above."}>
          {(p) => <Textarea {...p} value={aiSummary} onChange={(e) => setAiSummary(e.target.value)} rows={2} placeholder="1–2 sentence summary of the role and company" className="min-h-16" />}
        </Field>
        {summarizerReady && (
          <div>
            <Button type="button" variant="ai" size="sm" onClick={regenerateSummary} disabled={!company || !role} loading={summarizing}>
              {summarizing ? "Generating…" : "Regenerate with AI"}
            </Button>
          </div>
        )}
      </div>

      <Field label="Notes">{(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Add notes, context, or paste the job description…" />}</Field>

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" loading={saving}>Save changes</Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ─── Inline chat ──────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  list_jobs: "Reading job board…",
  add_job: "Adding job…",
  update_job: "Updating job…",
  move_job: "Moving job…",
  fetch_job_description: "Fetching job description…",
};

function buildPrompts(section: JobSection, status?: string): string[] {
  if (status === "interview") return [
    "What questions should I prepare?",
    "What should I ask them?",
    "What salary should I negotiate for?",
    "What are the red flags here?",
  ];
  if (status === "offer") return [
    "How should I evaluate this offer?",
    "What should I negotiate?",
    "What questions before deciding?",
    "How does this compare to my other options?",
  ];
  if (status === "screening") return [
    "What should I emphasize on this call?",
    "What questions should I prepare?",
    "How do I stand out at this stage?",
    "What do I need to research first?",
  ];
  return [
    "Should I apply to this role?",
    "What should I highlight?",
    "What questions might they ask?",
    "How does this fit my background?",
  ];
}

type EvaluationPayload = {
  company: string;
  role: string;
  salary: string;
  notes: string;
  fit?: JobFit;
  scoreRationale?: string;
  retrieval: {
    retrieval_limited: boolean;
    warning?: string;
  };
};

type PendingNotesRefresh = {
  id?: string;
  company: string;
  role: string;
  updates: Record<string, unknown>;
};

function contextValue(context: string, label: string): string {
  const line = context.split("\n").find((item) => item.startsWith(`${label}: `));
  return line?.slice(label.length + 2).trim() ?? "";
}

function shouldRefreshNotesFromUrl(text: string): boolean {
  const n = text.toLowerCase();
  // "update/refresh/fetch notes"
  if (/\b(refresh|update|fetch)\b/.test(n) && n.includes("notes")) return true;
  // "retrieve/pull/get from web/url/online/posting"
  if (/\b(retrieve|pull|fetch)\b/.test(n) && /\b(web|url|online|site|posting|page)\b/.test(n)) return true;
  // "all of it / everything / all details" combined with any retrieval signal
  if (/\b(all|everything|details?)\b/.test(n) && /\b(retrieve|web|url|refresh|fetch)\b/.test(n)) return true;
  return false;
}

function parseSseBlock(block: string): { event: string; data: unknown } | null {
  const event = block.match(/^event:\s*(.+)$/m)?.[1];
  const rawData = block.match(/^data:\s*(.+)$/m)?.[1];
  if (!event || rawData === undefined) return null;
  return { event, data: JSON.parse(rawData) as unknown };
}

function JobChat({
  jobContext,
  jobId,
  section,
  status,
  onJobsChanged,
}: {
  jobContext: string;
  jobId?: string;
  section: JobSection;
  status?: string;
  onJobsChanged: () => void;
}) {
  const [messages, setMessages] = useState<ClientMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [notesRefresh, setNotesRefresh] = useState<PendingNotesRefresh | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prompts = buildPrompts(section, status);
  const hasDraftOrThread = messages.length > 0 || input.trim().length > 0 || !!error;

  // Scroll the chat body, never the page: scrollIntoView would drag every scroll ancestor along.
  useEffect(() => {
    const el = bodyRef.current;
    if (el && messages.length > 0) el.scrollTop = el.scrollHeight;
  }, [messages, statusText]);

  const readEvaluationStream = useCallback(async (body: ReadableStream<Uint8Array>): Promise<EvaluationPayload> => {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) throw new Error("Evaluation finished without a result");
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const parsed = parseSseBlock(block);
        if (!parsed) continue;
        if (parsed.event === "status" && typeof parsed.data === "string") setStatusText(parsed.data);
        if (parsed.event === "error") throw new Error(String(parsed.data));
        if (parsed.event === "result") return parsed.data as EvaluationPayload;
      }
    }
  }, []);

  const refreshNotesFromUrl = useCallback(async (): Promise<string> => {
    const url = contextValue(jobContext, "URL");
    const company = contextValue(jobContext, "Company");
    const role = contextValue(jobContext, "Role");
    if (!url || !company || !role) return "I need a company, role, and URL on this job before I can refresh notes.";

    const res = await fetch("/api/evaluate-job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, company, role }),
    });
    if (!res.ok || !res.body) throw new Error("Could not evaluate the job URL");
    const evaluation = await readEvaluationStream(res.body);
    if (
      evaluation.retrieval.retrieval_limited ||
      evaluation.notes.includes("Notes unchanged")
    ) {
      return evaluation.retrieval.warning ?? "No relevant job description found at the URL (page appears changed or blocked). Notes unchanged.";
    }

    const updates: Record<string, unknown> = { notes: evaluation.notes };
    if (evaluation.salary) updates.salary = evaluation.salary;
    if (evaluation.scoreRationale) updates.scoreRationale = evaluation.scoreRationale;
    if ((section === "prospect" || section === "local" || section === "staffing") && evaluation.fit) {
      updates.fit = evaluation.fit;
    }

    setNotesRefresh({ id: jobId, company, role, updates });
    return `Here's what I found:\n\n${evaluation.notes}\n\nApply to update the notes, or cancel to keep what you have.`;
  }, [jobContext, jobId, readEvaluationStream, section]);

  async function applyNotesRefresh() {
    if (!notesRefresh) return;
    setError("");
    const updateRes = await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notesRefresh.id, section, company: notesRefresh.company, role: notesRefresh.role, updates: notesRefresh.updates }),
    });
    if (!updateRes.ok) {
      setError("Could not update this job");
      return;
    }
    setNotesRefresh(null);
    onJobsChanged();
  }

  function cancelNotesRefresh() {
    setNotesRefresh(null);
  }

  const send = useCallback(async (text: string) => {
    if (!text.trim() || pending) return;
    setError("");
    setNotesRefresh(null);
    const userMsg: ClientMsg = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setPending(true);
    setStatusText("");
    let assistantText = "";
    let toolsCalled = false;

    try {
      if (shouldRefreshNotesFromUrl(text)) {
        const refreshedText = await refreshNotesFromUrl();
        setMessages([...nextMessages, { role: "assistant", content: refreshedText }]);
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, jobContext }),
      });
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as { type: string; text?: string; name?: string; message?: string };
            if (ev.type === "tool_call" && ev.name) {
              toolsCalled = true;
              setStatusText(TOOL_LABELS[ev.name] ?? "Working…");
            }
            else if (ev.type === "text" && ev.text) assistantText = ev.text;
            else if (ev.type === "error") throw new Error(ev.message);
          } catch { /* skip */ }
        }
      }
      if (assistantText) setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
      if (toolsCalled) onJobsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
      setStatusText("");
    }
  }, [messages, pending, jobContext, onJobsChanged, refreshNotesFromUrl]);

  function startOver() {
    if (pending) return;
    setMessages([]);
    setInput("");
    setStatusText("");
    setError("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const composer = (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); send(input); }} className="flex gap-2">
      <Input ref={inputRef} aria-label="Ask about this role" value={input} onChange={(e) => setInput(e.target.value)} disabled={pending} placeholder="Ask about this role…" />
      <Button type="submit" disabled={!input.trim()} loading={pending} className="shrink-0">Send</Button>
    </form>
  );

  return (
    <AssistantPanel
      title="Discuss this role"
      subtitle="Interview prep, offer analysis, fit questions"
      footer={composer}
      headerActions={hasDraftOrThread ? <Button type="button" variant="ghost" size="sm" onClick={startOver} disabled={pending}>Start over</Button> : undefined}
      bodyRef={bodyRef}
      className="max-h-[70dvh]"
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-start gap-2">
          {prompts.map((p) => <PromptChip key={p} onClick={() => send(p)}>{p}</PromptChip>)}
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
          <div className={m.role === "user" ? "max-w-[90%] rounded-lg bg-primary px-3 py-2 text-primary-foreground" : "max-w-[90%] rounded-lg bg-muted px-3 py-2 text-foreground"}>
            {m.role === "user" ? <p className="text-sm whitespace-pre-wrap">{m.content}</p> : <MarkdownContent text={m.content} />}
          </div>
        </div>
      ))}

      {pending && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1">
          {statusText && <p className="text-xs text-muted-foreground">{statusText}</p>}
          <p className="text-xs text-muted-foreground">Working…</p>
        </div>
      )}
      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
      {notesRefresh && !pending && (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={applyNotesRefresh}>Apply</Button>
          <Button type="button" variant="outline" size="sm" onClick={cancelNotesRefresh}>Cancel</Button>
        </div>
      )}
    </AssistantPanel>
  );
}

// ─── Main detail view ─────────────────────────────────────────────────────────

function JobDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const target = {
    id: searchParams.get("id") ?? undefined,
    company: searchParams.get("company") ?? "",
    role: searchParams.get("role") ?? "",
  };
  const section = (searchParams.get("section") ?? "applied") as JobSection;

  const [jobs, setJobs] = useState<JobsData | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const [jobsRes, profileRes] = await Promise.all([
      fetch("/api/jobs", { cache: "no-store" }),
      fetch("/api/profile", { cache: "no-store" }),
    ]);
    setJobs(await jobsRes.json());
    const profile = await profileRes.json() as { name?: string };
    setHasProfile(!!profile?.name);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  if (!jobs) return <LoadingState label="Loading job" />;

  const sectionData = (jobs[section] ?? []) as AnyJob[];
  const job = findJobForDetail(sectionData, target);

  if (!job) {
    return (
      <Card padding="none">
        <EmptyState icon={<FileSearch />} title="Job not found" description="It may have been moved, renamed or removed." action={<Button variant="outline" onClick={() => router.push("/")}>Back to board</Button>} />
      </Card>
    );
  }

  const foundJob = job as AnyJob;
  // The URL may be stale after an edit renamed the job, so use the stored values.
  const { company, role } = foundJob;
  const isApplied = section === "applied";
  const isProspect = section === "prospect" || section === "local" || section === "staffing";
  const appliedJob = isApplied ? (foundJob as AppliedJob) : null;
  const prospectJob = isProspect ? (foundJob as ProspectJob) : null;
  const effectiveType = resolveJobType(section, foundJob as ProspectJob | AppliedJob);

  const DISPLAY_SECTIONS = [
    { value: "applied" as JobSection, label: "Applied" },
    { value: "prospect" as JobSection, label: "Prospects" },
    { value: "passed" as JobSection, label: "Passed" },
  ];
  const moveSections = DISPLAY_SECTIONS.filter((s) =>
    isProspect ? s.value !== "prospect" : s.value !== section
  );

  async function moveJob(target: JobSection) {
    await fetch("/api/jobs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: foundJob.id, section, company, role, targetSection: target }),
    });
    router.push("/");
  }

  async function refreshAfterChatChange() {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    const nextJobs = await res.json() as JobsData;
    setJobs(nextJobs);
    window.dispatchEvent(new Event(JOBS_CHANGED_EVENT));

    const sameSection = (nextJobs[section] ?? []) as AnyJob[];
    if (findJobForDetail(sameSection, foundJob)) return;
    if (!foundJob.url) return;

    const updated = sameSection.find((j) => j.url === foundJob.url);
    if (!updated) return;
    router.replace(jobDetailHref({ ...updated, section }));
  }

  const jobContext = [
    `Company: ${company}`, `Role: ${role}`, `Section: ${section}`,
    appliedJob?.status ? `Status: ${appliedJob.status}` : null,
    appliedJob?.date ? `Applied: ${appliedJob.date}` : null,
    prospectJob?.fit ? `Fit: ${prospectJob.fit}` : null,
    effectiveType ? `Type: ${effectiveType}` : null,
    foundJob.salary ? `Salary: ${foundJob.salary}` : null,
    foundJob.url ? `URL: ${foundJob.url}` : null,
    foundJob.aiSummary ? `Role summary: ${foundJob.aiSummary}` : null,
    foundJob.notes ? `Notes: ${foundJob.notes}` : null,
    prospectJob?.scoreRationale ? `AI Assessment: ${prospectJob.scoreRationale}` : null,
  ].filter(Boolean).join("\n");

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Board", href: "/" }, { label: SECTION_LABELS[section] }, { label: `${foundJob.company} — ${foundJob.role}` }]}
        title={foundJob.company}
        description={foundJob.role}
        actions={
          <>
            {foundJob.url && (
              <Button variant="outline" nativeButton={false} render={<a href={foundJob.url} target="_blank" rel="noreferrer" />}>
                View posting<ExternalLink aria-hidden /><span className="sr-only">(opens in a new tab)</span>
              </Button>
            )}
            {moveSections.length > 0 && (
              <Menu>
                <MenuTrigger render={<Button variant="outline" />}>Move to<ChevronDown aria-hidden /></MenuTrigger>
                <MenuContent>{moveSections.map((s) => <MenuItem key={s.value} onClick={() => moveJob(s.value)}>{s.label}</MenuItem>)}</MenuContent>
              </Menu>
            )}
            <Button onClick={() => setEditing((e) => !e)} variant={editing ? "secondary" : "default"}><Pencil aria-hidden />{editing ? "Cancel edit" : "Edit"}</Button>
          </>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {appliedJob?.status && <StatusBadge kind="status" value={appliedJob.status} />}
            {prospectJob?.fit && <StatusBadge kind="fit" value={prospectJob.fit} />}
            {effectiveType && <Badge variant={typeBadgeVariant(effectiveType)} className="capitalize">{effectiveType}</Badge>}
            {foundJob.salary && <Badge variant="neutral">{foundJob.salary}</Badge>}
            {appliedJob?.date && <Badge variant="neutral">Applied {appliedJob.date}</Badge>}
          </div>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
          {foundJob.aiSummary && <AIInsight label="AI summary">{foundJob.aiSummary}</AIInsight>}

          {editing ? (
            <Card>
              <CardHeader><CardTitle as="h2">Edit job</CardTitle></CardHeader>
              <InlineEditForm job={foundJob} section={section} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
            </Card>
          ) : (
            <>
              {foundJob.notes && (
                <Card>
                  <CardHeader><CardTitle as="h2">Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm whitespace-pre-wrap">{foundJob.notes}</p></CardContent>
                </Card>
              )}
              {prospectJob?.scoreRationale && <AIInsight label="AI fit assessment">{prospectJob.scoreRationale}</AIInsight>}
              {!foundJob.notes && !prospectJob?.scoreRationale && (
                <Card padding="none"><EmptyState compact title="No notes yet" description="Edit this job to add context, or paste the job description." action={<Button variant="outline" onClick={() => setEditing(true)}>Add notes</Button>} /></Card>
              )}
            </>
          )}

          <AIGenerationCard company={company} role={role} url={foundJob.url} hasProfile={hasProfile} />
        </div>

        <div className="min-w-0 lg:sticky lg:top-20 lg:col-span-2">
          <JobChat jobContext={jobContext} jobId={foundJob.id} section={section} status={appliedJob?.status} onJobsChanged={refreshAfterChatChange} />
        </div>
      </div>
    </>
  );
}

// ─── Page (Suspense required for useSearchParams) ─────────────────────────────

export default function JobPage() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingState label="Loading job" />}>
        <JobDetailContent />
      </Suspense>
    </AppShell>
  );
}
