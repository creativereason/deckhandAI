import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAgent, revokeAgent } from "@/lib/agents";
import { dataBackend } from "@/lib/data-backend";
import { jobRepository } from "@/lib/jobs-repository";
import { fakeAgentStore } from "./helpers/fake-agent-store";

let store = fakeAgentStore();
vi.mock("@/lib/data-backend", () => ({ dataBackend: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({}) }));
vi.mock("@/lib/supabase-agent-store", () => ({ createAgentStore: () => store }));
vi.mock("@/lib/jobs-repository", () => ({ jobRepository: vi.fn(() => ({ marker: "repo" })) }));

const call = (headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/agent/v1/jobs", { headers });
const NO_PARAMS = { params: Promise.resolve({}) };

async function load() {
  vi.resetModules();
  return (await import("@/lib/agent-auth")).withAgent;
}

beforeEach(() => {
  store = fakeAgentStore();
  vi.mocked(dataBackend).mockReturnValue("supabase");
  vi.mocked(jobRepository).mockClear();
  delete process.env.AGENT_RATE_LIMIT;
});

describe("withAgent", () => {
  const handler = vi.fn(async () => NextResponse.json({ ok: true }));
  beforeEach(() => handler.mockClear());

  const bearer = (key: string) => ({ Authorization: `Bearer ${key}` });

  // O — One
  it("passes an authenticated agent with the scope to the handler, with a repository that writes as that agent", async () => {
    const withAgent = await load();
    const { key } = await createAgent(store, { name: "Muse" });

    const response = await withAgent("jobs:read", handler)(call(bearer(key)), NO_PARAMS);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ agent: expect.objectContaining({ name: "Muse" }) }));
    expect(jobRepository).toHaveBeenCalledWith("Muse");
  });

  // E — Exception: every authentication failure looks the same and never reaches the handler
  it.each([
    ["no Authorization header", {}],
    ["a non-Bearer scheme", { Authorization: "Basic abc" }],
    ["an empty bearer token", { Authorization: "Bearer " }],
    ["an unknown key", { Authorization: "Bearer dk_" + "x".repeat(43) }],
  ])("returns 401 for %s", async (_name, headers) => {
    const withAgent = await load();
    await createAgent(store, { name: "Muse" });

    const response = await withAgent("jobs:read", handler)(call(headers), NO_PARAMS);

    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns the same 401 body for a revoked key as for an unknown one", async () => {
    const withAgent = await load();
    const { agent, key } = await createAgent(store, { name: "Muse" });
    await revokeAgent(store, agent.id);

    const revoked = await withAgent("jobs:read", handler)(call(bearer(key)), NO_PARAMS);
    const unknown = await withAgent("jobs:read", handler)(call(bearer("dk_" + "y".repeat(43))), NO_PARAMS);

    expect(revoked.status).toBe(401);
    expect(await revoked.json()).toEqual(await unknown.json());
  });

  it("asks the caller to authenticate with a Bearer key", async () => {
    const withAgent = await load();

    expect((await withAgent("jobs:read", handler)(call(), NO_PARAMS)).headers.get("WWW-Authenticate")).toMatch(/Bearer/);
  });

  // B — Boundary: scopes are independent; a valid key without the scope is 403, not 401
  it("returns 403 naming the missing scope, and never runs the handler", async () => {
    const withAgent = await load();
    const { key } = await createAgent(store, { name: "Muse" });

    const response = await withAgent("jobs:archive", handler)(call(bearer(key)), NO_PARAMS);

    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain("jobs:archive");
    expect(handler).not.toHaveBeenCalled();
  });

  it("checks scope only after the key is proven, so an unknown key learns nothing about scopes", async () => {
    const withAgent = await load();

    const response = await withAgent("jobs:archive", handler)(call(bearer("dk_" + "z".repeat(43))), NO_PARAMS);

    expect(response.status).toBe(401);
  });

  // B — Boundary: a runaway agent is slowed down, and only that agent
  it("returns 429 with Retry-After once an agent exceeds its limit, without affecting another agent", async () => {
    process.env.AGENT_RATE_LIMIT = "2";
    const withAgent = await load();
    const muse = await createAgent(store, { name: "Muse" });
    const duet = await createAgent(store, { name: "Duet" });
    const run = (key: string) => withAgent("jobs:read", handler)(call(bearer(key)), NO_PARAMS);

    await run(muse.key);
    await run(muse.key);
    const limited = await run(muse.key);

    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await run(duet.key)).status).toBe(200);
  });

  // I — Interface
  it("returns 409 explaining what is needed when the backend is not Supabase", async () => {
    vi.mocked(dataBackend).mockReturnValue("github");
    const withAgent = await load();

    const response = await withAgent("jobs:read", handler)(call(), NO_PARAMS);

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/DATA_BACKEND=supabase/);
  });

  it("hands the route's params to the handler", async () => {
    const withAgent = await load();
    const { key } = await createAgent(store, { name: "Muse" });

    await withAgent<{ id: string }>("jobs:read", handler)(call(bearer(key)), { params: Promise.resolve({ id: "abc" }) });

    expect(handler).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ params: { id: "abc" } }));
  });
});
