"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AGENT_SCOPES, DEFAULT_AGENT_SCOPES, type AgentScope } from "@/lib/agent-scopes";
import { mcpAddCommand, SCOPE_DESCRIPTIONS, SCOPE_PRESETS, toggleScope } from "@/lib/agent-settings";
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

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString() : "never";
}

function AgentSummaryRow({ agent, onOpen }: { agent: AgentRecord; onOpen: () => void }) {
  const revoked = agent.revokedAt !== null;
  return (
    <li>
      <button type="button" onClick={onOpen} aria-label={`Open ${agent.name}`} className={`${SECTION} w-full text-left space-y-2 hover:ring-2 hover:ring-primary`}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {agent.name}
            {revoked && <span className="ml-2 text-xs font-medium text-destructive">Revoked</span>}
          </h3>
          <code className="text-xs text-muted-foreground">{agent.keyPrefix}…</code>
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label={`${agent.name} permissions`}>
          {agent.scopes.map((scope) => (
            <li key={scope} className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono">{scope.replace("jobs:", "")}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Created {formatDate(agent.createdAt)} · last used {formatDate(agent.lastUsedAt)}
        </p>
      </button>
    </li>
  );
}

interface AgentDetailProps {
  agent: AgentRecord;
  onBack: () => void;
  onScopesChange: (scopes: AgentScope[]) => void;
  onRevoke: () => void;
}

function AgentDetail({ agent, onBack, onScopesChange, onRevoke }: AgentDetailProps) {
  const revoked = agent.revokedAt !== null;
  function toggle(scope: AgentScope) {
    const next = toggleScope(agent.scopes, scope);
    // toggleScope returns the same list when the click would leave the agent with no scopes.
    if (next.length !== agent.scopes.length) onScopesChange(next);
  }
  return (
    <div className={SECTION}>
      <Button variant="outline" size="sm" onClick={onBack}>← All agents</Button>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {agent.name}
          {revoked && <span className="ml-2 text-xs font-medium text-destructive">Revoked</span>}
        </h3>
        <code className="text-xs text-muted-foreground">{agent.keyPrefix}…</code>
      </div>
      <p className="text-xs text-muted-foreground">
        Created {formatDate(agent.createdAt)} · last used {formatDate(agent.lastUsedAt)}. The full key is shown only when the agent is created.
      </p>
      <ScopeChecklist owner={agent.name} scopes={agent.scopes} disabled={revoked} onToggle={toggle} />
      {!revoked && (
        <Button variant="destructive" size="sm" aria-label={`Revoke ${agent.name}`} onClick={onRevoke}>
          Revoke
        </Button>
      )}
    </div>
  );
}

interface NewKey {
  agentName: string;
  key: string;
}

function NewKeyNotice({ agentName, keyValue, onDone }: { agentName: string; keyValue: string; onDone: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const command = mcpAddCommand(window.location.origin, keyValue);
  return (
    <div role="status" className={`${SECTION} border border-primary`}>
      <p className="text-sm font-semibold">Key for {agentName}: copy it now. It will not be shown again.</p>
      <code className="block break-all rounded bg-muted p-2 text-xs">{revealed ? keyValue : "•".repeat(keyValue.length)}</code>
      <p className="text-xs text-muted-foreground">Connect Claude Code with:</p>
      <code className="block break-all rounded bg-muted p-2 text-xs">{revealed ? command : mcpAddCommand(window.location.origin, "•".repeat(keyValue.length))}</code>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setRevealed(!revealed)}>{revealed ? "Hide key" : "Show key"}</Button>
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(keyValue)}>Copy key</Button>
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(command)}>Copy command</Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

function errorMessage(body: unknown, status: number): string {
  const error = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
  return typeof error === "string" ? error : `Request failed (${status})`;
}

/** Every agents call goes through here, so a refused request always surfaces as a message. */
async function requestJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, init);
    const body: unknown = await res.json().catch(() => undefined);
    return res.ok ? { ok: true, data: body as T } : { ok: false, error: errorMessage(body, res.status) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

interface CreateAgentFormProps {
  onCreated: (agent: AgentRecord, key: string) => void;
  onError: (message: string) => void;
}

function CreateAgentForm({ onCreated, onError }: CreateAgentFormProps) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<AgentScope[]>([...DEFAULT_AGENT_SCOPES]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const result = await requestJson<{ agent: AgentRecord; key: string }>("/api/agents", jsonInit("POST", { name: name.trim(), scopes }));
    if (!result.ok) return onError(result.error);
    onCreated(result.data.agent, result.data.key);
    setName("");
    setScopes([...DEFAULT_AGENT_SCOPES]);
  }

  return (
    <form onSubmit={submit} className={SECTION}>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">New agent</h2>
      <label className={LABEL} htmlFor="agent-name">Agent name</label>
      <input id="agent-name" className={INPUT} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Permission presets">
        {SCOPE_PRESETS.map((preset) => (
          <Button key={preset.label} type="button" variant="outline" size="sm" title={preset.hint} onClick={() => setScopes([...preset.scopes])}>
            {preset.label}
          </Button>
        ))}
      </div>
      <ScopeChecklist owner="New agent" scopes={scopes} disabled={false} onToggle={(s) => setScopes(toggleScope(scopes, s))} />
      <Button type="submit" disabled={name.trim() === ""}>Create agent</Button>
    </form>
  );
}

type SetAgents = React.Dispatch<React.SetStateAction<AgentRecord[] | null>>;

function useAgentList() {
  const [agents, setAgents] = useState<AgentRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    requestJson<{ agents: AgentRecord[] }>("/api/agents").then((result) =>
      result.ok ? setAgents(result.data.agents) : setLoadError(result.error),
    );
  }, []);
  return { agents, setAgents, loadError };
}

/** Changes apply on screen at once and are undone if the server refuses them. */
function agentActions(setAgents: SetAgents, setError: (message: string | null) => void) {
  const patchLocal = (id: string, patch: Partial<AgentRecord>) =>
    setAgents((prev) => prev?.map((a) => (a.id === id ? { ...a, ...patch } : a)) ?? prev);

  async function changeScopes(agent: AgentRecord, scopes: AgentScope[]) {
    setError(null);
    patchLocal(agent.id, { scopes });
    const result = await requestJson(`/api/agents/${agent.id}`, jsonInit("PATCH", { scopes }));
    if (!result.ok) {
      patchLocal(agent.id, { scopes: agent.scopes });
      setError(result.error);
    }
  }

  async function revoke(agent: AgentRecord) {
    if (!window.confirm(`Revoke ${agent.name}? Its key stops working immediately and cannot be restored.`)) return;
    setError(null);
    const result = await requestJson(`/api/agents/${agent.id}/revoke`, { method: "POST" });
    if (!result.ok) return setError(result.error);
    patchLocal(agent.id, { revokedAt: new Date().toISOString() });
  }

  return { changeScopes, revoke };
}

type View = { kind: "list" } | { kind: "create" } | { kind: "detail"; id: string };

export default function AgentsSettings() {
  const { agents, setAgents, loadError } = useAgentList();
  const [view, setView] = useState<View>({ kind: "list" });
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { changeScopes, revoke } = agentActions(setAgents, setError);

  function addCreated(agent: AgentRecord, key: string) {
    setError(null);
    setAgents((prev) => [...(prev ?? []), agent]);
    setNewKey({ agentName: agent.name, key });
    setView({ kind: "list" });
  }

  if (loadError) return <p role="alert" className="text-sm text-destructive py-8">{loadError}</p>;
  if (agents === null) return <div className="text-sm text-muted-foreground py-8">Loading…</div>;

  const selected = view.kind === "detail" ? agents.find((a) => a.id === view.id) : undefined;
  const backToList = () => setView({ kind: "list" });

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {newKey && <NewKeyNotice agentName={newKey.agentName} keyValue={newKey.key} onDone={() => setNewKey(null)} />}
      {view.kind === "create" && (
        <>
          <Button variant="outline" size="sm" onClick={backToList}>← All agents</Button>
          <CreateAgentForm onCreated={addCreated} onError={setError} />
        </>
      )}
      {selected && (
        <AgentDetail agent={selected} onBack={backToList} onScopesChange={(scopes) => changeScopes(selected, scopes)} onRevoke={() => revoke(selected)} />
      )}
      {view.kind === "list" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Agents</h2>
            <Button onClick={() => setView({ kind: "create" })}>New agent</Button>
          </div>
          {agents.length === 0 && <p className="text-sm text-muted-foreground">No agents yet.</p>}
          <ul className="space-y-3">
            {agents.map((a) => (
              <AgentSummaryRow key={a.id} agent={a} onOpen={() => setView({ kind: "detail", id: a.id })} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
