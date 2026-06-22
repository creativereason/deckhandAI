import type { AiConfig } from "@/lib/config";

export interface GenerateRequest {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  stream: boolean;
}

function resolveEndpoint(config: AiConfig): { url: string; headers: Record<string, string> } {
  const apiKey = process.env.AI_API_KEY ?? "";
  const provider = config.provider ?? "anthropic";

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

  // OpenAI-compatible: openai, ollama, custom, grok, gemini, etc.
  let baseUrl = config.base_url ?? "https://api.openai.com/v1";
  if (provider === "openai") baseUrl = "https://api.openai.com/v1";

  return {
    url: `${baseUrl}/chat/completions`,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  };
}

function buildBody(config: AiConfig, messages: GenerateRequest["messages"], stream: boolean): string {
  const model = config.model ?? "claude-sonnet-4-6";
  const provider = config.provider ?? "anthropic";

  if (provider === "anthropic") {
    const systemMsg = messages.find((m) => m.role === "system");
    const userMsgs = messages.filter((m) => m.role !== "system");
    return JSON.stringify({
      model,
      max_tokens: 2048,
      stream,
      system: systemMsg?.content ?? "",
      messages: userMsgs,
    });
  }

  return JSON.stringify({ model, messages, stream, max_tokens: 2048 });
}

export async function fetchGenerate(
  config: AiConfig,
  messages: GenerateRequest["messages"]
): Promise<string> {
  const { url, headers } = resolveEndpoint(config);
  const body = buildBody(config, messages, false);

  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI provider error ${res.status}: ${text}`);
  }

  const provider = config.provider ?? "anthropic";
  const json = await res.json();

  if (provider === "anthropic") {
    return (json.content as { type: string; text: string }[])
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("");
  }
  return json.choices?.[0]?.message?.content ?? "";
}

export async function streamGenerate(
  config: AiConfig,
  messages: GenerateRequest["messages"]
): Promise<ReadableStream<Uint8Array>> {
  const { url, headers } = resolveEndpoint(config);
  const body = buildBody(config, messages, true);

  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI provider error ${res.status}: ${text}`);
  }
  if (!res.body) throw new Error("No response body from AI provider");

  const provider = config.provider ?? "anthropic";

  // Pass through Anthropic SSE directly; normalize OpenAI-compat SSE to plain text chunks
  if (provider === "anthropic") {
    return anthropicToTextStream(res.body);
  }
  return openaiToTextStream(res.body);
}

function anthropicToTextStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            try {
              const json = JSON.parse(line.slice(5).trim());
              const text = json.delta?.text ?? "";
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}

function openaiToTextStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const text = json.choices?.[0]?.delta?.content ?? "";
              if (text) controller.enqueue(encoder.encode(text));
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}
