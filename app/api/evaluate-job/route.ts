import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readConfig } from "@/lib/config";
import { getSession } from "@/lib/auth";
import { fetchGenerate } from "@/lib/model";
import { fetchJobDetails, type JobFetchResult } from "@/lib/job-fetcher";
import { readJobs, writeJobs, type JobFit, type PendingJob } from "@/lib/jobs";

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

const ROLE_SECTION_PATTERNS = [
  /\bAbout (?:the|this) Role\b/i,
  /\bAbout (?:the|this) Position\b/i,
  /\bThe Role\b/i,
  /\bPosition Summary\b/i,
  /\bJob Description\b/i,
];

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

const NAV_BOILERPLATE = /log in|sign in|get in touch|get started|we'?re hiring|copyright|\u00a9 20\d\d|privacy policy|terms of (?:use|service)/i;

function isBoilerplate(text: string): boolean {
  const compact = compactText(text);
  if (compact.length < 80) return true;
  const sentenceCount = compact.split(/(?<=[.!?])\s+/).length;
  const navHitCount = (compact.match(NAV_BOILERPLATE) ?? []).length;
  return navHitCount >= 2 || (navHitCount >= 1 && sentenceCount <= 3);
}

function roleDescriptionSummary(request: EvaluateRequest, rawText: string): string {
  const text = compactText(rawText);
  const roleStart = lastIndexOfAny(text, ROLE_SECTION_PATTERNS);
  let roleText: string;
  if (roleStart >= 0) {
    roleText = text.slice(roleStart);
  } else {
    const afterDescription = text.replace(/^.*?\bDescription\b/i, "");
    if (isBoilerplate(afterDescription)) return "";
    roleText = afterDescription;
  }
  const withoutHeading = roleText.replace(
    /^(About (?:the|this) Role|About (?:the|this) Position|The Role|Position Summary|Job Description)\s*/i,
    ""
  );
  if (isBoilerplate(withoutHeading)) return "";
  return firstSentences(withoutHeading, 2);
}

const COMPANY_SECTION_PATTERNS = [
  /\bAbout (?:the Company|Our Company|Us)\b/i,
  /\bCompany Overview\b/i,
  /\bWho We Are\b/i,
];

function companySummary(request: EvaluateRequest, rawText: string): string {
  const text = compactText(rawText);
  const roleStart = lastIndexOfAny(text, ROLE_SECTION_PATTERNS);
  const companyName = request.company ? request.company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : "";
  const namedPattern = companyName ? [new RegExp(`\\bAbout ${companyName}\\b`, "i")] : [];
  const companyStart = indexOfAny(text, [...namedPattern, ...COMPANY_SECTION_PATTERNS]);
  if (companyStart >= 0) {
    const slice = text.slice(companyStart, roleStart > companyStart ? roleStart : undefined)
      .replace(/^About\s+\S+\s*/i, "")
      .replace(/^(?:the Company|Our Company|Us|Company Overview|Who We Are)\s*/i, "");
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

Return only valid JSON:
{"company":"","role":"","salary":"","notes":"","fit":"strong|good|caution|weak","scoreRationale":""}`;
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
  if (process.env.DEMO_MODE === "true") {
    return NextResponse.json({ error: "Read-only in demo mode" }, { status: 403 });
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
