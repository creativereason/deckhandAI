"use client";
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
import { getAppliedIcon, getProspectIcon } from "@/lib/job-signal";
import { SignalIcon } from "@/components/SignalIcon";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/MarkdownContent";
import AIGenerationCard from "@/components/AIGenerationCard";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fitBadgeVariant, statusBadgeVariant, typeBadgeVariant } from "@/lib/job-badges";
import { fetchAiSummary, fetchSummarizerConfigured } from "@/lib/summarize-job-client";

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

// ─── Styles ───────────────────────────────────────────────────────────────────

function Chip({ label, variant }: { label: string; variant: Parameters<typeof Badge>[0]["variant"] }) {
  return (
    <Badge variant={variant} className="capitalize shrink-0 h-auto px-2.5 py-1">
      {label}
    </Badge>
  );
}

// ─── Field components ─────────────────────────────────────────────────────────

const inputCls = "w-full text-sm bg-muted rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-stone-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary/30 transition";
const labelCls = "block text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelCls}>{label}</label>{children}</div>;
}

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
      body: JSON.stringify({ section, company: job.company, role: job.role, updates }),
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
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company">
          <input value={company} onChange={(e) => setCompany(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Role">
          <input value={role} onChange={(e) => setRole(e.target.value)} required className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Salary">
          <input value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="e.g. $180,000–$220,000" className={inputCls} />
        </Field>
        <Field label="Type">
          <select value={jobType} onChange={(e) => setJobType(e.target.value as JobType)} className={inputCls}>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="local">Local</option>
            <option value="contract">Contract</option>
          </select>
        </Field>
      </div>

      {isApplied && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as JobStatus)} className={inputCls}>
              <option value="applied">Applied</option>
              <option value="screening">Screening</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="declined">Declined</option>
            </select>
          </Field>
          <Field label="Date applied">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </Field>
        </div>
      )}

      {isProspect && (
        <Field label="Fit">
          <select value={fit} onChange={(e) => setFit(e.target.value as JobFit)} className={inputCls}>
            <option value="strong">Strong</option>
            <option value="good">Good</option>
            <option value="caution">Caution</option>
            <option value="weak">Weak</option>
          </select>
        </Field>
      )}

      <Field label="Job posting URL">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className={inputCls} />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={cn(labelCls, "mb-0")}>At-a-glance summary</label>
          {summarizerReady && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={regenerateSummary}
              disabled={!company || !role}
              loading={summarizing}
              className="text-xs"
            >
              {summarizing ? "Generating…" : "↻ Regenerate"}
            </Button>
          )}
        </div>
        <textarea
          value={aiSummary}
          onChange={(e) => setAiSummary(e.target.value)}
          rows={2}
          placeholder="1–2 sentence summary of the role and company"
          className={cn(inputCls, "resize-none")}
        />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {summaryHint || "Shown on the board card and in the header above."}
        </p>
      </div>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Add notes, context, or paste the job description…"
          className={cn(inputCls, "resize-none")}
        />
      </Field>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
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
  section,
  status,
  onJobsChanged,
}: {
  jobContext: string;
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prompts = buildPrompts(section, status);
  const hasDraftOrThread = messages.length > 0 || input.trim().length > 0 || !!error;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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

    setNotesRefresh({ company, role, updates });
    return `Here's what I found:\n\n${evaluation.notes}\n\nApply to update the notes, or cancel to keep what you have.`;
  }, [jobContext, readEvaluationStream, section]);

  async function applyNotesRefresh() {
    if (!notesRefresh) return;
    setError("");
    const updateRes = await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, company: notesRefresh.company, role: notesRefresh.role, updates: notesRefresh.updates }),
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

  return (
    <div className="flex flex-col gap-3 min-h-0">
      {hasDraftOrThread && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="xs" onClick={startOver} disabled={pending} className="text-[11px]">
            Start over
          </Button>
        </div>
      )}

      {/* Prompt chips */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {prompts.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-primary bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 max-h-64">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[90%] rounded-2xl px-3 py-2 rounded-tl-sm",
                m.role === "user"
                  ? "bg-primary text-white rounded-tr-sm rounded-tl-2xl"
                  : "bg-muted text-gray-900 dark:text-white"
              )}>
                {m.role === "user"
                  ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  : <MarkdownContent text={m.content} />
                }
              </div>
            </div>
          ))}
          {pending && (
            <div className="pl-1 space-y-1">
              {statusText && <p className="text-[11px] text-muted-foreground italic">{statusText}</p>}
              <div className="flex items-center gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-gray-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {notesRefresh && !pending && (
            <div className="flex items-center gap-2 pl-1">
              <Button type="button" size="sm" onClick={applyNotesRefresh}>
                Apply
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={cancelNotesRefresh}>
                Cancel
              </Button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); send(input); }} className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          placeholder="Ask about this role…"
          className="flex-1 text-sm bg-muted rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-stone-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 transition"
        />
        <Button type="submit" disabled={!input.trim()} loading={pending} className="shrink-0">
          Send
        </Button>
      </form>
    </div>
  );
}

// ─── Main detail view ─────────────────────────────────────────────────────────

function JobDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const company = searchParams.get("company") ?? "";
  const role = searchParams.get("role") ?? "";
  const section = (searchParams.get("section") ?? "applied") as JobSection;

  const [jobs, setJobs] = useState<JobsData | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);

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

  if (!jobs) {
    return <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">Loading…</div>;
  }

  const sectionData = (jobs[section] ?? []) as AnyJob[];
  const job = sectionData.find((j) => j.company === company && j.role === role);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-muted-foreground">
        <p className="text-sm">Job not found.</p>
        <Button onClick={() => router.push("/")} variant="link">← Back to board</Button>
      </div>
    );
  }

  const foundJob = job as AnyJob;
  const isApplied = section === "applied";
  const isProspect = section === "prospect" || section === "local" || section === "staffing";
  const appliedJob = isApplied ? (foundJob as AppliedJob) : null;
  const prospectJob = isProspect ? (foundJob as ProspectJob) : null;
  const effectiveType = resolveJobType(section, foundJob as ProspectJob | AppliedJob);

  const icon = isApplied
    ? getAppliedIcon(appliedJob!)
    : isProspect
    ? getProspectIcon(prospectJob!)
    : "🔴";

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
      body: JSON.stringify({ section, company, role, targetSection: target }),
    });
    router.push("/");
  }

  async function refreshAfterChatChange() {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    const nextJobs = await res.json() as JobsData;
    setJobs(nextJobs);

    const sameSection = (nextJobs[section] ?? []) as AnyJob[];
    if (sameSection.some((j) => j.company === company && j.role === role)) return;
    if (!foundJob.url) return;

    const updated = sameSection.find((j) => j.url === foundJob.url);
    if (!updated) return;
    const params = new URLSearchParams({ section, company: updated.company, role: updated.role });
    router.replace(`/job?${params.toString()}`);
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
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">

        {/* Header */}
        <AppHeader
          breadcrumbs={
            <>
              <Link href="/" className="hover:text-foreground transition-colors">Board</Link>
              <span className="opacity-60">/</span>
              <span>{SECTION_LABELS[section]}</span>
              <span className="opacity-60">/</span>
              <span className="text-foreground font-medium truncate max-w-[16rem]">
                {foundJob.company} — {foundJob.role}
              </span>
            </>
          }
        />

        {/* Back nav */}
        <Button
          onClick={() => router.push("/")}
          variant="link"
          className="flex items-center gap-1.5 text-sm group mb-5"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="group-hover:-translate-x-0.5 transition-transform">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Board
        </Button>

        {/* Header — full width */}
        <div className="bg-card rounded-2xl border border-border shadow-sm px-6 py-5 mb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span className="leading-none mt-0.5 shrink-0 flex items-center"><SignalIcon icon={icon} size={28} /></span>
              <div className="min-w-0 shrink-0 max-w-[24rem]">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{foundJob.company}</h1>
                <p className="text-base text-muted-foreground mt-0.5">{foundJob.role}</p>
              </div>
              {foundJob.aiSummary && (
                <p className="hidden sm:block flex-1 min-w-0 text-sm text-muted-foreground leading-relaxed border-l-2 border-border pl-4 mt-0.5">
                  {foundJob.aiSummary}
                </p>
              )}
            </div>
            {foundJob.url && (
              <a href={foundJob.url} target="_blank" rel="noreferrer"
                className="shrink-0 text-sm text-primary hover:underline flex items-center gap-1"
              >
                View posting
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            )}
          </div>
          {foundJob.aiSummary && (
            <p className="sm:hidden text-sm text-muted-foreground leading-relaxed mt-3">
              {foundJob.aiSummary}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {isApplied && appliedJob!.status && (
              <Chip label={appliedJob!.status} variant={statusBadgeVariant(appliedJob!.status)} />
            )}
            {isProspect && prospectJob!.fit && (
              <Chip label={prospectJob!.fit} variant={fitBadgeVariant(prospectJob!.fit)} />
            )}
            {effectiveType && <Chip label={effectiveType} variant={typeBadgeVariant(effectiveType)} />}
            {foundJob.salary && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-gray-700 dark:text-gray-300 shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="opacity-60"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                {foundJob.salary}
              </span>
            )}
            {isApplied && appliedJob!.date && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-gray-700 dark:text-gray-300 shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="opacity-60"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {appliedJob!.date}
              </span>
            )}
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

          {/* ── Left column ────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-5">
            {editing ? (
              <div className="bg-card rounded-2xl border border-border shadow-sm px-6 py-5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Edit</p>
                <InlineEditForm
                  job={foundJob}
                  section={section}
                  onCancel={() => setEditing(false)}
                  onSaved={() => { setEditing(false); load(); }}
                />
              </div>
            ) : (
              <>
                {foundJob.notes && (
                  <div className="bg-card rounded-2xl border border-border shadow-sm px-6 py-5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Notes</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{foundJob.notes}</p>
                  </div>
                )}

                {isProspect && prospectJob!.scoreRationale && (
                  <div className="bg-card rounded-2xl border border-border shadow-sm px-6 py-5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">AI Assessment</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 italic leading-relaxed">{prospectJob!.scoreRationale}</p>
                  </div>
                )}

                {!foundJob.notes && !prospectJob?.scoreRationale && (
                  <div className="bg-card rounded-2xl border border-border shadow-sm px-6 py-5">
                    <p className="text-sm text-muted-foreground italic">No notes yet. Click Edit to add context or paste the job description.</p>
                  </div>
                )}
              </>
            )}

            {/* AI Generation card */}
            <AIGenerationCard
              company={company}
              role={role}
              url={foundJob.url}
              hasProfile={hasProfile}
            />
          </div>

          {/* ── Right column — sticky ──────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5 lg:sticky lg:top-6">

            {/* Actions */}
            <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setEditing((e) => !e)} variant={editing ? "secondary" : "default"}>
                  {editing ? "Cancel edit" : "Edit"}
                </Button>
                {moveSections.length > 0 && (
                  <div className="relative">
                    <Button onClick={() => setMoveOpen((o) => !o)} variant="outline">
                      Move to ▾
                    </Button>
                    {moveOpen && (
                      <>
                        <div className="fixed inset-0 z-[100]" onClick={() => setMoveOpen(false)} />
                        <div className="absolute top-full left-0 mt-1 z-[101] bg-card border border-border rounded-xl shadow-xl min-w-[140px] py-1">
                          {moveSections.map((s) => (
                            <button key={s.value} onClick={() => { moveJob(s.value); setMoveOpen(false); }}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-muted"
                            >
                              → {s.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Chat */}
            <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-4">
              <div className="mb-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Discuss this role</p>
                <p className="text-xs text-muted-foreground mt-0.5">Interview prep, offer analysis, fit questions</p>
              </div>
              <JobChat jobContext={jobContext} section={section} status={appliedJob?.status} onJobsChanged={refreshAfterChatChange} />
            </div>

          </div>
        </div>

        {/* Footer */}
        <AppFooter />
      </div>
    </div>
  );
}

// ─── Page (Suspense required for useSearchParams) ─────────────────────────────

export default function JobPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-muted-foreground text-sm">Loading…</div>}>
      <JobDetailContent />
    </Suspense>
  );
}
