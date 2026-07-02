import { NextRequest, NextResponse } from "next/server";
import { readConfig } from "@/lib/config-repository";
import { generateCoverLetterDOCX, parseCoverLetterParagraphs } from "@/lib/docx-cover-letter";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      text: string;
      company: string;
      role: string;
      date?: string;
    };

    if (!body.text || !body.company || !body.role) {
      return NextResponse.json({ error: "text, company, and role are required" }, { status: 400 });
    }

    const config = await readConfig();
    const candidate = config.candidate ?? {};
    const style = config.export;

    const paragraphs = parseCoverLetterParagraphs(body.text);

    const buffer = await generateCoverLetterDOCX({
      paragraphs,
      company: body.company,
      role: body.role,
      date: body.date,
      candidate,
      styleOverride: style,
    });

    const slug = `${body.company}-${body.role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const filename = `cover-letter-${slug}.docx`;

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
