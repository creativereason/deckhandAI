import { describe, expect, it } from "vitest";
import { buildFunnel, buildNeedsYou } from "@/lib/today";
import type { AppliedJob, JobsData, ProspectJob } from "@/lib/jobs";

const empty = (): JobsData => ({ applied: [], prospect: [], local: [], staffing: [], passed: [], pending: [] }) as JobsData;
const applied = (over: Partial<AppliedJob>): AppliedJob => ({ company: "Acme", role: "Lead", status: "applied", date: "2026-11-01", salary: "", notes: "", url: "", ...over });
const prospect = (over: Partial<ProspectJob>): ProspectJob => ({ company: "Bravo", role: "Head", fit: "good", salary: "", notes: "", url: "", ...over });
const NOW = new Date("2026-11-16");

describe("buildFunnel", () => {
  // Z
  it("returns five stages with zero counts for an empty board", () => {
    expect(buildFunnel(empty()).map((s) => s.count)).toEqual([0, 0, 0, 0, 0]);
  });
  // M
  it("counts all three prospect sections together and applications by status", () => {
    const jobs = { ...empty(), prospect: [prospect({})], local: [prospect({})], staffing: [prospect({})], applied: [applied({ status: "interview" }), applied({ status: "interview" }), applied({ status: "offer" })] };
    const counts = Object.fromEntries(buildFunnel(jobs).map((s) => [s.id, s.count]));
    expect(counts).toMatchObject({ prospect: 3, applied: 0, interview: 2, offer: 1 });
  });
});

describe("buildNeedsYou", () => {
  // Z
  it("returns nothing for an empty board", () => {
    expect(buildNeedsYou(empty(), NOW)).toEqual([]);
  });
  // O
  it("flags an open offer", () => {
    const items = buildNeedsYou({ ...empty(), applied: [applied({ status: "offer", company: "Loom" })] }, NOW);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "offer", title: "Loom offer is open" });
  });
  // M
  it("summarises the inbox as one item with the count", () => {
    const pending = [{}, {}] as JobsData["pending"];
    expect(buildNeedsYou({ ...empty(), pending }, NOW)[0].title).toBe("2 new jobs to triage");
  });
  // B — boundary: exactly 14 days is not stale yet, 15 is
  it("calls an application stale only after 14 days", () => {
    const at14 = applied({ date: "2026-11-02" });
    const at15 = applied({ date: "2026-11-01", company: "Old" });
    const items = buildNeedsYou({ ...empty(), applied: [at14, at15] }, NOW);
    expect(items.map((i) => i.title)).toEqual(["No news from Old"]);
  });
  it("does not nag about ghost jobs or applications past the first stage", () => {
    const items = buildNeedsYou({ ...empty(), applied: [applied({ date: "2026-01-01", isGhost: true }), applied({ date: "2026-01-01", status: "screening" })] }, NOW);
    expect(items.filter((i) => i.kind === "stale")).toEqual([]);
  });
  // E — a bad date never throws or counts as stale
  it("ignores applications with an unreadable date", () => {
    expect(buildNeedsYou({ ...empty(), applied: [applied({ date: "soon" })] }, NOW)).toEqual([]);
  });
  it("only surfaces new strong-fit prospects", () => {
    const items = buildNeedsYou({ ...empty(), prospect: [prospect({ fit: "strong", isNew: true }), prospect({ fit: "strong" }), prospect({ fit: "good", isNew: true })] }, NOW);
    expect(items.map((i) => i.kind)).toEqual(["strong-fit"]);
  });
});
