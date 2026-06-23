import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config";
import { githubRead } from "@/lib/github";
import { fetchGenerate } from "@/lib/model";
import { buildSystemPrompt } from "@/lib/prompts";
import type { Profile } from "@/lib/profile";

export interface TailoredResume {
  title: string;
  profileBullets: string[];
  experience: { company: string; role: string; bullets: string[] }[];
}

async function fetchJdText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; deckhandAI/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return "";
    const html = await res.text();
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { company: string; role: string; url?: string };
    const { company, role, url } = body;

    if (!company || !role) {
      return NextResponse.json({ error: "company and role are required" }, { status: 400 });
    }

    const [config, profileRaw] = await Promise.all([
      readConfig(),
      githubRead("data/profile.json"),
    ]);

    const profile = JSON.parse(profileRaw) as Profile;
    const jdText = url ? await fetchJdText(url) : "";

    const systemPrompt = buildSystemPrompt(profile);

    const experienceList = (profile.experience ?? [])
      .map((e) => `- ${e.role} at ${e.company}`)
      .join("\n");

    const userPrompt = `Tailor this candidate's resume for the following role. Return only valid JSON — no prose, no markdown fences.

ROLE: ${role} at ${company}
${jdText ? `\nJOB DESCRIPTION:\n${jdText.slice(0, 6000)}` : ""}

CANDIDATE'S CURRENT EXPERIENCE POSITIONS (use exact company and role names):
${experienceList}

Return a JSON object with this exact shape:
{
  "title": "updated title line (max 3 segments separated by — matching the target role language)",
  "profileBullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "experience": [
    { "company": "exact company name", "role": "exact role name", "bullets": ["bullet 1", "bullet 2", ...] }
  ]
}

Rules:
- title: mirror the target role's language, max 3 segments
- profileBullets: reorder or lightly reword the existing 4 profile bullets to front-load what this JD emphasizes most — do not invent new ones
- experience: reorder and lightly reword bullets to match JD keywords — do not fabricate experience; include all positions from the candidate's history
- Apply all writing style rules from the system prompt
- Return only the JSON object, nothing else`;

    const raw = await fetchGenerate(config.ai ?? {}, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const tailored = JSON.parse(cleaned) as TailoredResume;

    return NextResponse.json(tailored);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
