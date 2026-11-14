import { NextResponse } from "next/server";
import { AgentCreateJob, AgentListQuery } from "@/lib/agent-job-schemas";
import { agentJobView } from "@/lib/agent-job-response";
import { withAgent } from "@/lib/agent-auth";
import { normalizeForSection } from "@/lib/job-normalize";
import { SECTIONS } from "@/lib/jobs-mapping";
import { parseBody, parseValue } from "@/lib/parse-body";

export const dynamic = "force-dynamic";

type Job = Record<string, unknown>;

export const GET = withAgent("jobs:read", async (req, { repo }) => {
  const query = parseValue(Object.fromEntries(req.nextUrl.searchParams), AgentListQuery);
  if ("response" in query) return query.response;
  const { section, limit, offset } = query.value;

  const board = await repo.readBoard();
  const all = (section ? [section] : SECTIONS).flatMap((name) =>
    (board[name] as unknown as Job[]).map((job) => ({ ...job, section: name })),
  );
  return NextResponse.json({ jobs: all.slice(offset, offset + limit), total: all.length, limit, offset });
});

/** Agents add to the inbox (pending) and nowhere else; a human triages from there. */
export const POST = withAgent("jobs:add_pending", async (req, { repo }) => {
  const body = await parseBody(req, AgentCreateJob);
  if ("response" in body) return body.response;
  const { company, role, ...rest } = body.value;
  const candidate = { company: company.trim(), role: role.trim(), url: rest.url.trim() };

  // Includes archived jobs, so an agent cannot re-add something that was removed.
  const existing = await repo.findExisting(candidate);
  if (existing) {
    return NextResponse.json({ error: "This job is already tracked", existing }, { status: 409 });
  }
  const job = normalizeForSection({ ...rest, ...candidate }, "pending");
  const id = await repo.add("pending", job);
  return NextResponse.json({ job: agentJobView({ id: id ?? "", section: "pending", job }) }, { status: 201 });
});
