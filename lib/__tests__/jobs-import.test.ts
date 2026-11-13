import { describe, expect, it } from "vitest";
import type { JobsData } from "@/lib/jobs";
import { planImport } from "@/lib/jobs-import";

const EMPTY: JobsData = { applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] };
const prospect = (role: string, extra: object = {}) =>
  ({ company: "Acme", role, fit: "good", salary: "", notes: "", url: "", ...extra }) as never;

describe("planImport", () => {
  // Z — Zero
  it("plans no rows for an empty board", () => {
    const { rows, report } = planImport(EMPTY);

    expect(rows).toEqual([]);
    expect(report.counts).toEqual({ applied: 0, prospect: 0, local: 0, staffing: 0, passed: 0, pending: 0 });
  });

  // O — One
  it("plans one import row with a legacy key and no id", () => {
    const { rows } = planImport({ ...EMPTY, prospect: [prospect("Lead")] });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "import", legacy_key: "prospect::Acme::Lead::0" });
    expect(rows[0]).not.toHaveProperty("id");
  });

  // M — Many: same company+role twice in one section must not collide
  it("numbers duplicate company+role pairs within a section and reports them", () => {
    const { rows, report } = planImport({ ...EMPTY, prospect: [prospect("Lead"), prospect("Lead")] });

    expect(rows.map((r) => r.legacy_key)).toEqual(["prospect::Acme::Lead::0", "prospect::Acme::Lead::1"]);
    expect(report.duplicates).toEqual(["prospect::Acme::Lead"]);
  });

  // B — Boundary: re-running after the source changed must still match existing rows
  it("keeps a job's legacy key when another job is added above it", () => {
    const before = planImport({ ...EMPTY, prospect: [prospect("Lead")] }).rows[0].legacy_key;

    const after = planImport({ ...EMPTY, prospect: [prospect("New"), prospect("Lead")] }).rows[1];

    expect(after.legacy_key).toBe(before);
    expect(after.position).toBe(1);
  });

  // I — Interface: the dry run tells the user which fields landed in `extra`
  it("tallies fields that fell back to extra", () => {
    const { report } = planImport({ ...EMPTY, prospect: [prospect("A", { mystery: 1 }), prospect("B", { mystery: 2 })] });

    expect(report.extraKeys).toEqual({ mystery: 2 });
  });

  // E — Exception: legacy files with a missing or malformed section
  it("treats a missing or non-array section as empty", () => {
    const { rows } = planImport({ prospect: "oops" } as never);

    expect(rows).toEqual([]);
  });
});
