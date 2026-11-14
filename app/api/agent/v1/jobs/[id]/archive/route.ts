import { NextResponse } from "next/server";
import { JobId } from "@/lib/agent-job-schemas";
import { withAgent } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

/**
 * Soft-delete: the job leaves the board but its row stays, and the event log records who did it.
 * There is deliberately no hard delete and no restore here; restoring stays with the signed-in user.
 */
export const POST = withAgent<{ id: string }>("jobs:archive", async (_req, { repo, params }) => {
  const id = JobId.safeParse(params.id);
  const archived = id.success && (await repo.archive({ id: id.data }));
  return archived ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Job not found" }, { status: 404 });
});
