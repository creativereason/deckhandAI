import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { githubRead } from "@/lib/github";
import { streamGenerate } from "@/lib/model";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts";
import type { GenerationType, JobContext } from "@/lib/prompts";
import type { Profile } from "@/lib/profile";

async function fetchJdText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; deckhandAI/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    // Strip tags, collapse whitespace — rough but good enough for LLM context
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
  } catch {
    return "";
  }
}

async function readProfile(): Promise<Profile> {
  try {
    const raw = await githubRead("data/profile.json");
    return JSON.parse(raw) as Profile;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    company?: string;
    role?: string;
    url?: string;
    angle?: string;
    type?: GenerationType;
    jdText?: string;
  };

  const { company, role, url, angle, type = "cover-letter", jdText: clientJd } = body;

  if (!company || !role) {
    return NextResponse.json({ error: "company and role are required" }, { status: 400 });
  }

  if (!process.env.AI_API_KEY && !["ollama"].includes(
    (await readConfig()).ai?.provider ?? ""
  )) {
    return NextResponse.json({ error: "AI_API_KEY is not configured" }, { status: 400 });
  }

  const [config, profile] = await Promise.all([readConfig(), readProfile()]);

  // Fetch JD text server-side if not provided by client
  const jdText = clientJd ?? (url ? await fetchJdText(url) : "");

  const job: JobContext = { company, role, url, jdText, angle };
  const systemPrompt = buildSystemPrompt(profile);
  const userPrompt = buildUserPrompt(job, type);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  try {
    const stream = await streamGenerate(config.ai ?? {}, messages);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Separate endpoint for fetching JD text client can display before generating
export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url) return NextResponse.json({ text: "" });
  const text = await fetchJdText(url);
  return NextResponse.json({ text });
}
