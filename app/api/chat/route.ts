import { NextRequest } from "next/server";
import type { AiConfig } from "@/lib/config";
import { readConfig } from "@/lib/config-repository";
import { ANTHROPIC_TOOLS, OPENAI_TOOLS, executeTool } from "@/lib/chat-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ClientMsg = { role: "user" | "assistant"; content: string };

type NdjsonEvent =
  | { type: "tool_call"; name: string }
  | { type: "text"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

const SYSTEM_PROMPT = `You are a concise job search assistant inside DeckhandAI, a personal job tracker. Help the user manage their board through natural language.

Board sections: prospect (remote), local (local/hybrid), staffing (contract), applied, passed, pending (awaiting review).

Use the available tools to read and mutate the board. After completing an action, confirm briefly what you did. Keep replies short.
When add_job returns a detailUrl for a pending or applied job, include a final markdown link exactly like: [View Job](detailUrl).

When the user asks about fit, their background, how their experience compares to a role, or anything about the candidate's qualifications, call read_profile first — never ask the user to describe their own experience.

When the user asks to re-assess, re-score, or evaluate fit for the current job: call read_profile, then call fetch_job_description with the job URL if you don't already have the full JD, then call update_job with both fit (strong/good/caution/weak) and scoreRationale explaining the reasoning. Always write both fields together.

When the user asks to scan for ghost jobs, stale applications, or suspicious listings, call detect_ghost_jobs. Present the flagged jobs grouped by severity, explain each signal, and offer to flag them as ghosts or move them to passed.

When the user asks to flag a job as a ghost but doesn't name which company/role, ask which job before calling flag_ghost — never guess.

When the user shares a job URL:
1. Call fetch_job_description with that URL to retrieve the JD text.
2. If thin=true (page was blocked or gated), call search_remote_jobs with relevant keywords (role title, skills) to find similar remote listings on RemoteOK. Present the top results so the user can pick one.
3. Once you have a description, summarize the role and score fit if asked. Evaluating a job is not the same as filing it: only call add_job if the user actually asked to add/track/save it. If they do and named a specific section (prospect, applied, local, staffing), use that. If they didn't name one, call add_job with section "pending" so they can review and file it themselves — never default to prospect or applied on your own judgment.

Today's date: ${new Date().toISOString().split("T")[0]}`;

// ─── Provider helpers ─────────────────────────────────────────────────────────

function getProvider(ai: AiConfig) {
  return (process.env.AI_PROVIDER as string) ?? ai.provider ?? "anthropic";
}

function getModel(ai: AiConfig) {
  return process.env.AI_MODEL ?? ai.model ?? "claude-sonnet-4-6";
}

function buildEndpoint(ai: AiConfig): { url: string; headers: Record<string, string> } {
  const apiKey = process.env.AI_API_KEY ?? "";
  const provider = getProvider(ai);

  if (provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
    };
  }

  const BUILTIN: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
    grok: "https://api.x.ai/v1",
  };
  const baseUrl =
    process.env.AI_BASE_URL || ai.base_url || BUILTIN[provider] || "https://api.openai.com/v1";

  return {
    url: `${baseUrl}/chat/completions`,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  };
}

// ─── Anthropic tool loop ──────────────────────────────────────────────────────

type AnthropicTextBlock = { type: "text"; text: string };
type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
type AnthropicContent = AnthropicTextBlock | AnthropicToolUseBlock;
type AnthropicToolResult = { type: "tool_result"; tool_use_id: string; content: string };
type AnthropicMsg =
  | { role: "user"; content: string | AnthropicToolResult[] }
  | { role: "assistant"; content: AnthropicContent[] };

async function runAnthropic(
  messages: ClientMsg[],
  ai: AiConfig,
  onToolCall: (name: string) => void,
  system = SYSTEM_PROMPT,
): Promise<string> {
  const { url, headers } = buildEndpoint(ai);
  const model = getModel(ai);
  const thread: AnthropicMsg[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  } as AnthropicMsg));
  let finalText = "";

  for (let round = 0; round < 10; round++) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system,
        tools: ANTHROPIC_TOOLS,
        messages: thread,
      }),
    });
    if (!res.ok) throw new Error(`AI error ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as { stop_reason: string; content: AnthropicContent[] };
    const content = json.content;
    thread.push({ role: "assistant", content });

    const text = content
      .filter((c): c is AnthropicTextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");
    if (text) finalText = text;
    if (json.stop_reason !== "tool_use") break;

    const toolUses = content.filter((c): c is AnthropicToolUseBlock => c.type === "tool_use");
    const results: AnthropicToolResult[] = [];
    for (const tu of toolUses) {
      onToolCall(tu.name);
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: await executeTool(tu.name, tu.input),
      });
    }
    thread.push({ role: "user", content: results });
  }

  return finalText;
}

// ─── OpenAI tool loop ─────────────────────────────────────────────────────────

type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};
type OpenAIMsg =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

async function runOpenAI(
  messages: ClientMsg[],
  ai: AiConfig,
  onToolCall: (name: string) => void,
  system = SYSTEM_PROMPT,
): Promise<string> {
  const { url, headers } = buildEndpoint(ai);
  const model = getModel(ai);
  const thread: OpenAIMsg[] = [
    { role: "system", content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  let finalText = "";

  for (let round = 0; round < 10; round++) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, max_tokens: 2048, tools: OPENAI_TOOLS, messages: thread }),
    });
    if (!res.ok) throw new Error(`AI error ${res.status}: ${await res.text()}`);

    const json = await res.json() as {
      choices: {
        finish_reason: string;
        message: { role: "assistant"; content: string | null; tool_calls?: OpenAIToolCall[] };
      }[];
    };
    const choice = json.choices?.[0];
    const msg = choice?.message;
    if (!msg) break;

    thread.push(msg);
    if (msg.content) finalText = msg.content;
    if (choice.finish_reason !== "tool_calls" || !msg.tool_calls?.length) break;

    for (const tc of msg.tool_calls) {
      onToolCall(tc.function.name);
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
      thread.push({ role: "tool", tool_call_id: tc.id, content: await executeTool(tc.function.name, input) });
    }
  }

  return finalText;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { messages?: ClientMsg[]; jobContext?: string };
  const messages = body.messages ?? [];
  const jobContext = body.jobContext ?? "";

  const encoder = new TextEncoder();

  if (!messages.length) {
    return new Response(
      JSON.stringify({ type: "error", message: "No messages" } satisfies NdjsonEvent) + "\n",
      { status: 400 }
    );
  }

  const config = await readConfig();
  const ai = config.ai ?? {};
  const provider = getProvider(ai);

  // The client can disconnect (navigate away, close the tab) while the AI request
  // is still in flight — the controller auto-closes on cancellation, so any later
  // enqueue()/close() call would throw "Controller is already closed". Shared
  // across start()/cancel() since cancel() fires on a client disconnect.
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (event: NdjsonEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true;
        }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by client disconnection
        }
      };

      const effectiveSystem = jobContext
        ? SYSTEM_PROMPT + `\n\nThe user is currently viewing this specific job:\n${jobContext}\n\nJob detail context rules: do not ask clarifying questions about what to update — the job context above provides company, role, section, and URL. Act immediately. When the user asks to update from the web, call fetch_job_description with the URL from context, then call update_job with all retrieved fields (notes, fit, scoreRationale, salary if found). Never return a question about what to update when a job URL is available.`
        : SYSTEM_PROMPT;

      const run = provider === "anthropic"
        ? () => runAnthropic(messages, ai, (name) => emit({ type: "tool_call", name }), effectiveSystem)
        : () => runOpenAI(messages, ai, (name) => emit({ type: "tool_call", name }), effectiveSystem);

      run()
        .then((text) => {
          emit({ type: "text", text });
          emit({ type: "done" });
        })
        .catch((err) =>
          emit({ type: "error", message: err instanceof Error ? err.message : String(err) })
        )
        .finally(safeClose);
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
