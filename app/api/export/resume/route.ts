import { NextRequest, NextResponse } from "next/server";
import { githubRead } from "@/lib/github";
import { readConfig } from "@/lib/config";
import { generateResumeDOCX, type ProfileData } from "@/lib/docx-resume";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      company?: string;
      role?: string;
      tailoredBullets?: Record<string, string[]>;
      tailoredProfileBullets?: string[];
    };

    const [config, profileRaw] = await Promise.all([
      readConfig(),
      githubRead("data/profile.json"),
    ]);

    const profile = JSON.parse(profileRaw) as ProfileData;
    const candidate = config.candidate ?? {};
    const style = config.export;

    const buffer = await generateResumeDOCX(profile, candidate, style, body.tailoredBullets, body.company, body.tailoredProfileBullets);

    const company = body.company ?? "company";
    const role = body.role ?? "role";
    const slug = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const filename = `resume-${slug}.docx`;

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
