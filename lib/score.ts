import { readConfig } from "@/lib/config";
import { fetchGenerate } from "@/lib/model";
import { buildScorePrompt } from "@/lib/prompts";
import type { JobFit, PendingJob } from "@/lib/jobs";

export async function fetchJdText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; deckhandAI/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
  } catch {
    return "";
  }
}

export async function scorePendingJob(job: {
  company: string;
  role: string;
  salary?: string;
  notes?: string;
  url?: string;
}): Promise<{ fit: JobFit; rationale: string }> {
  const config = await readConfig();

  const hasKey = !!process.env.AI_API_KEY;
  if (!hasKey && config.ai?.provider !== "ollama") {
    throw new Error("AI_API_KEY not configured");
  }

  const jdText = job.url ? await fetchJdText(job.url) : "";
  const { system, user } = buildScorePrompt(
    { company: job.company, role: job.role, salary: job.salary, notes: job.notes, jdText },
    config
  );

  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];

  let raw = await fetchGenerate(config.ai ?? {}, messages);
  raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  let parsed: { fit: JobFit; rationale: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`Could not parse score response: ${raw.slice(0, 200)}`);
    parsed = JSON.parse(match[0]);
  }

  const validFits: JobFit[] = ["strong", "good", "caution", "weak"];
  if (!validFits.includes(parsed.fit)) parsed.fit = "good";

  return { fit: parsed.fit, rationale: parsed.rationale ?? "" };
}

const BATCH_CONCURRENCY = 3;

/** Score an array of PendingJob objects in place. Soft-fails per job. */
export async function scoreNewPendingJobs(jobs: PendingJob[]): Promise<void> {
  for (let i = 0; i < jobs.length; i += BATCH_CONCURRENCY) {
    const batch = jobs.slice(i, i + BATCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (job) => {
        try {
          const result = await scorePendingJob(job);
          job.fit = result.fit;
          job.scoreRationale = result.rationale;
        } catch {
          // leave unscored — batch endpoint will retry on next open
        }
      })
    );
  }
}
