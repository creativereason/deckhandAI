"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link2, Ghost, ListPlus, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { jobDetailHref } from "@/lib/job-detail";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssistantPanel, PromptChip } from "@/components/ai/ai";
import {
  evaluateJobUrl as evaluateJobUrlRequest,
  evaluationMissingIdentity,
  addEvaluationToPending as putEvaluationToPending,
  type EvaluationPayload,
} from "@/lib/evaluate-job-client";
import { readSseStream } from "@/lib/sse-client";
import type { ScrapeLogEntry } from "@/lib/scrape-run";

type ClientMsg = { role: "user" | "assistant"; content: string };

type NdjsonEvent =
  | { type: "tool_call"; name: string }
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

const TOOL_LABELS: Record<string, string> = {
  read_profile: "Reading your profile…",
  list_jobs: "Reading job board…",
  add_job: "Adding job…",
  update_job: "Updating job…",
  move_job: "Moving job…",
  flag_ghost: "Flagging as ghost…",
  delete_job: "Deleting job…",
  fetch_job_description: "Fetching job description…",
  search_remote_jobs: "Searching RemoteOK…",
  detect_ghost_jobs: "Scanning for ghost jobs…",
};

const SUGGESTIONS_MOBILE = [
  "What have I applied to?",
  "Show strong prospects",
  "Add a job",
];

const SUGGESTIONS_DESKTOP = [
  "What have I applied to?",
  "Show strong prospects",
  "Move all declined to passed",
  "Add a job",
  "Flag a job as a ghost job",
];

const GHOST_SCAN_PROMPT = "Scan my board for ghost jobs and stale applications";
const SCRAPE_PROMPT = "Scrape for new jobs";
const EVALUATE_URL_PROMPT = "Evaluate this job URL: ";
const URL_PATTERN = /https?:\/\/\S+/;

const JOB_INTENT_PATTERN = /\b(evaluate|job|posting|role|apply|hiring)\b/i;

export function shouldEvaluateJobUrl(text: string): boolean {
  if (!extractUrl(text)) return false;
  if (text.startsWith(EVALUATE_URL_PROMPT)) return true;
  return JOB_INTENT_PATTERN.test(text);
}

function extractUrl(text: string): string | null {
  return text.match(URL_PATTERN)?.[0].replace(/[),.;]+$/, "") ?? null;
}

function formatEvaluation(evaluation: EvaluationPayload): string {
  const retrieval = evaluation.retrieval.retrieval_limited
    ? `\n\nRetrieval note: ${evaluation.retrieval.warning ?? "Automatic retrieval was limited."}`
    : "";
  const source = evaluation.retrieval.source_url ? `\n\nSource: ${evaluation.retrieval.source_url}` : "";
  return `**${evaluation.role || "Role"} at ${evaluation.company || "Company"}**\n\nFit: **${evaluation.fit}**\n\n${evaluation.scoreRationale || "Review the retrieved details before adding this job."}\n\n${evaluation.notes}${source}${retrieval}\n\nAdd this to pending when you're ready.`;
}

function formatLogLine(entry: ScrapeLogEntry): string {
  if (entry.status === "error") return `- ${entry.company}: failed — ${entry.error}`;
  return `- ${entry.company}: ${entry.listings} listings, ${entry.qualifying} qualifying, ${entry.added} new`;
}

type ScrapeApiResult = { added: number; log: ScrapeLogEntry[] };

function formatScrapeResult(result: ScrapeApiResult): string {
  const summary = result.added > 0
    ? `**${result.added} new job${result.added !== 1 ? "s" : ""}** added to the pending review queue.`
    : "Scrape complete — no new qualifying jobs found.";
  const lines = result.log.map(formatLogLine).join("\n");
  return lines ? `${summary}\n\n${lines}` : summary;
}


/** A prompt another part of the app wants the assistant to handle; `id` changes on every request so repeats still fire. */
export type AssistantRequest = { id: number; text: string; send: boolean; context?: { text: string; label: string } };

export default function ChatDrawer({ onJobsChanged, onClose, subtitle, request, onRequestHandled }: {
  onJobsChanged: () => void;
  onClose?: () => void;
  subtitle?: string;
  request?: AssistantRequest | null;
  /** Called once the request has been taken, so the host can drop it and a later reopen starts empty. */
  onRequestHandled?: () => void;
}) {
  const [messages, setMessages] = useState<ClientMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationPayload | null>(null);
  const [subject, setSubject] = useState<{ text: string; label: string } | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const handledRequest = useRef<number | null>(null);
  const hasDraftOrThread = messages.length > 0 || input.trim().length > 0 || !!error || !!evaluation;

  const appendStatus = useCallback((line: string) => {
    setStatusLines((lines) => [...lines, line]);
  }, []);

  // Scroll the message list itself, not the page: scrollIntoView() would drag every scroll ancestor along.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, statusLines, pending]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const evaluateJobUrl = useCallback(async (text: string): Promise<string> => {
    const url = extractUrl(text);
    if (!url) return "Paste the job posting URL after the prompt and I’ll evaluate it.";
    const result = await evaluateJobUrlRequest(url, appendStatus);
    setEvaluation(result);
    return formatEvaluation(result);
  }, [appendStatus]);

  const runScrapeNow = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    if (!res.ok || !res.body) throw new Error("Scrape failed");
    let result: ScrapeApiResult | null = null;
    await readSseStream(res.body, (event, data) => {
      if (event === "status" && typeof data === "string") appendStatus(data);
      if (event === "error") throw new Error(String(data));
      if (event === "result") result = data as ScrapeApiResult;
    });
    if (!result) throw new Error("No scrape result returned");
    const scrapeResult: ScrapeApiResult = result;
    if (scrapeResult.added > 0) onJobsChanged();
    return formatScrapeResult(scrapeResult);
  }, [appendStatus, onJobsChanged]);

  const send = useCallback(async (text: string, about: { text: string; label: string } | null = subject) => {
    if (!text.trim() || pending) return;
    setError("");
    setEvaluation(null);
    const userMsg: ClientMsg = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setPending(true);
    setStatusLines([]);

    let assistantText = "";
    let toolsCalled = false;

    try {
      if (text === SCRAPE_PROMPT) {
        const assistantText = await runScrapeNow();
        setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
        return;
      }

      if (shouldEvaluateJobUrl(text)) {
        const assistantText = await evaluateJobUrl(text);
        setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, ...(about ? { jobContext: about.text } : {}) }),
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
            const event = JSON.parse(line) as NdjsonEvent;
            if (event.type === "tool_call") {
              toolsCalled = true;
              appendStatus(TOOL_LABELS[event.name] ?? "Working…");
            } else if (event.type === "text") {
              assistantText = event.text;
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (assistantText) {
        setMessages([...nextMessages, { role: "assistant", content: assistantText }]);
      }
      if (toolsCalled) onJobsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
      setStatusLines([]);
    }
  }, [evaluateJobUrl, runScrapeNow, messages, pending, onJobsChanged, appendStatus, subject]);

  useEffect(() => {
    if (!request || handledRequest.current === request.id) return;
    handledRequest.current = request.id;
    onRequestHandled?.();
    setSubject(request.context ?? null);
    // A request from another screen is an external event: sending it (or filling the composer) is the sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (request.send) void send(request.text, request.context ?? null);
    else {
      setInput(request.text);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [request, send, onRequestHandled]);

  async function addEvaluationToPending() {
    if (!evaluation || pending || evaluationMissingIdentity(evaluation)) return;
    setPending(true);
    setError("");
    try {
      await putEvaluationToPending(evaluation);
      const href = jobDetailHref({ section: "pending", company: evaluation.company, role: evaluation.role });
      setMessages((current) => [
        ...current,
        { role: "assistant", content: `Added to pending for review.\n\n[View Job](${href})` },
      ]);
      setEvaluation(null);
      onJobsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add job to pending");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  function startOver() {
    if (pending) return;
    setMessages([]);
    setInput("");
    setStatusLines([]);
    setError("");
    setEvaluation(null);
    setSubject(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cueJobUrlEvaluation() {
    setInput(EVALUATE_URL_PROMPT);
    setError("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const composer = (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input ref={inputRef} aria-label="Message" value={input} onChange={(e) => setInput(e.target.value)} disabled={pending} placeholder="Message…" />
      <Button type="submit" disabled={!input.trim()} loading={pending}><Send aria-hidden />Send</Button>
    </form>
  );

  return (
    <AssistantPanel
      subtitle={subtitle ?? "Manage your job board by chat"}
      onClose={onClose}
      footer={composer}
      headerActions={hasDraftOrThread ? <Button type="button" variant="ghost" size="sm" onClick={startOver} disabled={pending}>Start over</Button> : undefined}
      bodyRef={messagesRef}
    >
      {subject && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-ai-subtle px-3 py-2 text-xs text-ai-subtle-foreground">
          <p className="min-w-0 truncate"><span className="font-semibold">About:</span> {subject.label}</p>
          <button type="button" onClick={() => setSubject(null)} aria-label={`Stop asking about ${subject.label}`} className="shrink-0 rounded-sm p-1 hover:bg-ai-subtle"><X className="size-4" aria-hidden /></button>
        </div>
      )}

      {messages.length === 0 && !pending && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col items-stretch gap-2">
            <PromptChip onClick={cueJobUrlEvaluation} title="Paste a job posting URL and I'll fetch the description, summarize the role, and help decide where it belongs."><Link2 className="size-4 shrink-0 text-ai" aria-hidden />Evaluate a job URL</PromptChip>
            <PromptChip onClick={() => send(GHOST_SCAN_PROMPT)} title="Scan your board for ghost jobs — stale applications, listings stuck in screening, and roles that keep getting reposted."><Ghost className="size-4 shrink-0 text-ai" aria-hidden />Scan for ghost jobs</PromptChip>
            <PromptChip onClick={() => send(SCRAPE_PROMPT)} title="Scan configured career pages for new qualifying roles and add them to the pending review queue."><ListPlus className="size-4 shrink-0 text-ai" aria-hidden />Scrape for new jobs</PromptChip>
          </div>
          <p className="text-xs text-muted-foreground">Or try asking:</p>
          <div className="flex flex-col items-stretch gap-2">
            {SUGGESTIONS_DESKTOP.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className={cn("min-h-10 rounded-md border border-border bg-card px-3 text-left text-sm text-foreground transition-colors duration-(--duration-fast) hover:bg-muted", i >= SUGGESTIONS_MOBILE.length && "hidden sm:block")}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
          <div className={cn("min-w-0 max-w-[85%] rounded-lg px-3 py-2 break-words", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
            {m.role === "user"
              ? <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              : <MarkdownContent text={m.content} />
            }
          </div>
        </div>
      ))}

      {pending && (
        <div role="status" aria-live="polite" className="flex flex-col gap-1">
          {statusLines.map((line, i) => (
            <p key={i} className="text-xs text-muted-foreground">{line}</p>
          ))}
          <p className="text-xs text-muted-foreground">Working…</p>
        </div>
      )}

      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}

      {evaluation && !pending && (
        <div className="flex flex-col items-start gap-2">
          {evaluationMissingIdentity(evaluation) && (
            <p className="text-xs text-muted-foreground">
              Couldn&apos;t detect company/role automatically — add this job manually from the board instead.
            </p>
          )}
          <Button type="button" size="sm" onClick={addEvaluationToPending} disabled={evaluationMissingIdentity(evaluation)}>
            Add to pending
          </Button>
        </div>
      )}
    </AssistantPanel>
  );
}
