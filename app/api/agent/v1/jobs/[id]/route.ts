import { NextResponse } from "next/server";
import { editJobOp, getJobOp } from "@/lib/agent-job-ops";
import { withAgent } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

const send = ({ status, body }: { status: number; body: Record<string, unknown> }) => NextResponse.json(body, { status });

export const GET = withAgent<{ id: string }>("jobs:read", async (_req, { repo, params }) => send(await getJobOp(repo, params.id)));

export const PATCH = withAgent<{ id: string }>("jobs:edit", async (req, { repo, params }) =>
  send(await editJobOp(repo, params.id, await req.json().catch(() => undefined))),
);
