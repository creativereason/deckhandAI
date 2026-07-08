import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProfileData } from "@/lib/docx-resume";
import type { CandidateConfig } from "@/lib/config";
import { formatDateRange, companySlug } from "@/lib/resume-format";

const FONT_DIR = join(process.cwd(), "assets", "fonts", "inter");

// Computed once per process — base64-encoding on every request would be wasted work.
let cachedFontFaces: string | null = null;

function loadFontFaces(): string {
  if (cachedFontFaces) return cachedFontFaces;
  const regular = readFileSync(join(FONT_DIR, "Inter-Regular.woff2")).toString("base64");
  const semibold = readFileSync(join(FONT_DIR, "Inter-SemiBold.woff2")).toString("base64");
  cachedFontFaces = `
  @font-face {
    font-family: 'Inter';
    font-weight: 400;
    src: url(data:font/woff2;base64,${regular}) format('woff2');
  }
  @font-face {
    font-family: 'Inter';
    font-weight: 600;
    src: url(data:font/woff2;base64,${semibold}) format('woff2');
  }`;
  return cachedFontFaces;
}

export interface ResumeHtmlOptions {
  tailoredBullets?: Record<string, string[]>;
  company?: string;
  tailoredProfileBullets?: string[];
}

const TOKENS = {
  ink: "#18181B",
  body: "#27272A",
  secondary: "#52525B",
  muted: "#71717A",
  accent: "#1E3A8A",
  rule: "rgba(30, 58, 138, 0.25)",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderStyle(): string {
  return `<style>
  ${loadFontFaces()}
  :root {
    --ink: ${TOKENS.ink}; --body: ${TOKENS.body}; --secondary: ${TOKENS.secondary};
    --muted: ${TOKENS.muted}; --accent: ${TOKENS.accent}; --rule: ${TOKENS.rule};
  }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; color: var(--body); margin: 0; padding: 0; }
  h1 { font-size: 27px; font-weight: 700; color: var(--ink); letter-spacing: -0.01em; line-height: 1.2; margin: 0; }
  .headline { font-size: 14px; font-weight: 500; color: var(--accent); letter-spacing: 0.01em; margin: 4px 8px 0 0; text-align: justify;}
  .contact { font-size: 12px; font-weight: 400; color: var(--secondary); line-height: 1.3; margin: 6px 6px 0 0; }
  h2 {
    font-size: 11px; font-weight: 600; color: var(--accent); text-transform: uppercase;
    letter-spacing: 0.12em; padding-bottom: 5px; border-bottom: 1px solid var(--rule); margin: 17px 0 8px;
  }
  h3 { font-size: 13.5px; font-weight: 700; color: var(--ink); line-height: 1.4; margin: 0; }
  .role-row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; margin-top: 2px; }
  .employer { font-size: 12.5px; font-weight: 500; color: var(--secondary); }
  .dates { font-size: 12px; font-weight: 400; color: var(--muted); white-space: nowrap; }
  .role-block { margin-bottom: 16px; }
  .role-head { break-inside: avoid; }
  ul { padding-left: 18px; margin: 5px 0 0; }
  li { font-size: 13px; line-height: 1.45; margin-bottom: 4px; }
  p.body-text { font-size: 13px; line-height: 1.45; margin: 0; }
  .skills-line { font-size: 13px; line-height: 1.3; margin: 4px 0; }
  .skills-line b { font-weight: 600; color: var(--ink); }
  .edu-entry { break-inside: avoid; margin-bottom: 10px; }
  .edu-entry b { font-weight: 700; color: var(--ink); font-size: 13px; }
  .edu-entry .details { font-size: 12px; color: var(--secondary); }
</style>`;
}

function renderHeader(profile: ProfileData, candidate: CandidateConfig, company?: string): string {
  const name = profile.name ?? candidate.name ?? "Your Name";
  const contactParts: string[] = [];
  if (candidate.phone) contactParts.push(escapeHtml(candidate.phone));
  if (candidate.email) contactParts.push(escapeHtml(candidate.email));
  if (candidate.website) contactParts.push(escapeHtml(candidate.website));
  if (candidate.linkedin) contactParts.push(escapeHtml(candidate.linkedin));
  if (profile.portfolio_url) {
    const base = profile.portfolio_url.replace(/\/$/, "");
    const url = company ? `${base}/${companySlug(company)}` : base;
    contactParts.push(`Portfolio: ${escapeHtml(url)}`);
  }

  const titleHtml = profile.title
    ? `<p class="headline">${escapeHtml(profile.title)}</p>`
    : "";

  return `<h1>${escapeHtml(name)}</h1>
${titleHtml}
<p class="contact">${contactParts.join(" &middot; ")}</p>`;
}

function renderProfileSection(profile: ProfileData, tailoredProfileBullets?: string[]): string {
  const bullets = tailoredProfileBullets ?? profile.summaryBullets ?? [];
  if (!bullets.length && !profile.summary) return "";
  const body = bullets.length
    ? `<ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
    : `<p class="body-text">${escapeHtml(profile.summary!)}</p>`;
  return `<h2>Profile</h2>\n${body}`;
}

function renderSkillsSection(profile: ProfileData): string {
  if (profile.strengthGroups?.length) {
    const lines = profile.strengthGroups.map(
      (group) => `<p class="skills-line"><b>${escapeHtml(group.label)}:</b> ${group.items.map(escapeHtml).join(", ")}</p>`
    );
    return `<h2>Skills</h2>\n${lines.join("\n")}`;
  }
  if (!profile.strengths?.length) return "";
  const line = profile.strengths.map(escapeHtml).join(", ");
  return `<h2>Skills</h2>\n<p class="skills-line"><b>Strengths:</b> ${line}</p>`;
}

function renderExperienceSection(profile: ProfileData, tailoredBullets?: Record<string, string[]>): string {
  if (!profile.experience?.length) return "";
  const roles = profile.experience.map((job, idx) => {
    const key = `${job.company}::${job.role}`;
    const bulletLimit = idx < 2 ? 4 : 2;
    const bullets = tailoredBullets?.[key] ?? job.bullets.slice(0, bulletLimit);
    return `<div class="role-block">
  <div class="role-head">
    <h3>${escapeHtml(job.role)}</h3>
    <div class="role-row">
      <span class="employer">${escapeHtml(job.company)}</span>
      <span class="dates">${formatDateRange(job.start, job.end)}</span>
    </div>
  </div>
  <ul>${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
</div>`;
  });
  return `<h2>Experience</h2>\n${roles.join("\n")}`;
}

function renderAwardsSection(profile: ProfileData): string {
  if (!profile.awards?.length) return "";
  return `<h2>Awards</h2>\n<ul>${profile.awards.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`;
}

function renderEducationSection(profile: ProfileData): string {
  if (!profile.education?.length) return "";
  const entries = profile.education.map((edu) => {
    const details = [edu.degree, edu.honors, edu.graduated].filter(Boolean).map(String).map(escapeHtml).join(" | ");
    return `<div class="edu-entry">
  <div><b>${escapeHtml(edu.institution)}</b></div>
  <div class="details">${details}</div>
</div>`;
  });
  return `<h2>Education</h2>\n${entries.join("\n")}`;
}

export function buildResumeHtml(
  profile: ProfileData,
  candidate: CandidateConfig,
  options: ResumeHtmlOptions = {}
): string {
  const sections = [
    renderProfileSection(profile, options.tailoredProfileBullets),
    renderSkillsSection(profile),
    renderExperienceSection(profile, options.tailoredBullets),
    renderAwardsSection(profile),
    renderEducationSection(profile),
  ].filter(Boolean);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(profile.name ?? candidate.name ?? "Resume")}</title>
${renderStyle()}
</head>
<body>
${renderHeader(profile, candidate, options.company)}
${sections.join("\n")}
</body>
</html>`;
}
