import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  LevelFormat,
  TabStopType,
  TabStopPosition,
  HeadingLevel,
  convertInchesToTwip,
} from "docx";
import type { CandidateConfig, ExportStyle } from "@/lib/config";
import { resolveExportStyle } from "@/lib/config";

export interface ProfileData {
  name?: string;
  title?: string;
  summary?: string;
  strengths?: string[];
  experience?: {
    company: string;
    role: string;
    start: string;
    end: string | null;
    bullets: string[];
  }[];
  education?: {
    institution: string;
    degree: string;
    graduated?: string | null;
    honors?: string | null;
  }[];
  awards?: string[];
  portfolio_url?: string;
}

function hexToDocxColor(hex: string): string {
  return hex.replace("#", "");
}

function formatDateRange(start: string, end: string | null): string {
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };
  return `${fmt(start)} – ${end ? fmt(end) : "Present"}`;
}

export async function generateResumeDOCX(
  profile: ProfileData,
  candidate: CandidateConfig,
  styleOverride?: ExportStyle,
  tailoredBullets?: Record<string, string[]>
): Promise<Buffer> {
  const s = resolveExportStyle(styleOverride);
  const accent = hexToDocxColor(s.accentColor);
  const body = hexToDocxColor(s.bodyColor);
  const meta = hexToDocxColor(s.metaColor);
  const font = s.font;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function run(text: string, opts: {
    bold?: boolean;
    color?: string;
    size?: number;
    underline?: boolean;
  } = {}): TextRun {
    return new TextRun({
      text,
      font: { ascii: font, hAnsi: font },
      bold: opts.bold,
      color: opts.color,
      size: opts.size,
      underline: opts.underline ? {} : undefined,
    });
  }

  function sectionHeader(label: string): Paragraph {
    return new Paragraph({
      children: [run(label.toUpperCase(), { bold: true, color: accent, size: 18 })],
      spacing: { before: 240, after: 72 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: accent, space: 4 },
      },
    });
  }

  function bulletParagraph(text: string): Paragraph {
    return new Paragraph({
      text,
      style: "ListParagraph",
      numbering: { reference: "resume-bullets", level: 0 },
      spacing: { before: 36, after: 36 },
      run: { font: { ascii: font, hAnsi: font }, color: body, size: 22 },
    });
  }

  // ── Header ─────────────────────────────────────────────────────────────────

  const name = profile.name ?? candidate.name ?? "Your Name";
  const contactParts: string[] = [];
  if (candidate.phone) contactParts.push(candidate.phone);
  if (candidate.email) contactParts.push(candidate.email);
  if (candidate.website) contactParts.push(candidate.website);
  if (candidate.linkedin) contactParts.push(candidate.linkedin);

  const headerParagraphs: Paragraph[] = [
    new Paragraph({
      children: [run(name, { bold: true, color: accent, size: 52 })],
      spacing: { after: 80 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: accent, space: 4 },
      },
    }),
    new Paragraph({
      children: contactParts.flatMap((part, i) => [
        run(part, { color: meta, size: 18 }),
        ...(i < contactParts.length - 1 ? [run("  ·  ", { color: meta, size: 18 })] : []),
      ]),
      spacing: { before: 100, after: 60 },
    }),
  ];

  if (profile.title) {
    headerParagraphs.push(
      new Paragraph({
        children: [run(profile.title, { bold: true, size: 22 })],
        spacing: { before: 80, after: 200 },
      })
    );
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  const summaryParagraphs: Paragraph[] = [];
  if (profile.summary) {
    summaryParagraphs.push(sectionHeader("Profile"));
    summaryParagraphs.push(
      new Paragraph({
        children: [run(profile.summary, { color: body })],
        spacing: { before: 40, after: 60 },
      })
    );
  }

  // ── Strengths / Skills ─────────────────────────────────────────────────────

  const strengthsParagraphs: Paragraph[] = [];
  if (profile.strengths?.length) {
    strengthsParagraphs.push(sectionHeader("Core Strengths"));
    strengthsParagraphs.push(
      new Paragraph({
        children: [run(profile.strengths.join("  ·  "), { color: body })],
        spacing: { before: 40, after: 40 },
      })
    );
  }

  // ── Experience ─────────────────────────────────────────────────────────────

  const contentWidth = 12240 - s.marginLeftDxa - s.marginRightDxa;
  const experienceParagraphs: Paragraph[] = [];

  if (profile.experience?.length) {
    experienceParagraphs.push(sectionHeader("Experience"));

    for (const job of profile.experience) {
      const jobKey = `${job.company}::${job.role}`;
      const bullets = tailoredBullets?.[jobKey] ?? job.bullets;

      // Job title
      experienceParagraphs.push(
        new Paragraph({
          children: [run(job.role, { bold: true, size: 22 })],
          spacing: { before: 200, after: 36 },
        })
      );

      // Company · date — right-aligned via tab stop
      experienceParagraphs.push(
        new Paragraph({
          children: [
            run(job.company, { bold: true, color: body }),
            new TextRun({ children: ["\t"], font: { ascii: font, hAnsi: font } }),
            run(formatDateRange(job.start, job.end), { color: meta, size: 18 }),
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          spacing: { after: 60 },
        })
      );

      // Bullets
      for (const bullet of bullets) {
        experienceParagraphs.push(bulletParagraph(bullet));
      }
    }
  }

  // ── Education ─────────────────────────────────────────────────────────────

  const educationParagraphs: Paragraph[] = [];
  if (profile.education?.length) {
    educationParagraphs.push(sectionHeader("Education"));
    for (const edu of profile.education) {
      const parts = [edu.degree, edu.honors].filter(Boolean).join("  ·  ");
      educationParagraphs.push(
        new Paragraph({
          children: [run(edu.institution, { bold: true, color: body })],
          spacing: { before: 48, after: 0 },
        })
      );
      educationParagraphs.push(
        new Paragraph({
          children: [run(parts, { color: body })],
          spacing: { before: 0, after: 48 },
        })
      );
    }
  }

  // ── Awards ────────────────────────────────────────────────────────────────

  const awardsParagraphs: Paragraph[] = [];
  if (profile.awards?.length) {
    awardsParagraphs.push(sectionHeader("Awards"));
    for (const award of profile.awards) {
      awardsParagraphs.push(bulletParagraph(award));
    }
  }

  // ── Assemble document ─────────────────────────────────────────────────────

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "resume-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 360, hanging: 260 } },
              },
            },
          ],
        },
      ],
    },
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
      paragraphStyles: [
        {
          id: "ListParagraph",
          name: "List Paragraph",
          basedOn: "Normal",
          run: {
            font: { ascii: font, hAnsi: font },
            color: body,
            size: 22,
          },
        },
      ],
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
        children: [
          ...headerParagraphs,
          ...summaryParagraphs,
          ...strengthsParagraphs,
          ...experienceParagraphs,
          ...educationParagraphs,
          ...awardsParagraphs,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
