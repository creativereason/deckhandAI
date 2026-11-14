import { describe, expect, it } from "vitest";
import { authenticateAgent, createAgent, listAgents, revokeAgent, setAgentScopes } from "@/lib/agents";
import { fakeAgentStore as fakeStore } from "./helpers/fake-agent-store";
import { hashAgentKey } from "@/lib/agent-keys";

describe("createAgent", () => {
  // O — One
  it("creates an agent with the default scopes and returns its key once", async () => {
    const store = fakeStore();

    const { agent, key } = await createAgent(store, { name: "Muse" });

    expect(agent.scopes.sort()).toEqual(["jobs:add_pending", "jobs:read"]);
    expect(key.startsWith("dk_")).toBe(true);
    expect(agent.revokedAt).toBeNull();
  });

  // B — Boundary: the secret is never stored, only its hash
  it("stores the hash of the key and never the key", async () => {
    const store = fakeStore();

    const { key } = await createAgent(store, { name: "Muse" });

    expect(store.rows[0].keyHash).toBe(hashAgentKey(key));
    expect(JSON.stringify(store.rows[0])).not.toContain(key);
  });

  it("keeps the scopes it was given instead of the defaults", async () => {
    const { agent } = await createAgent(fakeStore(), { name: "Duet", scopes: ["jobs:read", "jobs:triage"] });

    expect(agent.scopes.sort()).toEqual(["jobs:read", "jobs:triage"]);
  });

  // E — Exception
  it("rejects a name that is already taken, ignoring case", async () => {
    const store = fakeStore();
    await createAgent(store, { name: "Muse" });

    await expect(createAgent(store, { name: "muse" })).rejects.toMatchObject({ code: "duplicate_name" });
  });

  it.each(["user", "scraper", "unknown", "USER"])("rejects the reserved name %s", async (name) => {
    await expect(createAgent(fakeStore(), { name })).rejects.toMatchObject({ code: "reserved_name" });
  });
});

describe("listAgents", () => {
  // Z — Zero
  it("returns an empty list when there are no agents", async () => {
    expect(await listAgents(fakeStore())).toEqual([]);
  });

  // B — Boundary: a list must never carry key material
  it("never includes the key hash", async () => {
    const store = fakeStore();
    await createAgent(store, { name: "Muse" });

    const [listed] = await listAgents(store);

    expect(listed).not.toHaveProperty("keyHash");
    expect(listed.keyPrefix).toMatch(/^dk_/);
  });
});

describe("authenticateAgent", () => {
  // O — One
  it("returns the agent for its own key", async () => {
    const store = fakeStore();
    const { key } = await createAgent(store, { name: "Muse" });

    const result = await authenticateAgent(store, key);

    expect(result).toMatchObject({ ok: true, agent: { name: "Muse" } });
  });

  // M — Many: the right agent is found among several
  it("tells agents apart by key", async () => {
    const store = fakeStore();
    await createAgent(store, { name: "Muse" });
    const duet = await createAgent(store, { name: "Duet" });

    expect(await authenticateAgent(store, duet.key)).toMatchObject({ ok: true, agent: { name: "Duet" } });
  });

  // B — Boundary: revoking takes effect on the very next request
  it("rejects a revoked agent's key", async () => {
    const store = fakeStore();
    const { agent, key } = await createAgent(store, { name: "Muse" });
    await revokeAgent(store, agent.id);

    expect(await authenticateAgent(store, key)).toEqual({ ok: false, reason: "revoked" });
  });

  // E — Exception: unknown, malformed and empty keys look identical to the caller
  it.each(["", "nonsense", "dk_", "dk_" + "x".repeat(60)])("rejects the key %j", async (key) => {
    const store = fakeStore();
    await createAgent(store, { name: "Muse" });

    expect(await authenticateAgent(store, key)).toEqual({ ok: false, reason: "invalid" });
  });

  it("does not query the store for a key that cannot be valid", async () => {
    const store = fakeStore();
    store.findByPrefix = async () => { throw new Error("should not be called"); };

    expect(await authenticateAgent(store, "not-a-key")).toEqual({ ok: false, reason: "invalid" });
  });

  it("rejects a key whose prefix matches but whose body does not", async () => {
    const store = fakeStore();
    const { key } = await createAgent(store, { name: "Muse" });

    expect(await authenticateAgent(store, key.slice(0, 11) + "tampered")).toEqual({ ok: false, reason: "invalid" });
  });

  // I — Interface: last_used_at is recorded, but not on every single request
  it("records when the key was last used, at most once a minute", async () => {
    const store = fakeStore();
    const { key } = await createAgent(store, { name: "Muse" });

    await authenticateAgent(store, key, new Date("2026-01-01T10:00:00Z"));
    await authenticateAgent(store, key, new Date("2026-01-01T10:00:20Z"));
    await authenticateAgent(store, key, new Date("2026-01-01T10:02:00Z"));

    expect(store.touches).toHaveLength(2);
  });

  it("still authenticates when recording last use fails", async () => {
    const store = fakeStore();
    const { key } = await createAgent(store, { name: "Muse" });
    store.update = async () => { throw new Error("db down"); };

    expect(await authenticateAgent(store, key)).toMatchObject({ ok: true });
  });
});

describe("setAgentScopes and revokeAgent", () => {
  it("replaces an agent's scopes", async () => {
    const store = fakeStore();
    const { agent } = await createAgent(store, { name: "Muse" });

    expect(await setAgentScopes(store, agent.id, ["jobs:read", "jobs:edit"])).toBe(true);
    expect(store.rows[0].scopes.sort()).toEqual(["jobs:edit", "jobs:read"]);
  });

  it("revoking sets the time once and keeps the first time when repeated", async () => {
    const store = fakeStore();
    const { agent } = await createAgent(store, { name: "Muse" });

    await revokeAgent(store, agent.id, new Date("2026-02-01T00:00:00Z"));
    await revokeAgent(store, agent.id, new Date("2026-03-01T00:00:00Z"));

    expect(store.rows[0].revokedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  // E — Exception
  it("reports false for an unknown agent", async () => {
    const store = fakeStore();

    expect(await setAgentScopes(store, "nope", ["jobs:read"])).toBe(false);
    expect(await revokeAgent(store, "nope")).toBe(false);
  });
});
