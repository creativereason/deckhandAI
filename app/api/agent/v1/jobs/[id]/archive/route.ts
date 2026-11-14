import { NextResponse } from "next/server";
import { archiveJobOp } from "@/lib/agent-job-ops";
import { withAgent } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

/** There is deliberately no hard delete and no restore here; restoring stays with the signed-in user. */
export const POST = withAgent<{ id: string }>("jobs:archive", async (_req, { repo, params }) => {
  const { status, body } = await archiveJobOp(repo, params.id);
  return NextResponse.json(body, { status });
});
