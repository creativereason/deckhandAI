import { describe, expect, it, vi } from "vitest";
import type { JobsData } from "@/lib/jobs";
import { jobsDataToRows } from "@/lib/jobs-mapping";
import { createSupabaseData, usesSupabase } from "../../scripts/lib/supabase-data.mjs";

const ENV = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "secret" };

type Call = { url: string; method: string; body: unknown };

/** Fake PostgREST: answers GETs from `replies` in order, records every call. */
function fakeFetch(replies: unknown[] = []) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init: { method?: string; body?: string } = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : undefined });
    return { ok: true, status: 200, json: async () => (replies.length ? replies.shift() : []), text: async () => "" };
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const make = (replies: unknown[] = []) => {
  const fake = fakeFetch(replies);
  return { ...fake, data: createSupabaseData({ env: ENV, fetchImpl: fake.fetchImpl }) };
};

describe("usesSupabase", () => {
  // Z — Zero
  it("is false when DATA_BACKEND is unset", () => expect(usesSupabase({})).toBe(false));
  // O — One
  it("is true when DATA_BACKEND is supabase", () => expect(usesSupabase({ DATA_BACKEND: "supabase" })).toBe(true));
  // E — Exception: a typo must not silently write to GitHub instead
  it("throws for an unknown backend", () => expect(() => usesSupabase({ DATA_BACKEND: "supabse" })).toThrow(/DATA_BACKEND/));
});

describe("createSupabaseData", () => {
  // E — Exception
  it("throws when the service-role key is missing", () => {
    expect(() => createSupabaseData({ env: { SUPABASE_URL: ENV.SUPABASE_URL }, fetchImpl: fakeFetch().fetchImpl })).toThrow(
      /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  // I — Interface: the key goes in both headers PostgREST expects
  it("authenticates every request with the service-role key", async () => {
    const { data, fetchImpl } = make();
    await data.readDocument("config");

    const headers = (fetchImpl as unknown as { mock: { calls: [string, { headers: Record<string, string> }][] } }).mock.calls[0][1].headers;
    expect(headers).toMatchObject({ apikey: "secret", Authorization: "Bearer secret" });
  });
});

describe("readBoard", () => {
  // Z — Zero
  it("returns every section as an empty array when the table is empty", async () => {
    expect(await make().data.readBoard()).toEqual({ applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] });
  });

  // O — One
  it("groups rows by section and exposes the fields scripts need", async () => {
    const row = { id: "i1", section: "local", company: "A", role: "R", url: "u", salary: "s", notes: "n", ai_summary: "sum" };
    const { data } = make([[row], []]);

    const board = await data.readBoard();

    expect(board.local).toEqual([{ id: "i1", company: "A", role: "R", url: "u", salary: "s", notes: "n", aiSummary: "sum" }]);
  });

  // B — Boundary: deleted jobs stay out of the board unless a caller asks for them
  it("excludes deleted rows by default", async () => {
    const { data, calls } = make();
    await data.readBoard();
    expect(calls[0].url).toContain("deleted_at=is.null");
  });

  // B — Boundary: scrapers dedupe against deleted jobs too, so a job you removed is not re-added
  it("includes deleted rows when includeDeleted is set", async () => {
    const { data, calls } = make();
    await data.readBoard({ includeDeleted: true });
    expect(calls[0].url).not.toContain("deleted_at");
  });

  // B — Boundary: PostgREST caps a response, so keep paging until empty
  it("requests following pages until one is empty", async () => {
    const { data, calls } = make([[{ id: "1", section: "applied" }], [{ id: "2", section: "applied" }], []]);

    const board = await data.readBoard();

    expect(board.applied.map((j: { id: string }) => j.id)).toEqual(["1", "2"]);
    expect(calls.map((c) => c.url)).toEqual([expect.stringContaining("offset=0"), expect.stringContaining("offset=1000"), expect.stringContaining("offset=2000")]);
  });
});

describe("addJobs", () => {
  const job = (role: string) => ({ company: "A", role, fit: "good", salary: "", notes: "", url: `u-${role}` });

  // Z — Zero
  it("makes no request when there is nothing to add", async () => {
    const { data, calls } = make();
    await data.addJobs("prospect", [], "unshift");
    expect(calls).toEqual([]);
  });

  // M — Many: sequential array.unshift leaves the last job first
  it("places jobs the way repeated unshift would, above the current first row", async () => {
    const { data, calls } = make([[{ position: 5 }]]);

    await data.addJobs("prospect", [job("first"), job("second")], "unshift");

    const rows = calls[1].body as { role: string; position: number }[];
    expect(rows.map((r) => [r.role, r.position])).toEqual([["second", 3], ["first", 4]]);
  });

  // M — Many: push appends after the current last row, in order
  it("places pushed jobs after the current last row in order", async () => {
    const { data, calls } = make([[{ position: 9 }]]);

    await data.addJobs("staffing", [job("a"), job("b")], "push");

    const rows = calls[1].body as { role: string; position: number }[];
    expect(rows.map((r) => [r.role, r.position])).toEqual([["a", 10], ["b", 11]]);
  });

  // B — Boundary: an empty section has no min/max to anchor on
  it("starts from zero when the section has no rows", async () => {
    const { data, calls } = make([[]]);

    await data.addJobs("pending", [job("a")], "push");

    expect((calls[1].body as { position: number }[])[0].position).toBe(0);
  });

  // I — Interface: scripts label their writes so rows can be audited later
  it("marks inserted rows with the scraper source", async () => {
    const { data, calls } = make([[]]);
    await data.addJobs("pending", [job("a")], "push");
    expect((calls[1].body as { source: string }[])[0].source).toBe("scraper");
  });

  // S — Simple: the script mapper and the app mapper must agree, or the app misreads script rows
  it.each([
    ["a careers-scrape job", "prospect", { ...job("a"), isNew: true }],
    ["a pending job", "pending", { company: "A", role: "R", url: "u", salary: "$1", notes: "n", scrapeGroup: "remote", scrapeDate: "2026-01-02" }],
    ["a job with unknown fields", "staffing", { ...job("a"), mystery: 3 }],
  ])("builds the same row as the app mapper for %s", async (_label, section, input) => {
    const { data, calls } = make([[]]);

    await data.addJobs(section, [input], "push");

    const { id: _id, ...expected } = jobsDataToRows({ [section]: [input] } as unknown as JobsData, () => "")[0];
    const { source, ...actual } = (calls[1].body as Record<string, unknown>[])[0];
    expect(source).toBe("scraper");
    expect(actual).toEqual({ ...expected, position: 0 });
  });
});

describe("setAiSummary", () => {
  // O — One
  it("patches only that row's ai_summary", async () => {
    const { data, calls } = make();

    await data.setAiSummary("abc", "Short summary.");

    expect(calls[0]).toMatchObject({ method: "PATCH", url: expect.stringContaining("id=eq.abc"), body: { ai_summary: "Short summary." } });
  });
});

describe("readDocument", () => {
  // O — One
  it("returns the stored document", async () => {
    expect(await make([[{ data: { a: 1 } }]]).data.readDocument("config")).toEqual({ a: 1 });
  });

  // Z — Zero
  it("returns undefined when the document does not exist", async () => {
    expect(await make([[]]).data.readDocument("config")).toBeUndefined();
  });
});

describe("request failures", () => {
  // E — Exception: a failed write must stop the script, not report success
  it("throws with the status and response body", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401, text: async () => "bad key", json: async () => ({}) })) as unknown as typeof fetch;
    const data = createSupabaseData({ env: ENV, fetchImpl });

    await expect(data.readDocument("config")).rejects.toThrow(/401.*bad key/);
  });
});
