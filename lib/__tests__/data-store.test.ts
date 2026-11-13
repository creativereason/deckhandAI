import { beforeEach, describe, expect, it, vi } from "vitest";
import { githubRead, githubWrite } from "@/lib/github";
import { readDataFile, writeDataFile } from "@/lib/data-store";

vi.mock("@/lib/github", () => ({ githubRead: vi.fn(), githubWrite: vi.fn() }));

const maybeSingle = vi.fn();
const upsert = vi.fn();
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select: () => ({ eq: (_c: string, name: string) => ({ maybeSingle: () => maybeSingle(table, name) }) }),
      upsert: (row: unknown) => upsert(table, row),
    }),
  }),
}));

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(githubRead).mockReset();
  vi.mocked(githubWrite).mockReset();
  maybeSingle.mockReset();
  upsert.mockReset().mockResolvedValue({ error: null });
});

describe("with the github backend", () => {
  // O — One
  it("reads and writes through GitHub", async () => {
    vi.mocked(githubRead).mockResolvedValue("{}");

    expect(await readDataFile("data/config.json")).toBe("{}");
    await writeDataFile("data/config.json", "{}", "msg");

    expect(githubWrite).toHaveBeenCalledWith("data/config.json", "{}", "msg");
  });
});

describe("with the supabase backend", () => {
  beforeEach(() => vi.stubEnv("DATA_BACKEND", "supabase"));

  // O — One
  it("reads a document by name and returns it as JSON text", async () => {
    maybeSingle.mockResolvedValue({ data: { data: { ai: { provider: "x" } } }, error: null });

    const raw = await readDataFile("data/config.json");

    expect(maybeSingle).toHaveBeenCalledWith("documents", "config");
    expect(JSON.parse(raw)).toEqual({ ai: { provider: "x" } });
    expect(githubRead).not.toHaveBeenCalled();
  });

  // E — Exception: callers rely on a throw to fall back to their defaults, as on a GitHub 404
  it("throws when the document does not exist", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(readDataFile("data/profile.json")).rejects.toThrow(/profile/);
  });

  // O — One
  it("upserts the parsed document on write", async () => {
    await writeDataFile("data/scrape-targets.json", '{"a":1}', "msg");

    expect(upsert).toHaveBeenCalledWith("documents", { name: "scrape-targets", data: { a: 1 } });
    expect(githubWrite).not.toHaveBeenCalled();
  });

  // E — Exception: jobs have their own typed repository
  it("rejects paths that are not stored as documents", async () => {
    await expect(readDataFile("data/jobs.json")).rejects.toThrow(/documents/);
  });

  // E — Exception: surface database failures
  it("throws when the upsert fails", async () => {
    upsert.mockResolvedValue({ error: { message: "boom" } });

    await expect(writeDataFile("data/config.json", "{}", "m")).rejects.toThrow(/boom/);
  });
});
