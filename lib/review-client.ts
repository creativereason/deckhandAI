// The browser side of /api/scrape/review, shared by the inbox list and the triage view so
// both approve and dismiss a job the same way.
import type { JobFit } from "@/lib/jobs";

export interface ReviewRequest {
  job: { id?: string; company: string; role: string };
  action: "approve" | "reject";
  fit?: JobFit;
  notes?: string;
  scoreRationale?: string;
}

export type ReviewResult = { ok: true } | { ok: false; demo: true } | { ok: false; demo: false; message: string };

async function failure(res: Response): Promise<ReviewResult> {
  if (res.status === 403) return { ok: false, demo: true };
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: false, demo: false, message: body.error ?? `Error ${res.status}` };
}

export async function submitReview({ job, ...rest }: ReviewRequest): Promise<ReviewResult> {
  // Only the identity travels: a whole pending job would also carry its own `notes`.
  const { id, company, role } = job;
  try {
    const res = await fetch("/api/scrape/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, company, role, ...rest }),
    });
    return res.ok ? { ok: true } : failure(res);
  } catch (err) {
    return { ok: false, demo: false, message: err instanceof Error ? err.message : String(err) };
  }
}
