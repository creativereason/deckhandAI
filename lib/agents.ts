// Agent identities and key authentication, over an AgentStore so the rules are
// testable without a database. Managing agents is a signed-in-user action; nothing in
// here is reachable with an agent key.
import { AGENT_KEY_PREFIX, generateAgentKey, keyLookupPrefix, verifyAgentKey } from "@/lib/agent-keys";
import { DEFAULT_AGENT_SCOPES, type AgentScope } from "@/lib/agent-scopes";

export interface AgentRecord {
  id: string;
  name: string;
  /** Non-secret start of the key, so a person can tell keys apart. */
  keyPrefix: string;
  scopes: AgentScope[];
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

export interface StoredAgent extends AgentRecord {
  keyHash: string;
}

export interface NewAgent {
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: AgentScope[];
}

export interface AgentStore {
  insert(agent: NewAgent): Promise<StoredAgent>;
  list(): Promise<StoredAgent[]>;
  findByPrefix(prefix: string): Promise<StoredAgent[]>;
  get(id: string): Promise<StoredAgent | undefined>;
  /** Only these fields can change after creation; the key hash and name never do. */
  update(id: string, patch: { scopes?: AgentScope[]; revokedAt?: string; lastUsedAt?: string }): Promise<boolean>;
}

export type AgentErrorCode = "duplicate_name" | "reserved_name";

export class AgentError extends Error {
  constructor(readonly code: AgentErrorCode, message: string) {
    super(message);
  }
}

// Names already used as actors in the event log by something that is not an agent.
const RESERVED_NAMES = ["user", "scraper", "unknown", "chat", "system"];
const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 200;
const TOUCH_INTERVAL_MS = 60_000;

function toRecord({ keyHash: _hash, ...record }: StoredAgent): AgentRecord {
  return record;
}

export async function createAgent(
  store: AgentStore,
  input: { name: string; scopes?: readonly AgentScope[] },
): Promise<{ agent: AgentRecord; key: string }> {
  if (RESERVED_NAMES.includes(input.name.trim().toLowerCase())) {
    throw new AgentError("reserved_name", `"${input.name}" is reserved`);
  }
  const { key, hash, prefix } = generateAgentKey();
  const scopes = [...(input.scopes ?? DEFAULT_AGENT_SCOPES)];
  const stored = await store.insert({ name: input.name.trim(), keyHash: hash, keyPrefix: prefix, scopes });
  return { agent: toRecord(stored), key };
}

export async function listAgents(store: AgentStore): Promise<AgentRecord[]> {
  return (await store.list()).map(toRecord);
}

export function setAgentScopes(store: AgentStore, id: string, scopes: readonly AgentScope[]): Promise<boolean> {
  return store.update(id, { scopes: [...scopes] });
}

/** Idempotent: revoking again keeps the original time. False when the agent does not exist. */
export async function revokeAgent(store: AgentStore, id: string, now: Date = new Date()): Promise<boolean> {
  const agent = await store.get(id);
  if (!agent) return false;
  if (agent.revokedAt) return true;
  return store.update(id, { revokedAt: now.toISOString() });
}

export type AuthResult =
  | { ok: true; agent: AgentRecord }
  | { ok: false; reason: "invalid" | "revoked" };

function looksLikeKey(key: string): boolean {
  return key.startsWith(AGENT_KEY_PREFIX) && key.length >= MIN_KEY_LENGTH && key.length <= MAX_KEY_LENGTH;
}

/** Last use is bookkeeping: record it at most once a minute, and never fail a request over it. */
async function recordUse(store: AgentStore, agent: StoredAgent, now: Date): Promise<void> {
  const last = agent.lastUsedAt ? Date.parse(agent.lastUsedAt) : 0;
  if (now.getTime() - last < TOUCH_INTERVAL_MS) return;
  await store.update(agent.id, { lastUsedAt: now.toISOString() }).catch(() => false);
}

/**
 * Finds the agent a key belongs to. The prefix narrows the lookup to a row or two, and the
 * hash is then compared in constant time. Callers should answer 401 for both failure
 * reasons: telling them apart would tell an attacker a revoked key once existed.
 */
export async function authenticateAgent(store: AgentStore, key: string, now: Date = new Date()): Promise<AuthResult> {
  if (!looksLikeKey(key)) return { ok: false, reason: "invalid" };
  const candidates = await store.findByPrefix(keyLookupPrefix(key));
  const match = candidates.find((candidate) => verifyAgentKey(key, candidate.keyHash));
  if (!match) return { ok: false, reason: "invalid" };
  if (match.revokedAt) return { ok: false, reason: "revoked" };
  await recordUse(store, match, now);
  return { ok: true, agent: toRecord(match) };
}
