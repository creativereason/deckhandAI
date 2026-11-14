// Server-only: reads and writes the `agents` table with the service-role key.
import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentError, type AgentStore, type NewAgent, type StoredAgent } from "@/lib/agents";
import type { AgentScope } from "@/lib/agent-scopes";

const COLUMNS = "id, name, key_hash, key_prefix, scopes, created_at, revoked_at, last_used_at";
const UNIQUE_VIOLATION = "23505";

interface AgentRow {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: AgentScope[];
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

function toAgent(row: AgentRow): StoredAgent {
  return {
    id: row.id,
    name: row.name,
    keyHash: row.key_hash,
    keyPrefix: row.key_prefix,
    scopes: row.scopes,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

function check(error: { message: string } | null, action: string): void {
  if (error) throw new Error(`Supabase agents ${action} failed: ${error.message}`);
}

export function createAgentStore(client: SupabaseClient): AgentStore {
  return {
    async insert(agent: NewAgent) {
      const { data, error } = await client
        .from("agents")
        .insert({ name: agent.name, key_hash: agent.keyHash, key_prefix: agent.keyPrefix, scopes: agent.scopes })
        .select(COLUMNS)
        .single();
      if (error?.code === UNIQUE_VIOLATION) throw new AgentError("duplicate_name", `An agent named "${agent.name}" already exists`);
      check(error, "insert");
      return toAgent(data as unknown as AgentRow);
    },
    async list() {
      const { data, error } = await client.from("agents").select(COLUMNS).order("created_at");
      check(error, "list");
      return ((data ?? []) as unknown as AgentRow[]).map(toAgent);
    },
    async findByPrefix(prefix) {
      const { data, error } = await client.from("agents").select(COLUMNS).eq("key_prefix", prefix);
      check(error, "lookup");
      return ((data ?? []) as unknown as AgentRow[]).map(toAgent);
    },
    async get(id) {
      const { data, error } = await client.from("agents").select(COLUMNS).eq("id", id).maybeSingle();
      check(error, "get");
      return data ? toAgent(data as unknown as AgentRow) : undefined;
    },
    async update(id, patch) {
      const columns = {
        ...(patch.scopes && { scopes: patch.scopes }),
        ...(patch.revokedAt && { revoked_at: patch.revokedAt }),
        ...(patch.lastUsedAt && { last_used_at: patch.lastUsedAt }),
      };
      const { data, error } = await client.from("agents").update(columns).eq("id", id).select("id");
      check(error, "update");
      return (data ?? []).length > 0;
    },
  };
}
