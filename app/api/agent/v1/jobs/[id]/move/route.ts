import { NextResponse } from "next/server";
import { AgentMoveJob, JobId } from "@/lib/agent-job-schemas";
import { agentJobView } from "@/lib/agent-job-response";
import { withAgent } from "@/lib/agent-auth";
import { normalizeForSection } from "@/lib/job-normalize";
import { parseBody } from "@/lib/parse-body";

export const dynamic = "force-dynamic";

/** Triage: move a job between sections, including out of the inbox. */
export const POST = withAgent<{ id: string }>("jobs:triage", async (req, { repo, params }) => {
  const id = JobId.safeParse(params.id);
  if (!id.success) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const body = await parseBody(req, AgentMoveJob);
  if ("response" in body) return body.response;

  const found = await repo.get({ id: id.data });
  if (!found) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (found.section === body.value.to) {
    return NextResponse.json({ error: `The job is already in ${found.section}` }, { status: 400 });
  }
  const { isNew: _dropped, ...rest } = found.job;
  const job = normalizeForSection(rest, body.value.to);
  await repo.save({ id: id.data }, { section: body.value.to, job });
  return NextResponse.json({ job: agentJobView({ id: found.id, section: body.value.to, job }) });
});
