import { NextRequest, NextResponse } from "next/server";
import { githubRead } from "@/lib/github";
import { readConfig } from "@/lib/config-repository";
import { resolveExportStyle } from "@/lib/config";
import { buildResumeHtml } from "@/lib/resume-template";
import { renderResumePdf } from "@/lib/resume-pdf";
import type { ProfileData } from "@/lib/docx-resume";
import { companySlug } from "@/lib/resume-format";

export const runtime = "nodejs";

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

    const style = resolveExportStyle(config.export);
    if (!style.stylePdfEnabled) {
      return NextResponse.json(
        { error: "Styled PDF export is disabled. Enable it under Settings > Export." },
        { status: 400 }
      );
    }

    const profile = JSON.parse(profileRaw) as ProfileData;
    const candidate = config.candidate ?? {};

    const html = buildResumeHtml(profile, candidate, {
      tailoredBullets: body.tailoredBullets,
      company: body.company,
      tailoredProfileBullets: body.tailoredProfileBullets,
    });

    const pdfBuffer = await renderResumePdf({ html });
    if (!pdfBuffer) {
      return NextResponse.json(
        { error: "Styled PDF export requires Playwright, which is not available in this deployment." },
        { status: 503 }
      );
    }

    const company = body.company ?? "company";
    const role = body.role ?? "role";
    const filename = `resume-${companySlug(`${company}-${role}`)}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
