// The one gate every agent route goes through: a valid, unrevoked Bearer key, then the
// route's scope, then the agent's rate limit. Agent routes skip the browser-session check
// in proxy.ts, so a route that is not wrapped in withAgent would be open; wrap every one.
import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent, type AgentRecord } from "@/lib/agents";
import { hasScope, type AgentScope } from "@/lib/agent-scopes";
import { dataBackend } from "@/lib/data-backend";
import { jobRepository } from "@/lib/jobs-repository";
import type { JobRepository } from "@/lib/job-repository";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import { getSupabase } from "@/lib/supabase";
import { createAgentStore } from "@/lib/supabase-agent-store";

export interface AgentContext<P> {
  agent: AgentRecord;
  /** Writes are recorded in the event log under the agent's name. */
  repo: JobRepository;
  params: P;
}

type Handler<P> = (req: NextRequest, ctx: AgentContext<P>) => Promise<NextResponse>;
type RouteContext<P> = { params: Promise<P> };

const DEFAULT_REQUESTS_PER_MINUTE = 120;
let limiter: RateLimiter | undefined;

/** One window per server instance; the limit comes from AGENT_RATE_LIMIT (requests per minute). */
function agentLimiter(): RateLimiter {
  const configured = Number(process.env.AGENT_RATE_LIMIT);
  limiter ??= createRateLimiter({
    limit: Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_REQUESTS_PER_MINUTE,
    windowMs: 60_000,
  });
  return limiter;
}

function bearerKey(req: NextRequest): string {
  const header = req.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

// Unknown and revoked keys get an identical answer: telling them apart would reveal that a key once existed.
const unauthorized = () =>
  NextResponse.json({ error: "Invalid or revoked key" }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="deckhandAI agent API"' } });

export function withAgent<P = Record<string, never>>(scope: AgentScope, handler: Handler<P>) {
  return async (req: NextRequest, route: RouteContext<P>): Promise<NextResponse> => {
    if (dataBackend() !== "supabase") {
      return NextResponse.json({ error: "The agent API needs DATA_BACKEND=supabase" }, { status: 409 });
    }
    const auth = await authenticateAgent(createAgentStore(getSupabase()), bearerKey(req));
    if (!auth.ok) return unauthorized();

    const limit = agentLimiter().check(auth.agent.id);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
    if (!hasScope(auth.agent, scope)) {
      return NextResponse.json({ error: `This key lacks the ${scope} scope` }, { status: 403 });
    }
    return handler(req, { agent: auth.agent, repo: jobRepository(auth.agent.name), params: await route.params });
  };
}
