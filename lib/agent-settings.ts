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

/** Plain-language meaning of each scope, shown beside its checkbox. */
export const SCOPE_DESCRIPTIONS: Record<AgentScope, string> = {
  "jobs:read": "List and read jobs",
  "jobs:add_pending": "Add jobs to the pending inbox",
  "jobs:edit": "Edit notes, summary, fit and rationale",
  "jobs:triage": "Move jobs between sections",
  "jobs:evaluate": "Evaluate a job URL (reserved, no tool uses it yet)",
  "jobs:check_url": "Check whether a posting is still open (reserved, no tool uses it yet)",
  "jobs:archive": "Archive jobs",
};

/** One-click starting points for a new agent; the checklist stays available to fine-tune them. */
export const SCOPE_PRESETS: ReadonlyArray<{ label: string; hint: string; scopes: readonly AgentScope[] }> = [
  { label: "Read only", hint: "Can look, not touch", scopes: ["jobs:read"] },
  { label: "Inbox contributor", hint: "Reads and adds to pending", scopes: ["jobs:read", "jobs:add_pending"] },
  { label: "Triager", hint: "Also edits and moves jobs", scopes: ["jobs:read", "jobs:add_pending", "jobs:edit", "jobs:triage"] },
];
