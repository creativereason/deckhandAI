import { NextResponse } from "next/server";
import { AgentEditJob, JobId } from "@/lib/agent-job-schemas";
import { agentJobView } from "@/lib/agent-job-response";
import { withAgent } from "@/lib/agent-auth";
import { parseBody } from "@/lib/parse-body";

export const dynamic = "force-dynamic";

type Params = { id: string };
const notFound = () => NextResponse.json({ error: "Job not found" }, { status: 404 });

export const GET = withAgent<Params>("jobs:read", async (_req, { repo, params }) => {
  const id = JobId.safeParse(params.id);
  const found = id.success ? await repo.get({ id: id.data }) : undefined;
  return found ? NextResponse.json({ job: agentJobView(found) }) : notFound();
});

/** Only notes, summary, score rationale and fit; the schema rejects every other field. */
export const PATCH = withAgent<Params>("jobs:edit", async (req, { repo, params }) => {
  const id = JobId.safeParse(params.id);
  if (!id.success) return notFound();
  const body = await parseBody(req, AgentEditJob);
  if ("response" in body) return body.response;

  const found = await repo.get({ id: id.data });
  if (!found) return notFound();
  const job = { ...found.job, ...body.value };
  await repo.save({ id: id.data }, { section: found.section, job });
  return NextResponse.json({ job: agentJobView({ ...found, job }) });
});
