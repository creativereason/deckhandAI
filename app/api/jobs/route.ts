import { NextRequest, NextResponse } from "next/server";
import { readJobs, writeJobs, JobSection, type JobsData } from "@/lib/jobs";
import { readFileSync } from "fs";
import { resolve } from "path";

export const dynamic = "force-dynamic";

function isDemo() { return process.env.DEMO_MODE === "true"; }

function readSampleJobs(): JobsData {
  const persona = process.env.DEMO_PERSONA ?? "design";
  const file = persona === "dev" ? "data/jobs-dev.sample.json" : "data/jobs.sample.json";
  try {
    const raw = readFileSync(resolve(process.cwd(), file), "utf-8");
    return { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [], ...JSON.parse(raw) };
  } catch {
    return { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };
  }
}

function demoReadOnly() {
  return NextResponse.json({ error: "Read-only in demo mode" }, { status: 403 });
}

type AnyJob = Record<string, unknown>;

function normalizeJobForSection(job: AnyJob, targetSection: JobSection): AnyJob {
  const normalized = { ...job };
  if (targetSection === "applied") {
    if (!normalized.status) normalized.status = "applied";
    if (normalized.date === undefined) normalized.date = "";
  } else if (targetSection === "prospect" || targetSection === "local" || targetSection === "staffing") {
    if (!normalized.fit) normalized.fit = "good";
  }
  return normalized;
}

export async function GET() {
  const jobs = isDemo() ? readSampleJobs() : await readJobs();
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  if (isDemo()) return demoReadOnly();
  try {
    const body = await req.json();
    const { section, job } = body as { section: JobSection; job: Record<string, string> };
    if (!section || !job) return NextResponse.json({ error: "Missing section or job" }, { status: 400 });
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
  if (isDemo()) return demoReadOnly();
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
  if (isDemo()) return demoReadOnly();
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
