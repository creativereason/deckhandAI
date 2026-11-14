import { NextRequest, NextResponse } from "next/server";
import { agentAdminStore, agentErrorResponse, parseAgentBody } from "@/lib/agent-admin";
import { CreateAgentBody } from "@/lib/agent-schemas";
import { createAgent, listAgents } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await agentAdminStore();
  if ("response" in guard) return guard.response;
  try {
    return NextResponse.json({ agents: await listAgents(guard.value) });
  } catch (err) {
    return agentErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const guard = await agentAdminStore();
  if ("response" in guard) return guard.response;
  const body = await parseAgentBody(req, CreateAgentBody);
  if ("response" in body) return body.response;
  try {
    const { agent, key } = await createAgent(guard.value, body.value);
    // The only time the key is ever shown: never let a cache keep it.
    return NextResponse.json({ agent, key }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return agentErrorResponse(err);
  }
}
