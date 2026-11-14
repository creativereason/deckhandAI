import { NextResponse } from "next/server";
import { moveJobOp } from "@/lib/agent-job-ops";
import { withAgent } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

export const POST = withAgent<{ id: string }>("jobs:triage", async (req, { repo, params }) => {
  const { status, body } = await moveJobOp(repo, params.id, await req.json().catch(() => undefined));
  return NextResponse.json(body, { status });
});
