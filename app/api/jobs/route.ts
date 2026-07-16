import { NextRequest, NextResponse } from "next/server";
import { JobSection } from "@/lib/jobs";
import { readJobs, writeJobs } from "@/lib/jobs-repository";
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

export async function GET() {
  const jobs = await readJobs();
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { section, job } = body as { section: JobSection; job: Record<string, string> };
    if (!section || !job) return NextResponse.json({ error: "Missing section or job" }, { status: 400 });
    if (!job.aiSummary) {
      job.aiSummary = await generateAiSummary({
        company: job.company ?? "",
        role: job.role ?? "",
        salary: job.salary,
        notes: job.notes,
      });
    }
    const jobs = await readJobs();
    (jobs[section] as unknown as Record<string, string>[]).unshift(job);
    await writeJobs(jobs);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { section, company, role, updates, targetSection } = body as {
      section: JobSection;
      company: string;
      role: string;
      updates: Record<string, unknown>;
      targetSection?: JobSection;
    };
    const jobs = await readJobs();
    const list = jobs[section] as unknown as AnyJob[];
    const idx = list.findIndex((j) => j.company === company && j.role === role);
    if (idx === -1) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const updated = { ...list[idx], ...updates };
    const dest = targetSection ?? section;
    if (dest !== section) {
      delete updated.isNew;
      list.splice(idx, 1);
      (jobs[dest] as unknown as AnyJob[]).unshift(normalizeJobForSection(updated, dest));
    } else {
      list[idx] = updated;
    }
    await writeJobs(jobs);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { section, company, role, targetSection } = body as {
      section: JobSection;
      company: string;
      role: string;
      targetSection?: JobSection;
    };
    const jobs = await readJobs();
    const list = jobs[section] as unknown as AnyJob[];
    const idx = list.findIndex((j) => j.company === company && j.role === role);
    if (idx === -1) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const [removed] = list.splice(idx, 1);
    delete removed.isNew;
    if (targetSection) {
      (jobs[targetSection] as unknown as AnyJob[]).unshift(normalizeJobForSection(removed, targetSection));
    }
    await writeJobs(jobs);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
