// Pure rules behind the Settings → Agents page, kept out of the component so they can be tested alone.
import { AGENT_SCOPES, type AgentScope } from "@/lib/agent-scopes";

/**
 * Grants or removes one scope. The result is always in AGENT_SCOPES order so the checklist
 * and the PATCH body are stable, and never empty: the server refuses an agent with no scopes.
 */
export function toggleScope(scopes: readonly AgentScope[], scope: AgentScope): AgentScope[] {
  const next = new Set(scopes);
  if (next.has(scope)) next.delete(scope);
  else next.add(scope);
  if (next.size === 0) return [...scopes];
  return AGENT_SCOPES.filter((s) => next.has(s));
}

/** The one line a person pastes to connect Claude Code to this deckhand with a new key. */
export function mcpAddCommand(origin: string, key: string): string {
  return `claude mcp add --transport http deckhand ${origin}/api/mcp --header "Authorization: Bearer ${key}"`;
}
