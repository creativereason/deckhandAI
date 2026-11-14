// What an agent key may do. Scopes are independent: holding one never implies another.
export const AGENT_SCOPES = [
  "jobs:read",
  "jobs:add_pending",
  "jobs:edit",
  "jobs:triage",
  "jobs:evaluate",
  "jobs:check_url",
  "jobs:archive",
] as const;

export type AgentScope = (typeof AGENT_SCOPES)[number];

/** A new agent starts narrow; every other scope is granted deliberately. */
export const DEFAULT_AGENT_SCOPES: readonly AgentScope[] = ["jobs:read", "jobs:add_pending"];

export function isAgentScope(value: string): value is AgentScope {
  return (AGENT_SCOPES as readonly string[]).includes(value);
}

export function hasScope(agent: { scopes: readonly string[] }, scope: AgentScope): boolean {
  return agent.scopes.includes(scope);
}
