import { NextRequest, NextResponse } from "next/server";
import { agentAdminStore, agentErrorResponse } from "@/lib/agent-admin";
import { AgentId } from "@/lib/agent-schemas";
import { revokeAgent } from "@/lib/agents";

export const dynamic = "force-dynamic";

/** Agents are never deleted: revoking stops the key working and keeps the history attributable. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await agentAdminStore();
  if ("response" in guard) return guard.response;
  const id = AgentId.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  try {
    const found = await revokeAgent(guard.value, id.data);
    return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Agent not found" }, { status: 404 });
  } catch (err) {
    return agentErrorResponse(err);
  }
}
