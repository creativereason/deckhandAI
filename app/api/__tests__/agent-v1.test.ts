import { readdirSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as jobsRoute from "@/app/api/agent/v1/jobs/route";
import * as jobRoute from "@/app/api/agent/v1/jobs/[id]/route";
import * as moveRoute from "@/app/api/agent/v1/jobs/[id]/move/route";
import * as archiveRoute from "@/app/api/agent/v1/jobs/[id]/archive/route";
import { createAgent } from "@/lib/agents";
import type { AgentScope } from "@/lib/agent-scopes";
import { createSupabaseRepository } from "@/lib/job-repository";
import { dataBackend } from "@/lib/data-backend";
import { jobRepository } from "@/lib/jobs-repository";
import { jobsDataToRows } from "@/lib/jobs-mapping";
import type { JobsData } from "@/lib/jobs";
import { fakeAgentStore } from "@/lib/__tests__/helpers/fake-agent-store";
import { fakeJobStore } from "@/lib/__tests__/helpers/fake-job-store";

let agents = fakeAgentStore();
let jobs = fakeJobStore();
vi.mock("@/lib/data-backend", () => ({ dataBackend: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getSupabase: () => ({}) }));
vi.mock("@/lib/supabase-agent-store", () => ({ createAgentStore: () => agents }));
vi.mock("@/lib/jobs-repository", () => ({ jobRepository: vi.fn(() => createSupabaseRepository(jobs.store)) }));

const EMPTY: JobsData = { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };
const prospect = (role: string, extra: Record<string, unknown> = {}) => ({ company: "Acme", role, fit: "good", salary: "", notes: "", url: "", ...extra });
const seed = (board: Partial<JobsData>) => { jobs = fakeJobStore(jobsDataToRows({ ...EMPTY, ...board })); };
const idOf = (role: string) => [...jobs.rows.values()].find((r) => r.role === role)!.id;

async function agentWith(name: string, scopes: AgentScope[]) {
  const { key } = await createAgent(agents, { name, scopes });
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
const req = (method: string, headers: Record<string, string>, body?: unknown, path = "/api/agent/v1/jobs") =>
  new NextRequest(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const none = { params: Promise.resolve({}) };
const ID = "7f1c2f0e-3c1d-4b8e-9a52-1f0a5d6c7e11";

beforeEach(() => {
  agents = fakeAgentStore();
  seed({});
  vi.mocked(dataBackend).mockReturnValue("supabase");
  vi.mocked(jobRepository).mockClear();
  process.env.AGENT_RATE_LIMIT = "1000";
});

describe("GET /api/agent/v1/jobs", () => {
  it("returns 401 without a key and 403 without the read scope", async () => {
    expect((await jobsRoute.GET(req("GET", {}), none)).status).toBe(401);
    const noRead = await agentWith("Muse", ["jobs:add_pending"]);
    expect((await jobsRoute.GET(req("GET", noRead), none)).status).toBe(403);
  });

  // Z — Zero
  it("returns an empty page for an empty board", async () => {
    const auth = await agentWith("Muse", ["jobs:read"]);

    expect(await (await jobsRoute.GET(req("GET", auth), none)).json()).toEqual({ jobs: [], total: 0, limit: 100, offset: 0 });
  });

  // M — Many
  it("lists jobs from every section with their id and section", async () => {
    seed({ prospect: [prospect("A")] as never, passed: [prospect("B")] as never });
    const auth = await agentWith("Muse", ["jobs:read"]);

    const body = await (await jobsRoute.GET(req("GET", auth), none)).json();

    expect(body.total).toBe(2);
    expect(body.jobs.map((j: { role: string; section: string; id: string }) => [j.role, j.section, typeof j.id])).toEqual([["A", "prospect", "string"], ["B", "passed", "string"]]);
  });

  it("filters by section and pages with limit and offset", async () => {
    seed({ prospect: [prospect("A"), prospect("B"), prospect("C")] as never, passed: [prospect("P")] as never });
    const auth = await agentWith("Muse", ["jobs:read"]);

    const page = await (await jobsRoute.GET(req("GET", auth, undefined, "/api/agent/v1/jobs?section=prospect&limit=2&offset=1"), none)).json();

    expect(page.total).toBe(3);
    expect(page.jobs.map((j: { role: string }) => j.role)).toEqual(["B", "C"]);
  });

  // B — Boundary: archived jobs are gone from the agent's view
  it("never lists an archived job", async () => {
    seed({ prospect: [prospect("Keep"), prospect("Gone")] as never });
    jobs.deleted.add(idOf("Gone"));
    const auth = await agentWith("Muse", ["jobs:read"]);

    const body = await (await jobsRoute.GET(req("GET", auth), none)).json();

    expect(body.jobs.map((j: { role: string }) => j.role)).toEqual(["Keep"]);
  });

  it("returns 400 for a bad query", async () => {
    const auth = await agentWith("Muse", ["jobs:read"]);

    expect((await jobsRoute.GET(req("GET", auth, undefined, "/api/agent/v1/jobs?limit=9999"), none)).status).toBe(400);
  });
});

describe("GET /api/agent/v1/jobs/[id]", () => {
  it("returns one job by id", async () => {
    seed({ prospect: [prospect("A")] as never });
    const auth = await agentWith("Muse", ["jobs:read"]);

    const body = await (await jobRoute.GET(req("GET", auth), ctx(idOf("A")))).json();

    expect(body.job).toMatchObject({ role: "A", section: "prospect", id: idOf("A") });
  });

  it("returns 404 for an unknown id, a malformed id and an archived job", async () => {
    seed({ prospect: [prospect("Gone")] as never });
    jobs.deleted.add(idOf("Gone"));
    const auth = await agentWith("Muse", ["jobs:read"]);

    expect((await jobRoute.GET(req("GET", auth), ctx(ID))).status).toBe(404);
    expect((await jobRoute.GET(req("GET", auth), ctx("nope"))).status).toBe(404);
    expect((await jobRoute.GET(req("GET", auth), ctx(idOf("Gone")))).status).toBe(404);
  });
});

describe("POST /api/agent/v1/jobs (add to pending)", () => {
  const job = { company: "Acme", role: "Designer", url: "https://example.com/1", notes: "remote" };

  it("returns 403 for an agent that may only read", async () => {
    const auth = await agentWith("Muse", ["jobs:read"]);

    expect((await jobsRoute.POST(req("POST", auth, job), none)).status).toBe(403);
    expect(jobs.rows.size).toBe(0);
  });

  // O — One
  it("adds the job to pending, fills the scrape fields, and returns its id", async () => {
    const auth = await agentWith("Muse", ["jobs:add_pending"]);

    const response = await jobsRoute.POST(req("POST", auth, job), none);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.job).toMatchObject({ section: "pending", company: "Acme", scrapeGroup: "remote", scrapeDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), id: expect.any(String) });
    expect([...jobs.rows.values()].map((r) => r.section)).toEqual(["pending"]);
  });

  // I — Interface: the audit trail names the agent, not the user
  it("writes as the agent so the event log attributes the change to it", async () => {
    const auth = await agentWith("Muse", ["jobs:add_pending"]);

    await jobsRoute.POST(req("POST", auth, job), none);

    expect(jobRepository).toHaveBeenCalledWith("Muse");
  });

  // B — Boundary: replaying an add must not create a second job
  it("rejects a duplicate URL with 409 and the existing job, adding nothing", async () => {
    seed({ prospect: [prospect("Other", { url: "https://example.com/1" })] as never });
    const auth = await agentWith("Muse", ["jobs:add_pending"]);

    const response = await jobsRoute.POST(req("POST", auth, job), none);

    expect(response.status).toBe(409);
    expect((await response.json()).existing).toMatchObject({ section: "prospect", deleted: false, id: idOf("Other") });
    expect(jobs.rows.size).toBe(1);
  });

  it("rejects a duplicate company and role even with a different URL", async () => {
    seed({ passed: [prospect("Designer")] as never });
    const auth = await agentWith("Muse", ["jobs:add_pending"]);

    expect((await jobsRoute.POST(req("POST", auth, { ...job, url: "https://example.com/other" }), none)).status).toBe(409);
  });

  it("will not re-add a job that was archived, and says it was", async () => {
    seed({ prospect: [prospect("Designer", { url: "https://example.com/1" })] as never });
    jobs.deleted.add(idOf("Designer"));
    const auth = await agentWith("Muse", ["jobs:add_pending"]);

    const response = await jobsRoute.POST(req("POST", auth, job), none);

    expect(response.status).toBe(409);
    expect((await response.json()).existing.deleted).toBe(true);
    expect(jobs.rows.size).toBe(1);
  });

  it("does not treat two jobs with no URL as duplicates", async () => {
    seed({ prospect: [prospect("Other")] as never });
    const auth = await agentWith("Muse", ["jobs:add_pending"]);

    expect((await jobsRoute.POST(req("POST", auth, { company: "Acme", role: "New" }), none)).status).toBe(201);
  });

  // E — Exception: an agent cannot reach any other section or set triage fields
  it.each([
    ["a section", { section: "applied" }],
    ["a fit", { fit: "strong" }],
    ["a status", { status: "offer" }],
    ["a javascript: URL", { url: "javascript:alert(1)" }],
    ["a missing role", { role: undefined }],
  ])("returns 400 for %s and writes nothing", async (_name, patch) => {
    const auth = await agentWith("Muse", ["jobs:add_pending"]);

    const response = await jobsRoute.POST(req("POST", auth, { ...job, ...patch }), none);

    expect(response.status).toBe(400);
    expect(jobs.rows.size).toBe(0);
  });

  it("returns 400 for malformed JSON", async () => {
    const auth = await agentWith("Muse", ["jobs:add_pending"]);
    const bad = new NextRequest("http://localhost/api/agent/v1/jobs", { method: "POST", headers: auth, body: "{nope" });

    expect((await jobsRoute.POST(bad, none)).status).toBe(400);
  });
});

describe("PATCH /api/agent/v1/jobs/[id]", () => {
  it("returns 403 without the edit scope", async () => {
    seed({ prospect: [prospect("A")] as never });
    const auth = await agentWith("Muse", ["jobs:read", "jobs:add_pending"]);

    expect((await jobRoute.PATCH(req("PATCH", auth, { notes: "x" }), ctx(idOf("A")))).status).toBe(403);
  });

  it("changes only the named fields", async () => {
    seed({ prospect: [prospect("A", { notes: "old", salary: "$1" })] as never });
    const auth = await agentWith("Muse", ["jobs:edit"]);

    const response = await jobRoute.PATCH(req("PATCH", auth, { notes: "new", fit: "strong" }), ctx(idOf("A")));

    expect(response.status).toBe(200);
    expect((await response.json()).job).toMatchObject({ role: "A", notes: "new", fit: "strong", salary: "$1", section: "prospect" });
    expect(jobRepository).toHaveBeenCalledWith("Muse");
  });

  // E — Exception: scope is enforced by the body shape too
  it.each([["company", "Hijack"], ["url", "https://evil.test"], ["status", "offer"], ["section", "passed"]])(
    "rejects a change to %s with 400 and leaves the job alone",
    async (field, value) => {
      seed({ prospect: [prospect("A")] as never });
      const auth = await agentWith("Muse", ["jobs:edit"]);

      const response = await jobRoute.PATCH(req("PATCH", auth, { notes: "n", [field]: value }), ctx(idOf("A")));

      expect(response.status).toBe(400);
      expect([...jobs.rows.values()][0].notes).toBe("");
    },
  );

  it("returns 404 for an unknown job", async () => {
    const auth = await agentWith("Muse", ["jobs:edit"]);

    expect((await jobRoute.PATCH(req("PATCH", auth, { notes: "x" }), ctx(ID))).status).toBe(404);
  });
});

describe("POST /api/agent/v1/jobs/[id]/move", () => {
  it("returns 403 without the triage scope", async () => {
    seed({ pending: [prospect("A")] as never });
    const auth = await agentWith("Muse", ["jobs:read", "jobs:edit"]);

    expect((await moveRoute.POST(req("POST", auth, { to: "prospect" }), ctx(idOf("A")))).status).toBe(403);
  });

  it("moves a job out of pending and fills the target section's fields", async () => {
    seed({ pending: [{ company: "Acme", role: "A", url: "", salary: "", notes: "", scrapeGroup: "remote", scrapeDate: "2026-01-01", isNew: true }] as never });
    const auth = await agentWith("Muse", ["jobs:triage"]);

    const response = await moveRoute.POST(req("POST", auth, { to: "prospect" }), ctx(idOf("A")));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.job).toMatchObject({ section: "prospect", fit: "good", id: idOf("A") });
    expect(body.job).not.toHaveProperty("isNew");
  });

  it("returns 400 when the job is already in that section, and 404 for an unknown job", async () => {
    seed({ prospect: [prospect("A")] as never });
    const auth = await agentWith("Muse", ["jobs:triage"]);

    expect((await moveRoute.POST(req("POST", auth, { to: "prospect" }), ctx(idOf("A")))).status).toBe(400);
    expect((await moveRoute.POST(req("POST", auth, { to: "passed" }), ctx(ID))).status).toBe(404);
  });

  it("returns 400 for an unknown section", async () => {
    seed({ prospect: [prospect("A")] as never });
    const auth = await agentWith("Muse", ["jobs:triage"]);

    expect((await moveRoute.POST(req("POST", auth, { to: "trash" }), ctx(idOf("A")))).status).toBe(400);
  });
});

describe("POST /api/agent/v1/jobs/[id]/archive", () => {
  it("returns 403 without the archive scope", async () => {
    seed({ prospect: [prospect("A")] as never });
    const auth = await agentWith("Muse", ["jobs:read", "jobs:triage", "jobs:edit"]);

    expect((await archiveRoute.POST(req("POST", auth), ctx(idOf("A")))).status).toBe(403);
    expect(jobs.deleted.size).toBe(0);
  });

  // B — Boundary: the job leaves the board but its row stays
  it("soft-deletes the job: gone from the board, still in the table", async () => {
    seed({ prospect: [prospect("A")] as never });
    const auth = await agentWith("Muse", ["jobs:archive", "jobs:read"]);
    const id = idOf("A");

    const response = await archiveRoute.POST(req("POST", auth), ctx(id));

    expect(response.status).toBe(200);
    expect(jobs.rows.has(id)).toBe(true);
    expect((await jobRoute.GET(req("GET", auth), ctx(id))).status).toBe(404);
    expect(jobRepository).toHaveBeenCalledWith("Muse");
  });

  it("returns 404 for an unknown or already archived job", async () => {
    seed({ prospect: [prospect("A")] as never });
    const auth = await agentWith("Muse", ["jobs:archive"]);
    await archiveRoute.POST(req("POST", auth), ctx(idOf("A")));

    expect((await archiveRoute.POST(req("POST", auth), ctx(idOf("A")))).status).toBe(404);
    expect((await archiveRoute.POST(req("POST", auth), ctx(ID))).status).toBe(404);
  });
});

describe("there is no hard delete", () => {
  // B — Boundary: the API surface itself offers no way to erase or restore
  it("exposes no DELETE handler on any agent route", () => {
    for (const route of [jobsRoute, jobRoute, moveRoute, archiveRoute]) {
      expect(route).not.toHaveProperty("DELETE");
    }
  });

  it("offers no restore: that stays with the signed-in user", () => {
    const dir = join(process.cwd(), "app/api/agent/v1/jobs/[id]");

    expect(readdirSync(dir).sort()).toEqual(["archive", "move", "route.ts"]);
  });
});
