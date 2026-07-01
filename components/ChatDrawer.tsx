"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/components/MarkdownContent";
import {
  evaluateJobUrl as evaluateJobUrlRequest,
  evaluationMissingIdentity,
  addEvaluationToPending as putEvaluationToPending,
  type EvaluationPayload,
} from "@/lib/evaluate-job-client";

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
  "Flag Acme Corp as a ghost",
];

const GHOST_SCAN_PROMPT = "Scan my board for ghost jobs and stale applications";
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

export default function ChatDrawer({ onJobsChanged }: { onJobsChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ClientMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationPayload | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasDraftOrThread = messages.length > 0 || input.trim().length > 0 || !!error || !!evaluation;

  // Scroll to bottom whenever messages or status change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusText, pending]);

  // Focus input when drawer opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const evaluateJobUrl = useCallback(async (text: string): Promise<string> => {
    const url = extractUrl(text);
    if (!url) return "Paste the job posting URL after the prompt and I’ll evaluate it.";
    const result = await evaluateJobUrlRequest(url, setStatusText);
    setEvaluation(result);
    return formatEvaluation(result);
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || pending) return;
    setError("");
    setEvaluation(null);
    const userMsg: ClientMsg = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setPending(true);
    setStatusText("");

    let assistantText = "";
    let toolsCalled = false;

    try {
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
              setStatusText(TOOL_LABELS[event.name] ?? "Working…");
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
      setStatusText("");
    }
  }, [evaluateJobUrl, messages, pending, onJobsChanged]);

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
    setStatusText("");
    setError("");
    setEvaluation(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cueJobUrlEvaluation() {
    setInput(EVALUATE_URL_PROMPT);
    setError("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-lg transition-all duration-200 hover:scale-105",
          open
            ? "bg-stone-200 dark:bg-p-dark-mid text-gray-700 dark:text-gray-300"
            : "bg-p-blue dark:bg-p-accent-inv text-white"
        )}
      >
        {open ? "✕" : "✦"}
      </button>

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-20 right-6 z-50 w-80 sm:w-96 flex flex-col rounded-xl border border-p-linen dark:border-p-dark-mid bg-white dark:bg-p-dark-surface shadow-2xl transition-all duration-200 origin-bottom-right",
          open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ maxHeight: "min(65vh, 560px)" }}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-p-linen dark:border-p-dark-mid shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Assistant</p>
              <p className="text-xs text-stone-400 dark:text-gray-500">Manage your job board by chat</p>
            </div>
            {hasDraftOrThread && (
              <button
                type="button"
                onClick={startOver}
                disabled={pending}
                className="shrink-0 rounded-full border border-p-linen dark:border-p-dark-mid px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:bg-p-linen dark:hover:bg-p-dark-mid hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors"
              >
                Start over
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.length === 0 && !pending && (
            <div className="pt-2 space-y-3">
              {/* URL evaluation entry point */}
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 border border-p-blue/15 dark:border-p-accent-inv/20 bg-p-blue/5 dark:bg-p-accent-inv/10 text-gray-900 dark:text-white space-y-2.5">
                  <p className="text-sm leading-relaxed">
                    Paste a job posting URL and I&apos;ll fetch the description, summarize the role, and help decide where it belongs.
                  </p>
                  <button
                    onClick={cueJobUrlEvaluation}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-p-blue dark:bg-p-accent-inv text-white hover:opacity-90 transition-opacity"
                  >
                    Evaluate a job URL
                  </button>
                </div>
              </div>

              {/* Proactive ghost scan nudge */}
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-p-linen dark:bg-p-dark-mid text-gray-900 dark:text-white space-y-2.5">
                  <p className="text-sm leading-relaxed">
                    Want me to scan your board for <strong>ghost jobs</strong>? I can flag stale applications, listings stuck in screening, and roles that keep getting reposted.
                  </p>
                  <button
                    onClick={() => send(GHOST_SCAN_PROMPT)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-p-blue dark:bg-p-accent-inv text-white hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="6.5" cy="6.5" r="4.5" />
                      <line x1="10.5" y1="10.5" x2="14" y2="14" />
                    </svg>
                    Scan now
                  </button>
                </div>
              </div>

              <p className="text-xs text-stone-400 dark:text-gray-500 text-center pt-1">Or try asking:</p>
              {SUGGESTIONS_DESKTOP.map((s, i) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className={cn(
                    "block w-full text-left px-3 py-2 rounded-lg text-xs text-p-blue dark:text-p-accent-inv bg-p-linen/60 dark:bg-p-dark-mid/60 hover:bg-p-linen dark:hover:bg-p-dark-mid transition-colors",
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
                    ? "bg-p-blue dark:bg-p-accent-inv text-white rounded-tr-sm"
                    : "bg-p-linen dark:bg-p-dark-mid text-gray-900 dark:text-white rounded-tl-sm"
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
              {statusText && (
                <p className="text-[11px] text-stone-400 dark:text-gray-500 italic px-1">{statusText}</p>
              )}
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
            <p className="text-xs text-red-500 dark:text-red-400 px-1">{error}</p>
          )}

          {evaluation && !pending && (
            <div className="flex flex-col items-start gap-1.5">
              {evaluationMissingIdentity(evaluation) && (
                <p className="text-xs text-stone-400 dark:text-gray-500 px-1">
                  Couldn&apos;t detect company/role automatically — add this job manually from the board instead.
                </p>
              )}
              <button
                type="button"
                onClick={addEvaluationToPending}
                disabled={evaluationMissingIdentity(evaluation)}
                className="rounded-lg bg-p-blue dark:bg-p-accent-inv px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:hover:opacity-40 transition-opacity"
              >
                Add to pending
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="px-3 py-3 border-t border-p-linen dark:border-p-dark-mid shrink-0 flex gap-2"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={pending}
            placeholder="Message…"
            className="flex-1 text-sm bg-p-linen dark:bg-p-dark-mid rounded-lg px-3 py-2 text-gray-900 dark:text-white placeholder-stone-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-p-blue/40 dark:focus:ring-p-accent-inv/40 disabled:opacity-50 transition"
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="px-3 py-2 bg-p-blue dark:bg-p-accent-inv text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
}
