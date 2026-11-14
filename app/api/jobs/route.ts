import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { JobSection } from "@/lib/jobs";
import { DeleteJobBody, PatchJobBody, PostJobBody } from "@/lib/job-schemas";
import { addJob, archiveJob, getJob, readJobs, saveJob } from "@/lib/jobs-repository";
import { generateAiSummary } from "@/lib/job-summary-server";

export const dynamic = "force-dynamic";

type AnyJob = Record<string, unknown>;

function normalizeJobForSection(job: AnyJob, targetSection: JobSection): AnyJob {
  const normalized = { ...job };
  if (targetSection === "applied") {
    if (!normalized.status) normalized.status = "applied";
    if (!normalized.date) normalized.date = new Date().toISOString().slice(0, 10);
  } else if (targetSection === "prospect" || targetSection === "local" || targetSection === "staffing") {
    if (!normalized.fit) normalized.fit = "good";
  }
  return normalized;
}

/** Parses the request body; a bad or missing body is the caller's mistake (400), never a server error. */
async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  const parsed = schema.safeParse(await req.json().catch(() => undefined));
  if (parsed.success) return { data: parsed.data };
  // `error` is a plain string because the UI shows it as text; `issues` carries the full field paths.
  const issues = parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  const error = `Invalid request: ${issues.map((i) => `${i.path || "body"} ${i.message}`).join("; ")}`;
  return { response: NextResponse.json({ error, issues }, { status: 400 }) };
}

export async function GET() {
  const jobs = await readJobs();
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req, PostJobBody);
    if ("response" in body) return body.response;
    const { section, job } = body.data;
    if (!job.aiSummary) {
      job.aiSummary = await generateAiSummary({
        company: job.company,
        role: job.role,
        salary: job.salary,
        notes: job.notes,
      });
    }
    await addJob(section, job);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await parseBody(req, PatchJobBody);
    if ("response" in body) return body.response;
    const { id, section, company, role, updates, targetSection } = body.data;
    const ref = { id, section, company, role };
    const found = await getJob(ref);
    if (!found) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const updated = { ...found.job, ...updates };
    const dest = targetSection ?? found.section;
    if (dest !== found.section) delete updated.isNew;
    const job = dest !== found.section ? normalizeJobForSection(updated, dest) : updated;
    await saveJob(ref, { section: dest, job });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await parseBody(req, DeleteJobBody);
    if ("response" in body) return body.response;
    const { id, section, company, role, targetSection } = body.data;
    const ref = { id, section, company, role };
    const found = await getJob(ref);
    if (!found) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (targetSection) {
      const { isNew: _dropped, ...job } = found.job;
      await saveJob(ref, { section: targetSection, job: normalizeJobForSection(job, targetSection) });
    } else {
      await archiveJob(ref);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
