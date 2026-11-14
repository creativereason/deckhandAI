import { NextRequest, NextResponse } from "next/server";
import { agentAdminStore, agentErrorResponse, parseAgentBody } from "@/lib/agent-admin";
import { AgentId, UpdateAgentBody } from "@/lib/agent-schemas";
import { setAgentScopes } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await agentAdminStore();
  if ("response" in guard) return guard.response;
  const id = AgentId.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  const body = await parseAgentBody(req, UpdateAgentBody);
  if ("response" in body) return body.response;
  try {
    const found = await setAgentScopes(guard.value, id.data, body.value.scopes);
    return found ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Agent not found" }, { status: 404 });
  } catch (err) {
    return agentErrorResponse(err);
  }
}
