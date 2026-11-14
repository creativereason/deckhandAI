import { describe, expect, it } from "vitest";
import { DeleteJobBody, PatchJobBody, PostJobBody } from "@/lib/job-schemas";

const job = { company: "Acme", role: "Designer", fit: "good", salary: "", notes: "", url: "" };

describe("PostJobBody", () => {
  // Z — Zero
  it("rejects an empty body", () => {
    expect(PostJobBody.safeParse({}).success).toBe(false);
  });

  // O — One
  it("accepts a section and a job with company and role", () => {
    expect(PostJobBody.safeParse({ section: "prospect", job }).success).toBe(true);
  });

  // M — Many: every section the board has is valid
  it.each(["applied", "prospect", "local", "staffing", "passed", "pending"])("accepts section %s", (section) => {
    expect(PostJobBody.safeParse({ section, job }).success).toBe(true);
  });

  // B — Boundary: unknown fields pass through to the row's extra column, as the JSON file always allowed
  it("keeps fields it does not know", () => {
    const parsed = PostJobBody.parse({ section: "prospect", job: { ...job, scoreRationale: "why", custom: 1 } });

    expect(parsed.job).toMatchObject({ scoreRationale: "why", custom: 1 });
  });

  it("does not change the values it validates", () => {
    expect(PostJobBody.parse({ section: "prospect", job: { ...job, company: " Acme " } }).job.company).toBe(" Acme ");
  });

  // I — Interface: the client sends a blank date when the field is cleared
  it("accepts an empty date but not a malformed one", () => {
    expect(PostJobBody.safeParse({ section: "applied", job: { ...job, date: "" } }).success).toBe(true);
    expect(PostJobBody.safeParse({ section: "applied", job: { ...job, date: "07/16/2026" } }).success).toBe(false);
  });

  // E — Exception
  it.each([
    ["an unknown section", { section: "nowhere", job }],
    ["a missing job", { section: "prospect" }],
    ["a blank company", { section: "prospect", job: { ...job, company: "  " } }],
    ["a missing role", { section: "prospect", job: { company: "Acme" } }],
    ["a bad status", { section: "applied", job: { ...job, status: "ghosted" } }],
    ["a bad fit", { section: "prospect", job: { ...job, fit: "great" } }],
    ["a non-string notes", { section: "prospect", job: { ...job, notes: 5 } }],
    ["a non-boolean isNew", { section: "prospect", job: { ...job, isNew: "yes" } }],
  ])("rejects %s", (_name, body) => {
    expect(PostJobBody.safeParse(body).success).toBe(false);
  });

  it("names the failing field so the caller can fix it", () => {
    const result = PostJobBody.safeParse({ section: "prospect", job: { ...job, fit: "great" } });

    expect(result.success ? [] : result.error.issues[0].path).toEqual(["job", "fit"]);
  });
});

describe("PatchJobBody", () => {
  const ref = { section: "prospect", company: "Acme", role: "Designer" };

  it("accepts partial updates", () => {
    expect(PatchJobBody.safeParse({ ...ref, updates: { notes: "n" } }).success).toBe(true);
  });

  it("accepts a move target and an id", () => {
    expect(PatchJobBody.safeParse({ ...ref, id: "job-1", updates: {}, targetSection: "passed" }).success).toBe(true);
  });

  // B — Boundary: an id alone names the job
  it("accepts an id without company and role", () => {
    expect(PatchJobBody.safeParse({ id: "job-1", section: "prospect", updates: {} }).success).toBe(true);
  });

  it("does not let updates blank out company or role", () => {
    expect(PatchJobBody.safeParse({ ...ref, updates: { company: "" } }).success).toBe(false);
  });

  // E — Exception
  it.each([
    ["no way to name the job", { section: "prospect", updates: {} }],
    ["missing updates", ref],
    ["a bad target section", { ...ref, updates: {}, targetSection: "x" }],
    ["a bad status in updates", { ...ref, updates: { status: "nope" } }],
  ])("rejects %s", (_name, body) => {
    expect(PatchJobBody.safeParse(body).success).toBe(false);
  });
});

describe("DeleteJobBody", () => {
  const ref = { section: "prospect", company: "Acme", role: "Designer" };

  it("accepts a removal and a move-to-section", () => {
    expect(DeleteJobBody.safeParse(ref).success).toBe(true);
    expect(DeleteJobBody.safeParse({ ...ref, targetSection: "applied" }).success).toBe(true);
  });

  it("rejects a body that cannot name a job", () => {
    expect(DeleteJobBody.safeParse({ section: "prospect" }).success).toBe(false);
    expect(DeleteJobBody.safeParse({}).success).toBe(false);
  });
});
