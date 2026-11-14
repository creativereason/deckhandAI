import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/agents/route";
import { PATCH } from "@/app/api/agents/[id]/route";
import { POST as REVOKE } from "@/app/api/agents/[id]/revoke/route";
import { getSession } from "@/lib/auth";
import { dataBackend } from "@/lib/data-backend";
import { authenticateAgent } from "@/lib/agents";
import { fakeAgentStore } from "@/lib/__tests__/helpers/fake-agent-store";

let store = fakeAgentStore();
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/data-backend", () => ({ dataBackend: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({}) }));
vi.mock("@/lib/supabase-agent-store", () => ({ createAgentStore: () => store }));

const asSession = (authenticated: boolean) =>
  vi.mocked(getSession).mockResolvedValue({ authenticated } as Awaited<ReturnType<typeof getSession>>);

const request = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/agents", {
    method,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const ID = "7f1c2f0e-3c1d-4b8e-9a52-1f0a5d6c7e11";

beforeEach(() => {
  store = fakeAgentStore();
  asSession(true);
  vi.mocked(dataBackend).mockReturnValue("supabase");
  delete process.env.DEMO_MODE;
});

describe("who may manage agents", () => {
  // E — Exception: an agent key is not a session, and a missing session is not a pass
  it.each([
    ["GET", () => GET()],
    ["POST", () => POST(request("POST", { name: "Muse" }))],
    ["PATCH", () => PATCH(request("PATCH", { scopes: ["jobs:read"] }), ctx(ID))],
    ["revoke", () => REVOKE(request("POST"), ctx(ID))],
  ])("%s returns 401 without a signed-in session and touches nothing", async (_name, call) => {
    asSession(false);

    expect((await call()).status).toBe(401);
    expect(store.rows).toHaveLength(0);
  });

  it("still requires a real session in demo mode, which skips the proxy's check", async () => {
    process.env.DEMO_MODE = "true";
    asSession(false);

    expect((await GET()).status).toBe(401);
  });

  it("returns 409 explaining what is needed when the backend is not Supabase", async () => {
    vi.mocked(dataBackend).mockReturnValue("github");

    const response = await GET();

    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/DATA_BACKEND=supabase/);
  });
});

describe("POST /api/agents", () => {
  // O — One
  it("creates an agent with the default scopes and returns its key", async () => {
    const response = await POST(request("POST", { name: "Muse" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.key).toMatch(/^dk_/);
    expect(body.agent).toMatchObject({ name: "Muse", scopes: expect.arrayContaining(["jobs:read", "jobs:add_pending"]) });
  });

  // B — Boundary: the key is shown once, so it must not be cached and must work immediately
  it("forbids caching the response that carries the key", async () => {
    const response = await POST(request("POST", { name: "Muse" }));

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns a key that authenticates the new agent", async () => {
    const { key } = await (await POST(request("POST", { name: "Muse" }))).json();

    expect(await authenticateAgent(store, key)).toMatchObject({ ok: true, agent: { name: "Muse" } });
  });

  it("does not put the key hash in the response", async () => {
    const body = await (await POST(request("POST", { name: "Muse" }))).json();

    expect(JSON.stringify(body)).not.toContain(store.rows[0].keyHash);
  });

  // E — Exception
  it.each([
    ["no body", ""],
    ["malformed JSON", "{nope"],
    ["a missing name", {}],
    ["a blank name", { name: "  " }],
    ["a name with odd characters", { name: "Muse; drop table" }],
    ["an unknown scope", { name: "Muse", scopes: ["jobs:delete"] }],
    ["an empty scope list", { name: "Muse", scopes: [] }],
  ])("returns 400 for %s and creates nothing", async (_name, body) => {
    const response = await POST(request("POST", body));

    expect(response.status).toBe(400);
    expect(store.rows).toHaveLength(0);
  });

  it("returns 409 for a name that is taken and 400 for a reserved one", async () => {
    await POST(request("POST", { name: "Muse" }));

    expect((await POST(request("POST", { name: "muse" }))).status).toBe(409);
    expect((await POST(request("POST", { name: "scraper" }))).status).toBe(400);
  });
});

describe("GET /api/agents", () => {
  // Z — Zero
  it("returns an empty list", async () => {
    expect(await (await GET()).json()).toEqual({ agents: [] });
  });

  // B — Boundary: listing never repeats the secret or its hash
  it("lists agents without any key material", async () => {
    const { key } = await (await POST(request("POST", { name: "Muse" }))).json();

    const text = JSON.stringify(await (await GET()).json());

    expect(text).not.toContain(key);
    expect(text).not.toContain(store.rows[0].keyHash);
    expect(text).toContain(store.rows[0].keyPrefix);
  });
});

describe("PATCH /api/agents/[id] and revoke", () => {
  const created = async () => (await (await POST(request("POST", { name: "Muse" }))).json()).agent.id as string;

  it("replaces the scopes", async () => {
    const id = await created();

    const response = await PATCH(request("PATCH", { scopes: ["jobs:read", "jobs:edit"] }), ctx(id));

    expect(response.status).toBe(200);
    expect(store.rows[0].scopes.sort()).toEqual(["jobs:edit", "jobs:read"]);
  });

  it("ignores attempts to change the name or key through PATCH", async () => {
    const id = await created();
    const before = { ...store.rows[0] };

    await PATCH(request("PATCH", { scopes: ["jobs:read"], name: "Hijack", keyHash: "x" }), ctx(id));

    expect(store.rows[0]).toMatchObject({ name: before.name, keyHash: before.keyHash });
  });

  it("returns 400 for invalid scopes and 404 for an unknown or malformed id", async () => {
    const id = await created();

    expect((await PATCH(request("PATCH", { scopes: ["nope"] }), ctx(id))).status).toBe(400);
    expect((await PATCH(request("PATCH", { scopes: ["jobs:read"] }), ctx(ID))).status).toBe(404);
    expect((await PATCH(request("PATCH", { scopes: ["jobs:read"] }), ctx("not-a-uuid"))).status).toBe(404);
  });

  it("revokes an agent so its key stops working at once", async () => {
    const { agent, key } = await (await POST(request("POST", { name: "Muse" }))).json();

    const response = await REVOKE(request("POST"), ctx(agent.id));

    expect(response.status).toBe(200);
    expect(await authenticateAgent(store, key)).toEqual({ ok: false, reason: "revoked" });
  });

  it("returns 404 when revoking an unknown agent", async () => {
    expect((await REVOKE(request("POST"), ctx(ID))).status).toBe(404);
  });
});
