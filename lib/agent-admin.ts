// Shared guard for the routes that manage agents. Managing agents is something only a
// signed-in person does: an agent key never reaches these routes, and nothing here is
// callable by an agent (they live under /api/agents, not the agent API's own prefix).
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { getSession } from "@/lib/auth";
import { dataBackend } from "@/lib/data-backend";
import { getSupabase } from "@/lib/supabase";
import { createAgentStore } from "@/lib/supabase-agent-store";
import { AgentError, type AgentStore } from "@/lib/agents";

type Guarded<T> = { value: T } | { response: NextResponse };

/**
 * A real session is required even in demo mode, where the proxy skips its own check.
 * Agents live in the database, so a JSON-backed install cannot have them.
 */
export async function agentAdminStore(): Promise<Guarded<AgentStore>> {
  const session = await getSession();
  if (session.authenticated !== true) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (dataBackend() !== "supabase") {
    return { response: NextResponse.json({ error: "Agents need DATA_BACKEND=supabase" }, { status: 409 }) };
  }
  return { value: createAgentStore(getSupabase()) };
}

export async function parseAgentBody<T>(req: Request, schema: ZodType<T>): Promise<Guarded<T>> {
  const parsed = schema.safeParse(await req.json().catch(() => undefined));
  if (parsed.success) return { value: parsed.data };
  const issues = parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  const error = `Invalid request: ${issues.map((i) => `${i.path || "body"} ${i.message}`).join("; ")}`;
  return { response: NextResponse.json({ error, issues }, { status: 400 }) };
}

export function agentErrorResponse(err: unknown): NextResponse {
  if (err instanceof AgentError) {
    return NextResponse.json({ error: err.message }, { status: err.code === "duplicate_name" ? 409 : 400 });
  }
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: message }, { status: 500 });
}
