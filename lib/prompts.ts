import type { Profile } from "@/lib/profile";

export type GenerationType = "cover-letter" | "tailoring-notes";

export interface JobContext {
  company: string;
  role: string;
  url?: string;
  jdText?: string;
  angle?: string;
}

function formatExperience(profile: Profile): string {
  if (!profile.experience?.length) return "";
  return profile.experience
    .map((e) => {
      const period = e.end ? `${e.start} – ${e.end}` : `${e.start} – Present`;
      const bullets = e.bullets.map((b) => `  - ${b}`).join("\n");
      return `${e.role} at ${e.company} (${period})\n${bullets}`;
    })
    .join("\n\n");
}

function formatEducation(profile: Profile): string {
  if (!profile.education?.length) return "";
  return profile.education
    .map((e) => {
      const honors = e.honors ? `, ${e.honors}` : "";
      return `${e.degree} — ${e.institution} (${e.graduated}${honors})`;
    })
    .join("\n");
}

export function buildSystemPrompt(profile: Profile): string {
  const rules = (profile.writing_rules ?? []).map((r) => `- ${r}`).join("\n");
  const strengths = (profile.strengths ?? []).join(", ");
  const experience = formatExperience(profile);
  const education = formatEducation(profile);

  return `You are a professional writing assistant helping ${profile.name ?? "a job seeker"} with job application documents.

CANDIDATE PROFILE
Name: ${profile.name ?? ""}
Title: ${profile.title ?? ""}
Summary: ${profile.summary ?? ""}
Core strengths: ${strengths}
${profile.portfolio_url ? `Portfolio: ${profile.portfolio_url}${profile.portfolio_password ? ` (pw: ${profile.portfolio_password})` : ""}` : ""}

WORK HISTORY
${experience || "No work history provided."}

EDUCATION
${education || "Not provided."}

WRITING RULES — follow these exactly:
${rules || "Write in a clear, direct, professional voice."}

Always write in first person. Do not invent experience or credentials not listed above.`.trim();
}

export function buildUserPrompt(job: JobContext, type: GenerationType): string {
  const jdSection = job.jdText
    ? `\nJOB DESCRIPTION\n${job.jdText.slice(0, 6000)}`
    : "";

  const angleSection = job.angle
    ? `\nSPECIFIC ANGLE OR EMPHASIS\n${job.angle}`
    : "";

  if (type === "cover-letter") {
    return `Write a cover letter for the following role.

ROLE: ${job.role} at ${job.company}
URL: ${job.url ?? "not provided"}
${jdSection}${angleSection}

Write a 3–4 paragraph cover letter. Do not include address blocks, date, or "Dear Hiring Manager" — start directly with the opening paragraph. Do not include a subject line. End after the closing paragraph — no signature block.`.trim();
  }

  return `Write resume tailoring notes for the following role.

ROLE: ${job.role} at ${job.company}
URL: ${job.url ?? "not provided"}
${jdSection}${angleSection}

Provide:
1. A 2–3 sentence summary of what this role prioritizes and how the candidate's background fits.
2. 3–5 specific resume bullets to emphasize or reword for this role, with the original and suggested revision.
3. Any keywords or phrases from the JD worth including in the resume or cover letter.`.trim();
}
