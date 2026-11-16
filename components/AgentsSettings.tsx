"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Code, Notice } from "@/components/settings/SettingsSection";
import { AGENT_SCOPES, DEFAULT_AGENT_SCOPES, type AgentScope } from "@/lib/agent-scopes";
import { mcpAddCommand, SCOPE_DESCRIPTIONS, SCOPE_PRESETS, toggleScope } from "@/lib/agent-settings";
import type { AgentRecord } from "@/lib/agents";

interface ScopeChecklistProps {
  owner: string;
  scopes: readonly AgentScope[];
  disabled: boolean;
  onToggle: (scope: AgentScope) => void;
}

function ScopeChecklist({ owner, scopes, disabled, onToggle }: ScopeChecklistProps) {
  return (
    <ul className="flex flex-col gap-3">
      {AGENT_SCOPES.map((scope) => (
        <li key={scope} className="flex items-start gap-3 text-sm">
          <Checkbox aria-label={`${owner}: ${scope}`} checked={scopes.includes(scope)} disabled={disabled} onCheckedChange={() => onToggle(scope)} />
          <span><Code>{scope}</Code><span className="text-muted-foreground"> {SCOPE_DESCRIPTIONS[scope]}</span></span>
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
      <button type="button" onClick={onOpen} aria-label={`Open ${agent.name}`} className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-4 text-left transition-shadow duration-(--duration-base) hover:shadow-md">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            {agent.name}
            {revoked && <Badge variant="danger">Revoked</Badge>}
          </h3>
          <code className="font-mono text-xs text-muted-foreground">{agent.keyPrefix}…</code>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label={`${agent.name} permissions`}>
          {agent.scopes.map((scope) => <li key={scope}><Badge variant="neutral" className="font-mono">{scope.replace("jobs:", "")}</Badge></li>)}
        </ul>
        <p className="text-xs text-muted-foreground">Created {formatDate(agent.createdAt)} · last used {formatDate(agent.lastUsedAt)}</p>
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
    <Card className="gap-4">
      <div><Button variant="outline" size="sm" onClick={onBack}><ArrowLeft aria-hidden />All agents</Button></div>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">{agent.name}{revoked && <Badge variant="danger">Revoked</Badge>}</CardTitle>
        <code className="font-mono text-xs text-muted-foreground">{agent.keyPrefix}…</code>
      </CardHeader>
      <p className="text-xs text-muted-foreground">Created {formatDate(agent.createdAt)} · last used {formatDate(agent.lastUsedAt)}. The full key is shown only when the agent is created.</p>
      <ScopeChecklist owner={agent.name} scopes={agent.scopes} disabled={revoked} onToggle={toggle} />
      {!revoked && <div><Button variant="destructive" size="sm" aria-label={`Revoke ${agent.name}`} onClick={onRevoke}>Revoke</Button></div>}
    </Card>
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
    <Card role="status" className="gap-3 border-primary">
      <p className="text-sm font-semibold">Key for {agentName}: copy it now. It will not be shown again.</p>
      <code className="block rounded-md bg-muted p-2 font-mono text-xs break-all">{revealed ? keyValue : "•".repeat(keyValue.length)}</code>
      <p className="text-xs text-muted-foreground">Connect Claude Code with:</p>
      <code className="block rounded-md bg-muted p-2 font-mono text-xs break-all">{revealed ? command : mcpAddCommand(window.location.origin, "•".repeat(keyValue.length))}</code>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setRevealed(!revealed)}>{revealed ? "Hide key" : "Show key"}</Button>
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(keyValue)}>Copy key</Button>
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(command)}>Copy command</Button>
        <Button onClick={onDone}>Done</Button>
      </div>
    </Card>
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
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <CardTitle as="h2">New agent</CardTitle>
        <Field label="Agent name">{(f) => <Input {...f} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Permission presets">
          {SCOPE_PRESETS.map((preset) => (
            <Button key={preset.label} type="button" variant="outline" size="sm" title={preset.hint} onClick={() => setScopes([...preset.scopes])}>{preset.label}</Button>
          ))}
        </div>
        <ScopeChecklist owner="New agent" scopes={scopes} disabled={false} onToggle={(s) => setScopes(toggleScope(scopes, s))} />
        <div><Button type="submit" disabled={name.trim() === ""}>Create agent</Button></div>
      </form>
    </Card>
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

  if (loadError) return <ErrorState title="Could not load agents" description={loadError} />;
  if (agents === null) return <LoadingState label="Loading agents" />;

  const selected = view.kind === "detail" ? agents.find((a) => a.id === view.id) : undefined;
  const backToList = () => setView({ kind: "list" });

  return (
    <div className="flex flex-col gap-6">
      {error && <Notice tone="warning"><p role="alert">{error}</p></Notice>}
      {newKey && <NewKeyNotice agentName={newKey.agentName} keyValue={newKey.key} onDone={() => setNewKey(null)} />}
      {view.kind === "create" && (
        <>
          <div><Button variant="outline" size="sm" onClick={backToList}><ArrowLeft aria-hidden />All agents</Button></div>
          <CreateAgentForm onCreated={addCreated} onError={setError} />
        </>
      )}
      {selected && <AgentDetail agent={selected} onBack={backToList} onScopesChange={(scopes) => changeScopes(selected, scopes)} onRevoke={() => revoke(selected)} />}
      {view.kind === "list" && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Agents</h2>
            <Button onClick={() => setView({ kind: "create" })}><Plus aria-hidden />New agent</Button>
          </div>
          {agents.length === 0 && <Card padding="none"><EmptyState compact title="No agents yet" description="Create one to let a bot add jobs to your inbox." /></Card>}
          <ul className="flex flex-col gap-3">
            {agents.map((a) => <AgentSummaryRow key={a.id} agent={a} onOpen={() => setView({ kind: "detail", id: a.id })} />)}
          </ul>
        </>
      )}
    </div>
  );
}
