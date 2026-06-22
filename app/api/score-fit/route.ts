import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { fetchGenerate } from "@/lib/model";
import { buildScorePrompt } from "@/lib/prompts";
import type { JobFit } from "@/lib/jobs";

async function fetchJdText(url: string): Promise<string> {
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    company?: string;
    role?: string;
    salary?: string;
    notes?: string;
    url?: string;
  };

  const { company, role, salary, notes, url } = body;

  if (!company || !role) {
    return NextResponse.json({ error: "company and role are required" }, { status: 400 });
  }

  const [config] = await Promise.all([readConfig()]);

  const provider = config.ai?.provider ?? "anthropic";
  const hasKey = !!process.env.AI_API_KEY;
  if (!hasKey && provider !== "ollama") {
    return NextResponse.json({ error: "AI_API_KEY not configured" }, { status: 400 });
  }

  const jdText = url ? await fetchJdText(url) : "";

  const { system, user } = buildScorePrompt({ company, role, salary, notes, jdText }, config);

  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];

  try {
    let raw = await fetchGenerate(config.ai ?? {}, messages);

    // Strip any accidental markdown fences
    raw = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

    let parsed: { fit: JobFit; rationale: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Try to extract JSON substring
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error(`Could not parse score response: ${raw.slice(0, 200)}`);
      parsed = JSON.parse(match[0]);
    }

    const validFits: JobFit[] = ["strong", "good", "caution", "weak"];
    if (!validFits.includes(parsed.fit)) parsed.fit = "good";

    return NextResponse.json({ fit: parsed.fit, rationale: parsed.rationale ?? "" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
