import { describe, expect, it } from "vitest";
import { companyHistory, normalizeCompany } from "@/lib/company-history";
import type { JobsData } from "@/lib/jobs";

const board = (over: Partial<JobsData> = {}): JobsData => ({ applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [], ...over }) as JobsData;
const applied = (company: string, role: string, status = "applied", date = "2026-06-01") => ({ company, role, status, date, salary: "", notes: "", url: "" }) as JobsData["applied"][number];
const prospect = (company: string, role: string) => ({ company, role, fit: "good", salary: "", notes: "", url: "" }) as JobsData["prospect"][number];
const passed = (company: string, role: string) => ({ company, role, salary: "", notes: "", url: "" }) as JobsData["passed"][number];
const pending = (company: string, role: string) => ({ company, role, url: "", salary: "", notes: "", scrapeGroup: "remote", scrapeDate: "2026-06-01" }) as JobsData["pending"][number];

describe("normalizeCompany", () => {
  // Z
  it("returns an empty string for an empty name", () => expect(normalizeCompany("")).toBe(""));
  // B — the same company is written many ways across job boards
  it.each([["Acme, Inc.", "acme"], ["ACME Inc", "acme"], ["The Acme Company", "acme"], ["Acme LLC", "acme"], ["  Acme  ", "acme"]])("treats %s as %s", (name, key) => {
    expect(normalizeCompany(name)).toBe(key);
  });
  it("keeps names that differ in a meaningful word apart", () => {
    expect(normalizeCompany("Acme Labs")).not.toBe(normalizeCompany("Acme"));
  });
});

describe("companyHistory", () => {
  const job = { company: "Acme", role: "Lead Designer" };
  // Z
  it("returns nothing for a company never seen before", () => {
    expect(companyHistory(board({ applied: [applied("Other", "X")] }), job)).toEqual([]);
  });
  // O
  it("finds an earlier application with its status and date", () => {
    const [entry] = companyHistory(board({ applied: [applied("Acme", "Designer", "interview", "2026-05-02")] }), job);
    expect(entry).toMatchObject({ section: "applied", role: "Designer", status: "interview", date: "2026-05-02" });
  });
  // M — every section counts, applied first so the most important fact leads
  it("finds matches in every section, ordered applied, prospect, passed, pending", () => {
    const entries = companyHistory(board({ pending: [pending("Acme", "P2")], passed: [passed("acme inc", "Pa")], prospect: [prospect("Acme", "Pr")], applied: [applied("ACME", "Ap")] }), job);
    expect(entries.map((e) => e.section)).toEqual(["applied", "prospect", "passed", "pending"]);
  });
  it("counts local and staffing prospects as prospects", () => {
    const entries = companyHistory(board({ local: [prospect("Acme", "L")], staffing: [prospect("Acme", "S")] }), job);
    expect(entries.map((e) => e.section)).toEqual(["prospect", "prospect"]);
  });
  // B — the job being looked at is not its own history
  it("leaves out the job itself", () => {
    expect(companyHistory(board({ pending: [pending("Acme", "Lead Designer")] }), job)).toEqual([]);
  });
  it("leaves out the job itself by id when it has one", () => {
    const self = { ...pending("Acme", "Lead Designer"), id: "p1" };
    const other = { ...pending("Acme", "Lead Designer"), id: "p2" };
    expect(companyHistory(board({ pending: [self, other] }), { ...job, id: "p1" })).toHaveLength(1);
  });
  // E
  it("returns nothing when the job has no company name", () => {
    expect(companyHistory(board({ applied: [applied("", "X")] }), { company: "", role: "R" })).toEqual([]);
  });
});
