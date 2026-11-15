"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AGENT_SCOPES, type AgentScope } from "@/lib/agent-scopes";
import { SCOPE_DESCRIPTIONS } from "@/lib/agent-settings";
import type { AgentRecord } from "@/lib/agents";

const SECTION = "bg-card rounded-xl p-5 space-y-4 shadow-sm";

interface ScopeChecklistProps {
  owner: string;
  scopes: readonly AgentScope[];
  disabled: boolean;
}

function ScopeChecklist({ owner, scopes, disabled }: ScopeChecklistProps) {
  return (
    <ul className="space-y-1">
      {AGENT_SCOPES.map((scope) => (
        <li key={scope} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 w-4 h-4 accent-primary"
            aria-label={`${owner}: ${scope}`}
            checked={scopes.includes(scope)}
            disabled={disabled}
            readOnly
          />
          <span>
            <code className="text-xs">{scope}</code>
            <span className="text-muted-foreground"> — {SCOPE_DESCRIPTIONS[scope]}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function AgentRow({ agent }: { agent: AgentRecord }) {
  const revoked = agent.revokedAt !== null;
  return (
    <li className={SECTION}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {agent.name}
          {revoked && <span className="ml-2 text-xs font-medium text-destructive">Revoked</span>}
        </h3>
        <code className="text-xs text-muted-foreground">{agent.keyPrefix}…</code>
      </div>
      <ScopeChecklist owner={agent.name} scopes={agent.scopes} disabled={revoked} />
    </li>
  );
}

export default function AgentsSettings() {
  const [agents, setAgents] = useState<AgentRecord[] | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data: { agents: AgentRecord[] }) => setAgents(data.agents));
  }, []);

  if (agents === null) return <div className="text-sm text-muted-foreground py-8">Loading…</div>;

  return (
    <div className="space-y-6">
      {agents.length === 0 && <p className="text-sm text-muted-foreground">No agents yet.</p>}
      <ul className="space-y-4">
        {agents.map((a) => <AgentRow key={a.id} agent={a} />)}
      </ul>
      <Button>Create agent</Button>
    </div>
  );
}
