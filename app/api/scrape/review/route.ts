import { NextRequest, NextResponse } from "next/server";
import { readJobs, writeJobs } from "@/lib/jobs";
import type { JobFit, ProspectJob } from "@/lib/jobs";

const IS_DEMO = process.env.DEMO_MODE === "true";

export async function POST(req: NextRequest) {
  if (IS_DEMO) return NextResponse.json({ error: "Read-only in demo mode" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const { company, role, action, fit, notes, scoreRationale } = body as {
    company: string;
    role: string;
    action: "approve" | "reject";
    fit?: JobFit;
    notes?: string;
    scoreRationale?: string;
  };

  if (!company || !role || !action) {
    return NextResponse.json({ error: "company, role, and action are required" }, { status: 400 });
  }

  const jobs = await readJobs();
  if (!jobs.pending) jobs.pending = [];

  const idx = jobs.pending.findIndex((j) => j.company === company && j.role === role);
  if (idx === -1) {
    return NextResponse.json({ error: "Pending job not found" }, { status: 404 });
  }

  const [pending] = jobs.pending.splice(idx, 1);

  if (action === "approve") {
    const approved: ProspectJob = {
      company: pending.company,
      role: pending.role,
      fit: fit ?? "good",
      salary: pending.salary ?? "",
      notes: notes ?? `Scraped ${pending.scrapeDate}`,
      url: pending.url,
      isNew: true,
      ...(scoreRationale ? { scoreRationale } : {}),
    };

    if (pending.scrapeGroup === "local") {
      jobs.local.unshift(approved);
    } else {
      jobs.prospect.unshift(approved);
    }
  } else {
    jobs.passed.push({
      company: pending.company,
      role: pending.role,
      salary: "",
      notes: `Rejected from scrape queue ${pending.scrapeDate}`,
      url: pending.url,
    });
  }

  await writeJobs(jobs);
  return NextResponse.json({ ok: true, action, section: pending.scrapeGroup });
}

export async function DELETE(req: NextRequest) {
  if (IS_DEMO) return NextResponse.json({ error: "Read-only in demo mode" }, { status: 403 });
  const { company, role } = await req.json().catch(() => ({}));

  if (!company || !role) {
    return NextResponse.json({ error: "company and role are required" }, { status: 400 });
  }

  const jobs = await readJobs();
  if (!jobs.pending) jobs.pending = [];
  jobs.pending = jobs.pending.filter((j) => !(j.company === company && j.role === role));
  await writeJobs(jobs);
  return NextResponse.json({ ok: true });
}
