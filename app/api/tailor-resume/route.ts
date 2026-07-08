import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config-repository";
import { githubRead } from "@/lib/github";
import { fetchGenerate } from "@/lib/model";
import { buildSystemPrompt } from "@/lib/prompts";
import { fetchJdText } from "@/lib/fetch-jd";
import type { Profile } from "@/lib/profile";

export interface TailoredResume {
  title: string;
  profileBullets: string[];
  experience: { company: string; role: string; bullets: string[] }[];
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
    const jdText = url ? await fetchJdText(url, company) : "";

    const systemPrompt = buildSystemPrompt(profile);

    const experienceList = (profile.experience ?? [])
      .map((e, idx) => {
        const budget = idx < 2 ? 4 : 2;
        const pool = e.bullets.map((b, i) => `    ${i + 1}. ${b}`).join("\n");
        return `- ${e.role} at ${e.company} (select ${budget} bullets)\n  Available pool:\n${pool}`;
      })
      .join("\n\n");

    const userPrompt = `Tailor this candidate's resume for the following role. Return only valid JSON — no prose, no markdown fences.

ROLE: ${role} at ${company}
${jdText ? `\nJOB DESCRIPTION:\n${jdText.slice(0, 6000)}` : ""}

CANDIDATE'S EXPERIENCE — bullet pools per role (use exact company and role names):
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
- experience: for each role, choose the BEST bullets from its available pool and lightly reword them to match JD keywords — do not fabricate bullets not in the pool; include all positions; the two most recent roles get exactly 4 bullets, all older roles get exactly 2 bullets
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
