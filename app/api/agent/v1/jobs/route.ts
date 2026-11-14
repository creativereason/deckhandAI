import { NextResponse } from "next/server";
import { addJobOp, listJobsOp } from "@/lib/agent-job-ops";
import { withAgent } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const send = ({ status, body }: { status: number; body: Record<string, unknown> }) => NextResponse.json(body, { status });

export const GET = withAgent("jobs:read", async (req, { repo }) =>
  send(await listJobsOp(repo, Object.fromEntries(req.nextUrl.searchParams))),
);

export const POST = withAgent("jobs:add_pending", async (req, { repo }) =>
  send(await addJobOp(repo, await req.json().catch(() => undefined))),
);
