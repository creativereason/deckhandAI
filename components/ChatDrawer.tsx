"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Button } from "@/components/ui/button";
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

function jobDetailHref(section: string, company: string, role: string): string {
  const params = new URLSearchParams({ section, company, role });
  return `/job?${params.toString()}`;
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

const COLLAPSED_STORAGE_KEY = "board-chat-collapsed";

export default function ChatDrawer({ onJobsChanged }: { onJobsChanged: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<ClientMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationPayload | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasDraftOrThread = messages.length > 0 || input.trim().length > 0 || !!error || !!evaluation;

  const appendStatus = useCallback((line: string) => {
    setStatusLines((lines) => [...lines, line]);
  }, []);

  // Scroll the message list itself to bottom whenever messages or status change —
  // scrollIntoView() would walk up the scroll-ancestor chain and drag the whole
  // page along with it now that this panel is embedded inline (not a floating overlay).
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, statusLines, pending]);

  // Restore collapsed/expanded state once on mount
  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "true") setCollapsed(true);
  }, []);

  // Focus input when expanded
  useEffect(() => {
    if (!collapsed) setTimeout(() => inputRef.current?.focus(), 50);
  }, [collapsed]);

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

  const send = useCallback(async (text: string) => {
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
        body: JSON.stringify({ messages: nextMessages }),
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
  }, [evaluateJobUrl, runScrapeNow, messages, pending, onJobsChanged, appendStatus]);

  async function addEvaluationToPending() {
    if (!evaluation || pending || evaluationMissingIdentity(evaluation)) return;
    setPending(true);
    setError("");
    try {
      await putEvaluationToPending(evaluation);
      const href = jobDetailHref("pending", evaluation.company, evaluation.role);
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
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

  function cueJobUrlEvaluation() {
    setInput(EVALUATE_URL_PROMPT);
    setError("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <div className={cn(
      "bg-card rounded-2xl border border-border shadow-sm px-3 py-3 md:px-5 md:py-4",
      !collapsed && "md:max-h-[calc(100vh-2rem)] md:flex md:flex-col md:overflow-hidden"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand assistant" : "Collapse assistant"}
          className="flex items-start gap-2 text-left flex-1 min-w-0 group"
        >
          {collapsed
            ? <ChevronDownIcon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
            : <ChevronUpIcon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
          }
          <span>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Your Deckhand</p>
            <p className="text-xs text-muted-foreground">Manage your job board by chat</p>
          </span>
        </button>
        {!collapsed && hasDraftOrThread && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={startOver}
            disabled={pending}
            className="shrink-0 text-[11px]"
          >
            Start over
          </Button>
        )}
      </div>

      {!collapsed && (
      <>
      {/* Messages */}
        <div ref={messagesRef} className="mt-2 md:mt-3 max-h-56 md:max-h-none md:flex-1 md:min-h-0 overflow-y-auto space-y-3">
          {messages.length === 0 && !pending && (
            <div className="pt-2 space-y-1.5">
              <button
                onClick={cueJobUrlEvaluation}
                title="Paste a job posting URL and I'll fetch the description, summarize the role, and help decide where it belongs."
                className="flex items-center gap-1.5 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-primary bg-primary/5 border border-primary/15 hover:bg-primary/10 transition-colors"
              >
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6.5 9.5 9.5 6.5M7 4l.7-.7a2.5 2.5 0 0 1 3.5 3.5L10.5 7.5M9 12l-.7.7a2.5 2.5 0 0 1-3.5-3.5L5.5 8.5" />
                </svg>
                Evaluate a job URL
              </button>

              <button
                onClick={() => send(GHOST_SCAN_PROMPT)}
                title="Scan your board for ghost jobs — stale applications, listings stuck in screening, and roles that keep getting reposted."
                className="flex items-center gap-1.5 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-primary bg-muted/60 hover:bg-muted transition-colors"
              >
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6.5" cy="6.5" r="4.5" />
                  <line x1="10.5" y1="10.5" x2="14" y2="14" />
                </svg>
                Scan for ghost jobs
              </button>

              <button
                onClick={() => send(SCRAPE_PROMPT)}
                title="Scan configured career pages for new qualifying roles and add them to the pending review queue."
                className="flex items-center gap-1.5 w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-primary bg-muted/60 hover:bg-muted transition-colors"
              >
                <svg className="w-3 h-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4h12M2 8h12M2 12h8" />
                </svg>
                Scrape for new jobs
              </button>

              <p className="text-xs text-muted-foreground text-center pt-1">Or try asking:</p>
              {SUGGESTIONS_DESKTOP.map((s, i) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className={cn(
                    "block w-full text-left px-3 py-2 rounded-lg text-xs text-primary bg-muted/60 hover:bg-muted transition-colors",
                    i >= SUGGESTIONS_MOBILE.length && "hidden sm:block"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2",
                  m.role === "user"
                    ? "bg-primary text-white rounded-tr-sm"
                    : "bg-muted text-gray-900 dark:text-white rounded-tl-sm"
                )}
              >
                {m.role === "user"
                  ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  : <MarkdownContent text={m.content} />
                }
              </div>
            </div>
          ))}

          {pending && (
            <div className="flex flex-col gap-1.5">
              {statusLines.map((line, i) => (
                <p key={i} className="text-[11px] text-muted-foreground italic px-1">{line}</p>
              ))}
              <div className="flex items-center gap-1 px-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-gray-500 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive px-1">{error}</p>
          )}

          {evaluation && !pending && (
            <div className="flex flex-col items-start gap-1.5">
              {evaluationMissingIdentity(evaluation) && (
                <p className="text-xs text-muted-foreground px-1">
                  Couldn&apos;t detect company/role automatically — add this job manually from the board instead.
                </p>
              )}
              <Button
                type="button"
                size="sm"
                onClick={addEvaluationToPending}
                disabled={evaluationMissingIdentity(evaluation)}
              >
                Add to pending
              </Button>
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="mt-3 pt-3 border-t border-border flex gap-2 shrink-0"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pending}
            placeholder="Message…"
            className="flex-1 min-w-0 text-sm bg-muted rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-stone-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 transition"
          />
          <Button type="submit" disabled={!input.trim()} loading={pending}>
            Send
          </Button>
        </form>
      </>
      )}
    </div>
  );
}
