import { NextRequest, NextResponse } from "next/server";
import { DeleteJobBody, PatchJobBody, PostJobBody } from "@/lib/job-schemas";
import { addJob, archiveJob, getJob, readJobs, saveJob } from "@/lib/jobs-repository";
import { generateAiSummary } from "@/lib/job-summary-server";
import { normalizeForSection } from "@/lib/job-normalize";
import { parseBody } from "@/lib/parse-body";

export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await readJobs();
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseBody(req, PostJobBody);
    if ("response" in body) return body.response;
    const { section, job } = body.value;
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
    const { id, section, company, role, updates, targetSection } = body.value;
    const ref = { id, section, company, role };
    const found = await getJob(ref);
    if (!found) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const updated = { ...found.job, ...updates };
    const dest = targetSection ?? found.section;
    if (dest !== found.section) delete updated.isNew;
    const job = dest !== found.section ? normalizeForSection(updated, dest) : updated;
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
    const { id, section, company, role, targetSection } = body.value;
    const ref = { id, section, company, role };
    const found = await getJob(ref);
    if (!found) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (targetSection) {
      const { isNew: _dropped, ...job } = found.job;
      await saveJob(ref, { section: targetSection, job: normalizeForSection(job, targetSection) });
    } else {
      await archiveJob(ref);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
