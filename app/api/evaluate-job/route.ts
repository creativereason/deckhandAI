import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readConfig } from "@/lib/config-repository";
import { getSession } from "@/lib/auth";
import { fetchGenerate } from "@/lib/model";
import { fetchJobDetails, type JobFetchResult } from "@/lib/job-fetcher";
import type { JobFit, PendingJob } from "@/lib/jobs";
import { normalizeAiSummary } from "@/lib/job-summary";
import { readJobs, writeJobs } from "@/lib/jobs-repository";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JobFitSchema = z.enum(["strong", "good", "caution", "weak"]);

const EvaluateRequestSchema = z.object({
  url: z.string().min(1),
  company: z.string().optional(),
  role: z.string().optional(),
  salary: z.string().optional(),
  notes: z.string().optional(),
});

type EvaluateRequest = z.infer<typeof EvaluateRequestSchema>;

const RetrievalSchema = z.object({
  ok: z.boolean(),
  url: z.string(),
  text: z.string(),
  retrieval_method: z.enum(["fetch_only", "brave_search", "playwright"]),
  retrieval_limited: z.boolean(),
  warning: z.string().optional(),
}) satisfies z.ZodType<JobFetchResult>;

const EvaluationPayloadSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  url: z.string().min(1),
  salary: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  fit: JobFitSchema.optional().default("good"),
  scoreRationale: z.string().optional().default(""),
  aiSummary: z.string().optional().default(""),
  retrieval: RetrievalSchema.optional(),
});

type EvaluationPayload = {
  company: string;
  role: string;
  url: string;
  salary: string;
  notes: string;
  fit: JobFit;
  scoreRationale: string;
  aiSummary: string;
  retrieval?: JobFetchResult;
};

const VALID_FITS: JobFit[] = ["strong", "good", "caution", "weak"];

async function isAuthenticated(): Promise<boolean> {
  if (process.env.DEMO_MODE === "true") return true;
  const session = await getSession();
  return session.authenticated === true;
}

function sse(event: "status" | "result" | "error", data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function extractJsonObject(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned) as Record<string, unknown>;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function fitValue(value: unknown): JobFit {
  return VALID_FITS.includes(value as JobFit) ? (value as JobFit) : "good";
}

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function firstSentence(text: string): string {
  return compactText(text).split(/(?<=[.!?])\s+/)[0] ?? "";
}

function firstSentences(text: string, count: number): string {
  return compactText(text).split(/(?<=[.!?])\s+/).slice(0, count).join(" ");
}

function indexOfAny(text: string, patterns: RegExp[], startAt = 0): number {
  const tail = text.slice(startAt);
  const indexes = patterns
    .map((pattern) => {
      const match = tail.match(pattern);
      return match?.index === undefined ? -1 : startAt + match.index;
    })
    .filter((index) => index >= 0);
  return indexes.length ? Math.min(...indexes) : -1;
}

function lastIndexOfAny(text: string, patterns: RegExp[]): number {
  const indexes = patterns
    .map((pattern) => {
      const matches = [...text.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
      const last = matches.at(-1);
      return last?.index ?? -1;
    })
    .filter((index) => index >= 0);
  return indexes.length ? Math.max(...indexes) : -1;
}

// Common section-heading synonyms across ATS templates (Greenhouse, Lever, Ashby, Workday,
// SmartRecruiters) and hand-written postings, for locating where the role description starts.
const ROLE_SECTION_PATTERNS = [
  /\bAbout (?:the|this) Role\b/i,
  /\bAbout (?:the|this) Position\b/i,
  /\bAbout (?:the|this) Job\b/i,
  /\bAbout (?:the|this) Opportunity\b/i,
  /\bThe Role\b/i,
  /\bThe Opportunity\b/i,
  /\bThe Position\b/i,
  /\bRole Overview\b/i,
  /\bRole Summary\b/i,
  /\bPosition Summary\b/i,
  /\bJob Summary\b/i,
  /\bJob Description\b/i,
  /\bRole Description\b/i,
  /\bWhat You.?ll (?:Do|Be Doing)\b/i,
  /\bWhat You Will (?:Do|Be Doing)\b/i,
  /\b(?:Key )?Responsibilities\b/i,
  /\bYour Responsibilities\b/i,
  /\bDuties and Responsibilities\b/i,
  /\bA Day in the Life\b/i,
  /\bDay[\s-]to[\s-]Day\b/i,
];

function stripLeadingHeading(text: string, patterns: RegExp[]): string {
  if (patterns.length === 0) return text;
  const combined = new RegExp(`^(?:${patterns.map((p) => p.source).join("|")})\\s*:?\\s*`, "i");
  return text.replace(combined, "");
}

function focusedJobText(request: EvaluateRequest, rawText: string): string {
  const text = compactText(rawText);
  const roleStart = lastIndexOfAny(text, ROLE_SECTION_PATTERNS);
  const companyName = request.company ? request.company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
  const companyStart = companyName
    ? indexOfAny(text, [new RegExp(`\\bAbout ${companyName}\\b`, "i")])
    : -1;
  const companySummary = companyStart >= 0
    ? firstSentence(text.slice(companyStart, roleStart > companyStart ? roleStart : undefined).replace(/^About\s+\S+\s*/i, ""))
    : "";
  const roleText = roleStart >= 0 ? text.slice(roleStart) : text.replace(/^.*?\bDescription\b/i, "");
  return [companySummary, roleText.slice(0, 1400)].filter(Boolean).join("\n\n");
}

const NAV_BOILERPLATE = /log in|sign in|get in touch|get started|we'?re hiring|copyright|\u00a9 20\d\d|privacy policy|terms of (?:use|service)/gi;
// Site nav/mega-menus (e.g. a client-rendered careers page whose JD never loaded) read as a wall
// of short labels with very few sentence-ending periods relative to their length \u2014 real prose
// runs well under this many words per period. Keyword matching alone misses menus that don't
// happen to mention login/legal boilerplate.
const MIN_WORDS_FOR_PROSE_DENSITY_CHECK = 40;
const MAX_WORDS_PER_SENTENCE = 24;
// How much text after a recognized heading to consider when checking quality — keeps a distant
// footer/legal section from poisoning the check for a legitimate paragraph right after the heading.
const ROLE_TEXT_WINDOW = 700;

function isBoilerplate(text: string): boolean {
  const compact = compactText(text);
  if (compact.length < 80) return true;
  const sentenceCount = compact.split(/(?<=[.!?])\s+/).length;
  const navHitCount = (compact.match(NAV_BOILERPLATE) ?? []).length;
  if (navHitCount >= 2 || (navHitCount >= 1 && sentenceCount <= 3)) return true;
  const wordCount = compact.split(/\s+/).length;
  return wordCount > MIN_WORDS_FOR_PROSE_DENSITY_CHECK && wordCount / sentenceCount > MAX_WORDS_PER_SENTENCE;
}

function roleDescriptionSummary(request: EvaluateRequest, rawText: string): string {
  const text = compactText(rawText);
  const roleStart = lastIndexOfAny(text, ROLE_SECTION_PATTERNS);
  const roleText = roleStart >= 0 ? text.slice(roleStart) : text.replace(/^.*?\bDescription\b/i, "");
  // Bounded so unrelated boilerplate deep in the same page (footer, legal text) can't poison
  // the quality check for a legitimate paragraph found right after the heading.
  const localWindow = stripLeadingHeading(roleText, ROLE_SECTION_PATTERNS).slice(0, ROLE_TEXT_WINDOW);
  if (isBoilerplate(localWindow)) return "";
  return firstSentences(localWindow, 2);
}

// Common "about the employer" section-heading synonyms across ATS templates and hand-written postings.
const COMPANY_SECTION_PATTERNS = [
  /\bAbout (?:the Company|Our Company|Us)\b/i,
  /\bCompany Overview\b/i,
  /\bWho We Are\b/i,
  /\bOur Story\b/i,
  /\bOur Mission\b/i,
  /\bWhat We Do\b/i,
];

function companySummary(request: EvaluateRequest, rawText: string): string {
  const text = compactText(rawText);
  const roleStart = lastIndexOfAny(text, ROLE_SECTION_PATTERNS);
  const companyName = request.company ? request.company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
  const namedPattern = companyName ? [new RegExp(`\\bAbout ${companyName}\\b`, "i")] : [];
  const companyPatterns = [...namedPattern, ...COMPANY_SECTION_PATTERNS];
  const companyStart = indexOfAny(text, companyPatterns);
  if (companyStart >= 0) {
    const slice = stripLeadingHeading(
      text.slice(companyStart, roleStart > companyStart ? roleStart : undefined),
      companyPatterns
    );
    const summary = firstSentences(slice, 2);
    if (!isBoilerplate(summary)) return summary;
  }
  // Fallback: use the first substantive paragraph in the first 800 chars
  const opener = text.slice(0, 800);
  const paragraphs = opener.split(/\s{2,}|\n+/).map((p) => p.trim()).filter((p) => p.length > 60);
  const candidate = paragraphs.find((p) => !isBoilerplate(p));
  if (candidate) return firstSentences(candidate, 2);
  return request.company ? `${request.company} company summary unavailable.` : "Company summary unavailable.";
}

function buildTrackerNotes(request: EvaluateRequest, retrieval: JobFetchResult): string {
  const scrapedDate = new Date().toISOString().slice(0, 10);
  const company = companySummary(request, retrieval.text);
  const role = roleDescriptionSummary(request, retrieval.text);
  const companyUnavailable = company.includes("unavailable");
  const roleUnavailable = !role;
  if (companyUnavailable && roleUnavailable) {
    return `Scraped ${scrapedDate}. No relevant job description found at the URL (page appears changed or blocked). Notes unchanged.`;
  }
  const roleText = role || "Role summary unavailable.";
  return `Scraped ${scrapedDate}.\n\nCompany: ${company}\n\nRole: ${roleText}`;
}

// Non-AI aiSummary: one sentence of what the role is + one of what the company
// does, pulled from the same section heuristics that feed notes. Empty when
// neither section could be extracted — the UI falls back to notes.
function heuristicAiSummary(request: EvaluateRequest, retrieval: JobFetchResult): string {
  // Section extraction can leave a stray "." where a heading was stripped, so
  // take the first sentence that actually contains prose.
  const firstProseSentence = (text: string): string =>
    compactText(text).split(/(?<=[.!?])\s+/).find((s) => /[a-z0-9]/i.test(s)) ?? "";
  const role = firstProseSentence(roleDescriptionSummary(request, retrieval.text));
  const company = firstProseSentence(companySummary(request, retrieval.text));
  const parts = [role, company.includes("unavailable") ? "" : company].filter(Boolean);
  return normalizeAiSummary(parts.join(" "));
}

function fallbackEvaluation(request: EvaluateRequest, retrieval: JobFetchResult): EvaluationPayload {
  const notes = buildTrackerNotes(request, retrieval);
  return {
    company: request.company ?? "",
    role: request.role ?? "",
    url: request.url ?? retrieval.url,
    salary: request.salary ?? "",
    notes: request.notes || notes,
    fit: "good",
    scoreRationale: retrieval.retrieval_limited
      ? "Automatic retrieval was limited, so fit needs manual review."
      : "Retrieved job details; configure AI to score fit automatically.",
    aiSummary: heuristicAiSummary(request, retrieval),
    retrieval,
  };
}

function buildEvaluationPrompt(request: EvaluateRequest, retrieval: JobFetchResult): string {
  const focusedText = focusedJobText(request, retrieval.text);
  return `Extract and evaluate this job posting for a personal job tracker.

Known fields:
Company: ${request.company ?? "unknown"}
Role: ${request.role ?? "unknown"}
Salary: ${request.salary ?? "unknown"}
URL: ${request.url}
Existing notes: ${request.notes ?? "none"}

Job text, with job-board navigation removed where possible:
${focusedText || retrieval.text.slice(0, 6000)}

For notes:
- Do not write fit assessment in notes; fit belongs only in scoreRationale.
- Notes will be generated separately from the retrieved company and role sections.

For aiSummary:
- A 1–2 sentence at-a-glance summary: what the role is (scope, team, key responsibilities) and what the company does.
- No fit assessment, no markdown, no quotes.

Return only valid JSON:
{"company":"","role":"","salary":"","notes":"","fit":"strong|good|caution|weak","scoreRationale":"","aiSummary":""}`;
}

async function evaluateWithAI(
  request: EvaluateRequest,
  retrieval: JobFetchResult
): Promise<EvaluationPayload> {
  const config = await readConfig();
  if (!process.env.AI_API_KEY && config.ai?.provider !== "ollama") {
    return fallbackEvaluation(request, retrieval);
  }

  const raw = await fetchGenerate(config.ai ?? {}, [
    { role: "system", content: "You extract job details and score fit. Return only valid JSON." },
    { role: "user", content: buildEvaluationPrompt(request, retrieval) },
  ]);
  const parsed = extractJsonObject(raw);
  const notes = request.notes || buildTrackerNotes(request, retrieval);
  return {
    company: textValue(parsed.company) || request.company || "",
    role: textValue(parsed.role) || request.role || "",
    url: request.url ?? retrieval.url,
    salary: textValue(parsed.salary) || request.salary || "",
    notes,
    fit: fitValue(parsed.fit),
    scoreRationale: textValue(parsed.scoreRationale) || textValue(parsed.rationale),
    aiSummary: normalizeAiSummary(parsed.aiSummary) || heuristicAiSummary(request, retrieval),
    retrieval,
  };
}

function pendingFromEvaluation(payload: EvaluationPayload): PendingJob {
  return {
    company: payload.company,
    role: payload.role,
    url: payload.url,
    salary: payload.salary,
    notes: payload.notes,
    scrapeGroup: "remote",
    scrapeDate: new Date().toISOString().slice(0, 10),
    fit: payload.fit,
    scoreRationale: payload.scoreRationale,
    aiSummary: payload.aiSummary,
  };
}

function alreadyTracked(jobs: Awaited<ReturnType<typeof readJobs>>, pending: PendingJob): boolean {
  return Object.values(jobs)
    .filter(Array.isArray)
    .flat()
    .some((job) =>
      pending.url
        ? job.url === pending.url
        : job.company === pending.company && job.role === pending.role
    );
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = EvaluateRequestSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json({ error: parsedBody.error.flatten() }, { status: 400 });
  }
  const body = parsedBody.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: "status" | "result" | "error", data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      try {
        emit("status", "Fetching page...");
        const retrieval = await fetchJobDetails({
          url: body.url,
          company: body.company,
          role: body.role,
        });
        if (retrieval.retrieval_limited) {
          emit("status", retrieval.warning ?? "Retrieval was limited.");
        } else if (retrieval.retrieval_method === "brave_search") {
          emit("status", "Found a fetchable cross-post. Extracting job details...");
        } else if (retrieval.retrieval_method === "playwright") {
          emit("status", "Browser page loaded. Extracting job details...");
        }

        emit("status", "Scoring fit against your profile...");
        const evaluation = await evaluateWithAI(body, retrieval);
        emit("result", evaluation);
      } catch (err) {
        emit("error", err instanceof Error ? err.message : String(err));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function PUT(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedPayload = EvaluationPayloadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedPayload.success) {
    return NextResponse.json({ error: parsedPayload.error.flatten() }, { status: 400 });
  }
  const payload = parsedPayload.data;

  const jobs = await readJobs();
  const pending = pendingFromEvaluation(payload);
  if (alreadyTracked(jobs, pending)) return NextResponse.json({ ok: true, duplicate: true });

  jobs.pending.unshift(pending);
  await writeJobs(jobs);
  return NextResponse.json({ ok: true, pending });
}
