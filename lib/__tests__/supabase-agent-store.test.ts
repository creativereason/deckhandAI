import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { AgentError } from "@/lib/agents";
import { createAgentStore } from "@/lib/supabase-agent-store";

const row = (over: Record<string, unknown> = {}) => ({
  id: "a1", name: "Muse", key_hash: "h", key_prefix: "dk_abcd1234", scopes: ["jobs:read"],
  created_at: "2026-01-01T00:00:00Z", revoked_at: null, last_used_at: null, ...over,
});

/** A client whose query builder resolves to `result` at whichever call ends the chain. */
function clientReturning(result: { data?: unknown; error: { message: string; code?: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "eq", "order", "single", "maybeSingle"]) {
    builder[method] = (...args: unknown[]) => { calls.push({ method, args }); return builder; };
  }
  builder.then = (resolve: (value: unknown) => void) => resolve(result);
  return { client: { from: () => builder } as unknown as SupabaseClient, calls };
}

describe("createAgentStore", () => {
  // O — One: rows come back in the domain's camelCase shape
  it("maps a stored row to an agent", async () => {
    const { client } = clientReturning({ data: row(), error: null });

    const agent = await createAgentStore(client).insert({ name: "Muse", keyHash: "h", keyPrefix: "dk_abcd1234", scopes: ["jobs:read"] });

    expect(agent).toEqual({
      id: "a1", name: "Muse", keyHash: "h", keyPrefix: "dk_abcd1234", scopes: ["jobs:read"],
      createdAt: "2026-01-01T00:00:00Z", revokedAt: null, lastUsedAt: null,
    });
  });

  it("inserts the hash and prefix under their column names", async () => {
    const { client, calls } = clientReturning({ data: row(), error: null });

    await createAgentStore(client).insert({ name: "Muse", keyHash: "h", keyPrefix: "dk_abcd1234", scopes: ["jobs:read"] });

    expect(calls.find((c) => c.method === "insert")?.args[0]).toEqual({ name: "Muse", key_hash: "h", key_prefix: "dk_abcd1234", scopes: ["jobs:read"] });
  });

  // Z — Zero
  it("lists nothing as an empty array", async () => {
    const { client } = clientReturning({ data: null, error: null });

    expect(await createAgentStore(client).list()).toEqual([]);
  });

  it("looks agents up by key prefix", async () => {
    const { client, calls } = clientReturning({ data: [row()], error: null });

    const found = await createAgentStore(client).findByPrefix("dk_abcd1234");

    expect(calls).toContainEqual({ method: "eq", args: ["key_prefix", "dk_abcd1234"] });
    expect(found).toHaveLength(1);
  });

  it("returns undefined for an unknown id", async () => {
    const { client } = clientReturning({ data: null, error: null });

    expect(await createAgentStore(client).get("nope")).toBeUndefined();
  });

  // B — Boundary: only the three changeable columns are ever written
  it("updates only scopes, revoked_at and last_used_at, using their column names", async () => {
    const { client, calls } = clientReturning({ data: [{ id: "a1" }], error: null });

    const changed = await createAgentStore(client).update("a1", { revokedAt: "2026-02-01T00:00:00Z", lastUsedAt: "2026-02-02T00:00:00Z" });

    expect(changed).toBe(true);
    expect(calls.find((c) => c.method === "update")?.args[0]).toEqual({ revoked_at: "2026-02-01T00:00:00Z", last_used_at: "2026-02-02T00:00:00Z" });
  });

  it("reports false when no row matched the update", async () => {
    const { client } = clientReturning({ data: [], error: null });

    expect(await createAgentStore(client).update("nope", { scopes: ["jobs:read"] })).toBe(false);
  });

  // E — Exception
  it("turns a unique-name violation into a duplicate_name error", async () => {
    const { client } = clientReturning({ data: null, error: { message: "duplicate key", code: "23505" } });

    await expect(createAgentStore(client).insert({ name: "Muse", keyHash: "h", keyPrefix: "p", scopes: ["jobs:read"] }))
      .rejects.toBeInstanceOf(AgentError);
  });

  it("throws with the database message for any other failure, so a failed read never looks empty", async () => {
    const { client } = clientReturning({ data: null, error: { message: "timeout" } });

    await expect(createAgentStore(client).list()).rejects.toThrow(/list failed: timeout/);
    await expect(createAgentStore(client).findByPrefix("p")).rejects.toThrow(/lookup failed: timeout/);
  });
});
