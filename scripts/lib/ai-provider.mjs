// Shared AI call helper for standalone scripts (scripts/job-search.mjs,
// scripts/email-job-search.mjs, scripts/backfill-ai-summaries.mjs). Speaks
// Anthropic's Messages API natively when AI_PROVIDER=anthropic (the
// default — matches lib/model.ts's default), and falls back to an
// OpenAI-compatible chat/completions call for openai/gemini/grok/ollama/
// custom, so the same AI_API_KEY these scripts already require works
// whichever provider it belongs to.
//
// Env vars: AI_PROVIDER (default "anthropic"), AI_MODEL, AI_API_KEY,
// AI_BASE_URL (only used for non-Anthropic providers; falls back to each
// provider's known default, then OpenAI's).

const BUILTIN_BASE_URLS = {
  openai: "https://api.openai.com/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
  grok: "https://api.x.ai/v1",
};

export async function callAI({ systemPrompt, userPrompt, maxTokens = 1024, temperature }) {
  const provider = process.env.AI_PROVIDER || "anthropic";
  const model = process.env.AI_MODEL || "claude-sonnet-4-6";
  const apiKey = process.env.AI_API_KEY || "";

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        ...(temperature !== undefined ? { temperature } : {}),
        ...(systemPrompt ? { system: systemPrompt } : {}),
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`AI provider error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    return (json.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
  }

  const baseUrl = (process.env.AI_BASE_URL || BUILTIN_BASE_URLS[provider] || "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  );
  const messages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }]
    : [{ role: "user", content: userPrompt }];
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new Error(`AI provider error ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}
