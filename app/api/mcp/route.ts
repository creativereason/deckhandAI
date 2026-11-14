import { NextResponse } from "next/server";
import { withAgent } from "@/lib/agent-auth";
import { handleMcp } from "@/lib/mcp-server";

export const dynamic = "force-dynamic";

const PARSE_ERROR = Symbol("parse error");

// Authenticated here, scoped per tool inside handleMcp (which tools an agent sees depends on
// its scopes). There is no GET handler: this server never opens a streaming channel.
export const POST = withAgent(null, async (req, { agent, repo }) => {
  const message = await req.json().catch(() => PARSE_ERROR);
  if (message === PARSE_ERROR) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  const response = await handleMcp(message, { agent, repo });
  return response ? NextResponse.json(response) : new NextResponse(null, { status: 202 });
});
