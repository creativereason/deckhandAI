import { NextRequest, NextResponse } from "next/server";
import type { JobFit, JobSection, PendingJob, ProspectJob } from "@/lib/jobs";
import { archiveJob, getJob, saveJob } from "@/lib/jobs-repository";

interface ReviewBody {
  id?: string;
  company: string;
  role: string;
  action: "approve" | "reject";
  fit?: JobFit;
  notes?: string;
  scoreRationale?: string;
}

function approvedJob(pending: PendingJob, body: ReviewBody): ProspectJob {
  return {
    company: pending.company,
    role: pending.role,
    fit: body.fit ?? "good",
    salary: pending.salary ?? "",
    notes: body.notes ?? `Scraped ${pending.scrapeDate}`,
    url: pending.url,
    isNew: true,
    ...(body.scoreRationale ? { scoreRationale: body.scoreRationale } : {}),
  };
}

function rejectedJob(pending: PendingJob) {
  return {
    company: pending.company,
    role: pending.role,
    salary: "",
    notes: `Rejected from scrape queue ${pending.scrapeDate}`,
    url: pending.url,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as ReviewBody;
  const { id, company, role, action } = body;

  if (!company || !role || !action) {
    return NextResponse.json({ error: "company, role, and action are required" }, { status: 400 });
  }

  const ref = { id, section: "pending" as const, company, role };
  const found = await getJob(ref);
  if (!found) return NextResponse.json({ error: "Pending job not found" }, { status: 404 });

  const pending = found.job as unknown as PendingJob;
  const approved = action === "approve";
  const section: JobSection = !approved ? "passed" : pending.scrapeGroup === "local" ? "local" : "prospect";
  const job = approved ? approvedJob(pending, body) : rejectedJob(pending);

  await saveJob(ref, { section, job: job as unknown as Record<string, unknown> });
  return NextResponse.json({ ok: true, action, section: pending.scrapeGroup });
}

export async function DELETE(req: NextRequest) {
  const { id, company, role } = await req.json().catch(() => ({})) as { id?: string; company?: string; role?: string };

  if (!company || !role) {
    return NextResponse.json({ error: "company and role are required" }, { status: 400 });
  }

  await archiveJob({ id, section: "pending", company, role });
  return NextResponse.json({ ok: true });
}
