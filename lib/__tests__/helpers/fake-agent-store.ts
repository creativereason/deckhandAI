import { AgentError, type AgentStore, type StoredAgent } from "@/lib/agents";

/** In-memory agents table with the same unique-name rule as the real one. */
export function fakeAgentStore(): AgentStore & { rows: StoredAgent[]; touches: string[] } {
  const rows: StoredAgent[] = [];
  const touches: string[] = [];
  return {
    rows,
    touches,
    async insert(input) {
      if (rows.some((r) => r.name.toLowerCase() === input.name.toLowerCase())) throw new AgentError("duplicate_name", "exists");
      const row: StoredAgent = { id: crypto.randomUUID(), ...input, createdAt: "2026-01-01T00:00:00Z", revokedAt: null, lastUsedAt: null };
      rows.push(row);
      return row;
    },
    list: async () => [...rows],
    findByPrefix: async (prefix) => rows.filter((r) => r.keyPrefix === prefix),
    get: async (id) => rows.find((r) => r.id === id),
    async update(id, patch) {
      const row = rows.find((r) => r.id === id);
      if (!row) return false;
      if (patch.lastUsedAt) touches.push(id);
      Object.assign(row, patch);
      return true;
    },
  };
}
