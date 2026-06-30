import { beforeEach, describe, expect, it, vi } from "vitest";
import { githubRead, githubWrite } from "@/lib/github";
import { jobKey, readJobs, writeJobs, type JobsData } from "@/lib/jobs";

vi.mock("@/lib/github", () => ({
  githubRead: vi.fn(),
  githubWrite: vi.fn(),
}));

const EMPTY_JOBS = { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };

beforeEach(() => {
  vi.mocked(githubRead).mockReset();
  vi.mocked(githubWrite).mockReset();
});

describe("jobKey", () => {
  // Z — Zero: empty strings must not collide with each other
  it("returns a non-empty string when both arguments are empty", () => {
    expect(jobKey("", "")).toBe("::");
  });

  // O — One: single valid pair produces a deterministic key
  it("returns company::role for a normal pair", () => {
    expect(jobKey("Meta", "Product Designer")).toBe("Meta::Product Designer");
  });

  // M — Many: separator prevents prefix collisions across multiple pairs
  it("produces distinct keys for pairs that share a concatenated prefix", () => {
    const a = jobKey("Meta", "Product Designer");
    const b = jobKey("Met", "aProduct Designer");
    expect(a).not.toBe(b);
  });

  // B — Boundary: special characters and whitespace are preserved as-is
  it("preserves whitespace and special characters in both parts", () => {
    expect(jobKey("A & B", "Sr. Engineer (IC)")).toBe("A & B::Sr. Engineer (IC)");
  });

  // I — Interface: output is always a string of the form `${company}::${role}`
  it("always contains exactly one :: separator", () => {
    const key = jobKey("Acme Corp", "Staff Designer");
    const parts = key.split("::");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe("Acme Corp");
    expect(parts[1]).toBe("Staff Designer");
  });

  // E — Exception: neither argument can be undefined at the type level,
  // but the function must not throw when called with empty strings
  it("does not throw for empty-string arguments", () => {
    expect(() => jobKey("", "")).not.toThrow();
  });

  // S — Simple: end-to-end — key from one call matches key from another
  it("produces the same key for identical inputs called twice", () => {
    expect(jobKey("Stripe", "Design Lead")).toBe(jobKey("Stripe", "Design Lead"));
  });
});

describe("readJobs", () => {
  // Z — Zero: legacy or empty JSON must still hydrate the full board shape.
  it("returns empty arrays for every section when stored JSON is empty", async () => {
    vi.mocked(githubRead).mockResolvedValue("{}");

    const jobs = await readJobs();

    expect(jobs).toEqual(EMPTY_JOBS);
  });

  // O — One: a single stored job should survive hydration unchanged.
  it("returns a populated section when stored JSON contains one job", async () => {
    const stored = {
      prospect: [{
        company: "Acme",
        role: "Design Lead",
        fit: "strong",
        salary: "$160k",
        notes: "Remote",
        url: "https://example.com/job",
      }],
    };
    vi.mocked(githubRead).mockResolvedValue(JSON.stringify(stored));

    const jobs = await readJobs();

    expect(jobs).toEqual({ ...EMPTY_JOBS, prospect: stored.prospect });
  });

  // E — Exception: unavailable storage falls back to a usable empty board.
  it("returns empty arrays for every section when GitHub read fails", async () => {
    vi.mocked(githubRead).mockRejectedValue(new Error("not found"));

    const jobs = await readJobs();

    expect(jobs).toEqual(EMPTY_JOBS);
  });
});

describe("writeJobs", () => {
  // O — One: writing delegates the exact JSON payload to the GitHub adapter.
  it("writes formatted jobs JSON to the data repo path", async () => {
    const jobs: JobsData = { ...EMPTY_JOBS };

    await writeJobs(jobs);

    expect(githubWrite).toHaveBeenCalledWith(
      "data/jobs.json",
      JSON.stringify(jobs, null, 2),
      "Update jobs.json"
    );
  });
});
