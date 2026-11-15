"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AGENT_SCOPES, DEFAULT_AGENT_SCOPES, type AgentScope } from "@/lib/agent-scopes";
import { mcpAddCommand, SCOPE_DESCRIPTIONS, toggleScope } from "@/lib/agent-settings";
import type { AgentRecord } from "@/lib/agents";

const SECTION = "bg-card rounded-xl p-5 space-y-4 shadow-sm";
const INPUT = "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card dark:text-white focus:outline-none focus:ring-2 focus:ring-primary";
const LABEL = "block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1";

interface ScopeChecklistProps {
  owner: string;
  scopes: readonly AgentScope[];
  disabled: boolean;
  onToggle: (scope: AgentScope) => void;
}

function ScopeChecklist({ owner, scopes, disabled, onToggle }: ScopeChecklistProps) {
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
            onChange={() => onToggle(scope)}
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

interface AgentRowProps {
  agent: AgentRecord;
  onScopesChange: (scopes: AgentScope[]) => void;
  onRevoke: () => void;
}

function AgentRow({ agent, onScopesChange, onRevoke }: AgentRowProps) {
  const revoked = agent.revokedAt !== null;
  function toggle(scope: AgentScope) {
    const next = toggleScope(agent.scopes, scope);
    // toggleScope returns the same list when the click would leave the agent with no scopes.
    if (next.length !== agent.scopes.length) onScopesChange(next);
  }
  return (
    <li className={SECTION}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {agent.name}
          {revoked && <span className="ml-2 text-xs font-medium text-destructive">Revoked</span>}
        </h3>
        <code className="text-xs text-muted-foreground">{agent.keyPrefix}…</code>
      </div>
      <ScopeChecklist owner={agent.name} scopes={agent.scopes} disabled={revoked} onToggle={toggle} />
      {!revoked && (
        <Button variant="destructive" size="sm" aria-label={`Revoke ${agent.name}`} onClick={onRevoke}>
          Revoke
        </Button>
      )}
    </li>
  );
}

interface NewKey {
  agentName: string;
  key: string;
}

function NewKeyNotice({ agentName, keyValue, onDone }: { agentName: string; keyValue: string; onDone: () => void }) {
  const command = mcpAddCommand(window.location.origin, keyValue);
  return (
    <div role="status" className={`${SECTION} border border-primary`}>
      <p className="text-sm font-semibold">Key for {agentName}: copy it now. It will not be shown again.</p>
      <code className="block break-all rounded bg-muted p-2 text-xs">{keyValue}</code>
      <p className="text-xs text-muted-foreground">Connect Claude Code with:</p>
      <code className="block break-all rounded bg-muted p-2 text-xs">{command}</code>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(keyValue)}>Copy key</Button>
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(command)}>Copy command</Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

async function postAgent(name: string, scopes: AgentScope[]): Promise<{ agent: AgentRecord; key: string }> {
  const res = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, scopes }),
  });
  return res.json();
}

function CreateAgentForm({ onCreated }: { onCreated: (agent: AgentRecord, key: string) => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<AgentScope[]>([...DEFAULT_AGENT_SCOPES]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { agent, key } = await postAgent(name.trim(), scopes);
    onCreated(agent, key);
    setName("");
    setScopes([...DEFAULT_AGENT_SCOPES]);
  }

  return (
    <form onSubmit={submit} className={SECTION}>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">New agent</h2>
      <label className={LABEL} htmlFor="agent-name">Agent name</label>
      <input id="agent-name" className={INPUT} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      <ScopeChecklist owner="New agent" scopes={scopes} disabled={false} onToggle={(s) => setScopes(toggleScope(scopes, s))} />
      <Button type="submit" disabled={name.trim() === ""}>Create agent</Button>
    </form>
  );
}

export default function AgentsSettings() {
  const [agents, setAgents] = useState<AgentRecord[] | null>(null);
  const [newKey, setNewKey] = useState<NewKey | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data: { agents: AgentRecord[] }) => setAgents(data.agents));
  }, []);

  function changeScopes(id: string, scopes: AgentScope[]) {
    setAgents((prev) => prev?.map((a) => (a.id === id ? { ...a, scopes } : a)) ?? prev);
    fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopes }),
    });
  }

  async function revoke(agent: AgentRecord) {
    if (!window.confirm(`Revoke ${agent.name}? Its key stops working immediately and cannot be restored.`)) return;
    await fetch(`/api/agents/${agent.id}/revoke`, { method: "POST" });
    const revokedAt = new Date().toISOString();
    setAgents((prev) => prev?.map((a) => (a.id === agent.id ? { ...a, revokedAt } : a)) ?? prev);
  }

  function addCreated(agent: AgentRecord, key: string) {
    setAgents((prev) => [...(prev ?? []), agent]);
    setNewKey({ agentName: agent.name, key });
  }

  if (agents === null) return <div className="text-sm text-muted-foreground py-8">Loading…</div>;

  return (
    <div className="space-y-6">
      {newKey && <NewKeyNotice agentName={newKey.agentName} keyValue={newKey.key} onDone={() => setNewKey(null)} />}
      {agents.length === 0 && <p className="text-sm text-muted-foreground">No agents yet.</p>}
      <ul className="space-y-4">
        {agents.map((a) => (
          <AgentRow key={a.id} agent={a} onScopesChange={(scopes) => changeScopes(a.id, scopes)} onRevoke={() => revoke(a)} />
        ))}
      </ul>
      <CreateAgentForm onCreated={addCreated} />
    </div>
  );
}
