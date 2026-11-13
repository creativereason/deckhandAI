import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";
import type { JobsData } from "@/lib/jobs";
import { diffRows, jobsDataToRows, rowsToJobsData } from "@/lib/jobs-mapping";

const EMPTY: JobsData = { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };
let counter = 0;
const nextId = () => `id-${++counter}`;
const toRows = (data: JobsData) => jobsDataToRows(data, nextId);

describe("jobsDataToRows", () => {
  // Z — Zero
  it("returns no rows when every section is empty", () => {
    expect(toRows(EMPTY)).toEqual([]);
  });

  // O — One
  it("maps a prospect job to a row carrying its section, columns and position", () => {
    const rows = toRows({
      ...EMPTY,
      prospect: [{ company: "Acme", role: "Lead", fit: "strong", salary: "$1", notes: "n", url: "u", aiSummary: "s" }],
    });

    expect(rows).toEqual([
      expect.objectContaining({
        section: "prospect", company: "Acme", role: "Lead", fit: "strong",
        salary: "$1", notes: "n", url: "u", ai_summary: "s", position: 0, extra: {},
      }),
    ]);
  });

  // M — Many
  it("sets position from array index so newest-first order survives", () => {
    const job = (role: string) => ({ company: "A", role, fit: "good" as const, salary: "", notes: "", url: "" });
    const rows = toRows({ ...EMPTY, prospect: [job("first"), job("second")], local: [job("third")] });

    expect(rows.map((r) => [r.section, r.role, r.position])).toEqual([
      ["prospect", "first", 0], ["prospect", "second", 1], ["local", "third", 0],
    ]);
  });

  // B — Boundary: an existing id is kept, a missing id is generated
  it("keeps a job's existing id and generates one when absent", () => {
    const base = { company: "A", fit: "good" as const, salary: "", notes: "", url: "" };
    const rows = toRows({ ...EMPTY, prospect: [{ ...base, role: "kept", id: "abc" }, { ...base, role: "new" }] });

    expect(rows[0].id).toBe("abc");
    expect(rows[1].id).toMatch(/^id-/);
  });

  // B — Boundary: nothing the schema cannot hold is dropped
  it("moves unknown fields and out-of-range enum values into extra", () => {
    const rows = toRows({
      ...EMPTY,
      prospect: [{ company: "A", role: "R", fit: "excellent", salary: "", notes: "", url: "", mystery: 7 } as never],
    });

    expect(rows[0].fit).toBeNull();
    expect(rows[0].extra).toEqual({ fit: "excellent", mystery: 7 });
  });

  // B — Boundary: legacy free-text dates cannot go in a date column
  it("keeps a non-ISO date in extra instead of the date column", () => {
    const rows = toRows({
      ...EMPTY,
      applied: [{ company: "A", role: "R", status: "applied", date: "June 3rd", salary: "", notes: "", url: "" }],
    });

    expect(rows[0].applied_date).toBeNull();
    expect(rows[0].extra).toEqual({ date: "June 3rd" });
  });
});

describe("rowsToJobsData", () => {
  // Z — Zero
  it("returns empty arrays for every section when there are no rows", () => {
    expect(rowsToJobsData([])).toEqual(EMPTY);
  });

  // M — Many: rows arrive in any order; position decides
  it("orders each section by position", () => {
    const rows = toRows({
      ...EMPTY,
      pending: [
        { company: "A", role: "first", url: "", salary: "", notes: "", scrapeGroup: "remote", scrapeDate: "2026-01-01" },
        { company: "A", role: "second", url: "", salary: "", notes: "", scrapeGroup: "remote", scrapeDate: "2026-01-01" },
      ],
    });

    const data = rowsToJobsData([...rows].reverse());

    expect(data.pending.map((j) => j.role)).toEqual(["first", "second"]);
  });

  // I — Interface: the board shape gains the row id, nothing else
  it("exposes the row id on each job", () => {
    const data = rowsToJobsData(
      toRows({ ...EMPTY, passed: [{ company: "A", role: "R", salary: "", notes: "", url: "" }] }),
    );

    expect(data.passed[0].id).toMatch(/^id-/);
  });
});

describe("round trip through rows", () => {
  const SAMPLES = ["jobs.sample.json", "jobs-dev.sample.json", "jobs-onboarding.sample.json"];

  // S — Simple: every field in the shipped sample boards survives the trip
  it.each(SAMPLES)("loses no field from %s", (file) => {
    const source = JSON.parse(readFileSync(resolve(process.cwd(), "data", file), "utf-8")) as Record<string, unknown[]>;

    const rebuilt = rowsToJobsData(toRows({ ...EMPTY, ...source } as JobsData)) as unknown as Record<string, Record<string, unknown>[]>;

    for (const [section, jobs] of Object.entries(source)) {
      (jobs as Record<string, unknown>[]).forEach((job, index) => {
        expect(rebuilt[section][index]).toMatchObject(job);
      });
    }
  });
});

describe("diffRows", () => {
  const job = (role: string) => ({ company: "A", role, fit: "good" as const, salary: "", notes: "", url: "" });

  // Z — Zero
  it("reports nothing to do when both sides are empty", () => {
    expect(diffRows([], [])).toEqual({ inserts: [], updates: [], deleteIds: [] });
  });

  // O — One
  it("reports an insert for a row the database does not have", () => {
    const next = toRows({ ...EMPTY, prospect: [job("new")] });

    expect(diffRows([], next)).toEqual({ inserts: next, updates: [], deleteIds: [] });
  });

  // B — Boundary: unchanged rows must not churn updated_at
  it("reports nothing for rows that have not changed", () => {
    const rows = toRows({ ...EMPTY, prospect: [job("same")] });

    expect(diffRows(rows, rows)).toEqual({ inserts: [], updates: [], deleteIds: [] });
  });

  // M — Many: edit, move and delete in one write
  it("reports an update for a changed row and a delete for a missing row", () => {
    const existing = toRows({ ...EMPTY, prospect: [job("edit-me"), job("drop-me")] });
    const next = [{ ...existing[0], notes: "changed" }];

    const diff = diffRows(existing, next);

    expect(diff.updates).toEqual(next);
    expect(diff.deleteIds).toEqual([existing[1].id]);
    expect(diff.inserts).toEqual([]);
  });
});
