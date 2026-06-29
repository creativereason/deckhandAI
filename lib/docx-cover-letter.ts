import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
} from "docx";
import type { CandidateConfig, ExportStyle } from "@/lib/config";
import { resolveExportStyle } from "@/lib/config";

export interface CoverLetterInput {
  paragraphs: string[];
  company: string;
  role: string;
  date?: string;
  candidate: CandidateConfig;
  styleOverride?: ExportStyle;
}

function hexToDocxColor(hex: string): string {
  return hex.replace("#", "");
}

export async function generateCoverLetterDOCX(input: CoverLetterInput): Promise<Buffer> {
  const s = resolveExportStyle(input.styleOverride);
  const accent = hexToDocxColor(s.accentColor);
  const body = hexToDocxColor(s.bodyColor);
  const meta = hexToDocxColor(s.metaColor);
  const font = s.font;

  const { candidate, company, role, paragraphs } = input;
  const date = input.date ?? new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  function run(text: string, opts: {
    bold?: boolean;
    color?: string;
    size?: number;
  } = {}): TextRun {
    return new TextRun({
      text,
      font: { ascii: font, hAnsi: font },
      bold: opts.bold,
      color: opts.color,
      size: opts.size,
    });
  }

  const name = candidate.name ?? "Your Name";
  const contactParts: string[] = [];
  if (candidate.phone) contactParts.push(candidate.phone);
  if (candidate.email) contactParts.push(candidate.email);
  if (candidate.website) contactParts.push(candidate.website);
  if (candidate.linkedin) contactParts.push(candidate.linkedin);

  const children: Paragraph[] = [
    // Name
    new Paragraph({
      children: [run(name, { bold: true, color: accent, size: 36 })],
      spacing: { after: 60 },
    }),
    // Contact line
    new Paragraph({
      children: contactParts.flatMap((part, i) => [
        run(part, { color: meta, size: 18 }),
        ...(i < contactParts.length - 1 ? [run("  ·  ", { color: meta, size: 18 })] : []),
      ]),
      spacing: { after: 0 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: accent, space: 6 },
      },
    }),

    // Spacer
    new Paragraph({ children: [], spacing: { after: 240 } }),

    // Date
    new Paragraph({
      children: [run(date, { color: body })],
      spacing: { after: 240 },
    }),

    // Salutation block
    new Paragraph({
      children: [run("Hiring Team", { color: body })],
      spacing: { after: 0 },
    }),
    new Paragraph({
      children: [run(company, { color: body })],
      spacing: { after: 0 },
    }),
    new Paragraph({ children: [], spacing: { after: 0 } }),
    new Paragraph({
      children: [run(`Re: ${role}`, { bold: true, color: body })],
      spacing: { after: 240 },
    }),

    // Body paragraphs
    ...paragraphs.map((p) =>
      new Paragraph({
        children: [run(p, { color: body })],
        spacing: { before: 0, after: 200 },
      })
    ),

    // Signature
    new Paragraph({ children: [], spacing: { after: 480 } }),
    new Paragraph({
      children: [run(name, { color: body })],
      spacing: { after: 0 },
    }),
  ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { ascii: font, hAnsi: font, cs: font, eastAsia: font },
            color: body,
            size: 22,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: {
              top: s.marginTopDxa,
              bottom: s.marginBottomDxa,
              left: s.marginLeftDxa,
              right: s.marginRightDxa,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// Split AI-generated cover letter text into paragraphs by double newline or single newline
export function parseCoverLetterParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}
