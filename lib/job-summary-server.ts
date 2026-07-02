// Server-only: pulls in config + model. Kept out of lib/job-summary.ts so
// client components can import the pure helpers without bundling server deps.
import { readConfig } from "@/lib/config-repository";
import { fetchGenerate } from "@/lib/model";
import { buildAiSummaryPrompt, normalizeAiSummary, type SummaryJobContext } from "@/lib/job-summary";

/**
 * Best-effort aiSummary generation. Returns "" when AI is not configured,
 * when there is no source text to summarize (a summary invented from just
 * company+role would be hallucination, not extraction), or when the provider
 * call fails — callers write the job either way.
 */
export async function generateAiSummary(job: SummaryJobContext): Promise<string> {
  if (!job.jdText?.trim() && !job.notes?.trim()) return "";
  const config = await readConfig();
  if (!process.env.AI_API_KEY && config.ai?.provider !== "ollama") return "";
  try {
    const { system, user } = buildAiSummaryPrompt(job);
    const raw = await fetchGenerate(config.ai ?? {}, [
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    return normalizeAiSummary(raw);
  } catch {
    return "";
  }
}
