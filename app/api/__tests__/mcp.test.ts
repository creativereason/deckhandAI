import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as mcpRoute from "@/app/api/mcp/route";
import { createAgent, revokeAgent } from "@/lib/agents";
import { createSupabaseRepository } from "@/lib/job-repository";
import { dataBackend } from "@/lib/data-backend";
import { fakeAgentStore } from "@/lib/__tests__/helpers/fake-agent-store";
import { fakeJobStore } from "@/lib/__tests__/helpers/fake-job-store";

let agents = fakeAgentStore();
let jobs = fakeJobStore();
vi.mock("@/lib/data-backend", () => ({ dataBackend: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({}) }));
vi.mock("@/lib/supabase-agent-store", () => ({ createAgentStore: () => agents }));
vi.mock("@/lib/jobs-repository", () => ({ jobRepository: vi.fn(() => createSupabaseRepository(jobs.store)) }));

const none = { params: Promise.resolve({}) };
const post = (headers: Record<string, string>, body: unknown) =>
  new NextRequest("http://localhost/api/mcp", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
const listTools = { jsonrpc: "2.0", id: 1, method: "tools/list" };

beforeEach(() => {
  agents = fakeAgentStore();
  jobs = fakeJobStore();
  vi.mocked(dataBackend).mockReturnValue("supabase");
  process.env.AGENT_RATE_LIMIT = "1000";
});

describe("POST /api/mcp", () => {
  it("returns 401 without a valid key, before reading the body", async () => {
    expect((await mcpRoute.POST(post({}, listTools), none)).status).toBe(401);
    expect((await mcpRoute.POST(post({ Authorization: "Bearer dk_nope" }, listTools), none)).status).toBe(401);
  });

  it("returns 401 for a revoked agent's key", async () => {
    const { key, agent } = await createAgent(agents, { name: "Muse", scopes: ["jobs:read"] });
    await revokeAgent(agents, agent.id);
    expect((await mcpRoute.POST(post({ Authorization: `Bearer ${key}` }, listTools), none)).status).toBe(401);
  });

  it("lists tools for a valid key as a JSON-RPC response", async () => {
    const { key } = await createAgent(agents, { name: "Muse", scopes: ["jobs:read"] });
    const res = await mcpRoute.POST(post({ Authorization: `Bearer ${key}` }, listTools), none);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.result.tools.map((t: { name: string }) => t.name)).toEqual(["list_jobs", "get_job"]);
  });

  it("answers a notification with 202 and no body", async () => {
    const { key } = await createAgent(agents, { name: "Muse", scopes: ["jobs:read"] });
    const res = await mcpRoute.POST(post({ Authorization: `Bearer ${key}` }, { jsonrpc: "2.0", method: "notifications/initialized" }), none);
    expect(res.status).toBe(202);
  });

  it("returns a JSON-RPC parse error for malformed JSON", async () => {
    const { key } = await createAgent(agents, { name: "Muse", scopes: ["jobs:read"] });
    const res = await mcpRoute.POST(post({ Authorization: `Bearer ${key}` }, "{nope"), none);
    expect((await res.json()).error.code).toBe(-32700);
  });

  it("writes under the agent's own name", async () => {
    const { key } = await createAgent(agents, { name: "Grokbot", scopes: ["jobs:add_pending"] });
    const { jobRepository } = await import("@/lib/jobs-repository");
    const call = { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "add_pending_job", arguments: { company: "A", role: "B" } } };
    await mcpRoute.POST(post({ Authorization: `Bearer ${key}` }, call), none);
    expect(vi.mocked(jobRepository)).toHaveBeenCalledWith("Grokbot");
  });
});

describe("GET /api/mcp", () => {
  it("is not served (this server has no streaming channel)", () => {
    expect((mcpRoute as Record<string, unknown>).GET).toBeUndefined();
  });
});
