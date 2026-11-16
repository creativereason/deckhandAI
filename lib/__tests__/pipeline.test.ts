import { describe, expect, it } from "vitest";
import { buildPipeline, moveAction, type PipelineCard, type TaggedProspect } from "@/lib/pipeline";
import type { AppliedJob } from "@/lib/jobs";

const applied = (company: string, status: AppliedJob["status"]): AppliedJob => ({
  id: `a-${company}`, company, role: "Designer", status, date: "2026-01-01", salary: "", notes: "", url: "",
});
const prospect = (company: string, extra: Partial<TaggedProspect> = {}) => ({
  id: `p-${company}`, company, role: "Lead", fit: "good" as const, salary: "$100k", notes: "", url: "",
  _section: "prospect" as const, ...extra,
});
const none = new Set<AppliedJob["status"]>();

describe("buildPipeline", () => {
  // Z — Zero
  it("returns the five working columns, all empty, for an empty board", () => {
    const columns = buildPipeline({ prospects: [], applied: [] }, none);

    expect(columns.map((c) => c.id)).toEqual(["prospect", "applied", "screening", "interview", "offer", "declined"]);
    expect(columns.every((c) => c.cards.length === 0)).toBe(true);
  });

  // O — One
  it("places a prospect in the Prospects column with its fit and salary", () => {
    const [prospects] = buildPipeline({ prospects: [prospect("Acme")], applied: [] }, none);

    expect(prospects.cards).toEqual([expect.objectContaining({ company: "Acme", fit: "good", salary: "$100k", section: "prospect" })]);
  });

  // M — Many
  it("places each application in the column for its status", () => {
    const columns = buildPipeline({ prospects: [], applied: [applied("A", "applied"), applied("B", "interview"), applied("C", "interview"), applied("D", "offer")] }, none);
    const counts = Object.fromEntries(columns.map((c) => [c.id, c.cards.length]));

    expect(counts).toMatchObject({ applied: 1, interview: 2, offer: 1, screening: 0 });
  });

  it("keeps prospects from the local and staffing sections in the Prospects column, remembering the section", () => {
    const [prospects] = buildPipeline({ prospects: [prospect("A"), prospect("B", { _section: "staffing" })], applied: [] }, none);

    expect(prospects.cards.map((c) => c.section)).toEqual(["prospect", "staffing"]);
  });

  // B — Boundary: hidden statuses
  it("leaves out the columns of hidden statuses, without dropping their jobs from anywhere else", () => {
    const columns = buildPipeline({ prospects: [], applied: [applied("A", "declined"), applied("B", "applied")] }, new Set(["declined"]));

    expect(columns.map((c) => c.id)).not.toContain("declined");
    expect(columns.find((c) => c.id === "applied")?.cards).toHaveLength(1);
  });

  it("never loses an application whose status is missing: it lands in Applied", () => {
    const legacy = { ...applied("Old", "applied"), status: undefined } as unknown as AppliedJob;
    const columns = buildPipeline({ prospects: [], applied: [legacy] }, none);

    expect(columns.find((c) => c.id === "applied")?.cards).toHaveLength(1);
  });
});

describe("moveAction", () => {
  const card = (over: Partial<PipelineCard>): PipelineCard => ({ key: "k", company: "A", role: "R", salary: "", section: "prospect", ...over });

  // Z
  it("does nothing when a card is dropped on the column it is already in", () => {
    expect(moveAction(card({ section: "applied", status: "interview" }), "interview")).toBeNull();
    expect(moveAction(card({ section: "prospect" }), "prospect")).toBeNull();
    expect(moveAction(card({ section: "staffing" }), "prospect")).toBeNull();
  });

  // O
  it("changes only the status when an application moves between status columns", () => {
    expect(moveAction(card({ section: "applied", status: "applied" }), "screening")).toEqual({ section: "applied", status: "screening" });
  });

  it("moves a prospect into Applied without naming a status (the server defaults it)", () => {
    expect(moveAction(card({ section: "prospect" }), "applied")).toEqual({ section: "applied" });
  });

  // M
  it("moves a prospect straight to a later column: into Applied, then that status", () => {
    expect(moveAction(card({ section: "local" }), "offer")).toEqual({ section: "applied", status: "offer" });
  });

  // B
  it("moves an application back to Prospects", () => {
    expect(moveAction(card({ section: "applied", status: "screening" }), "prospect")).toEqual({ section: "prospect" });
  });

  it("moves any card to Passed", () => {
    expect(moveAction(card({ section: "applied", status: "offer" }), "passed")).toEqual({ section: "passed" });
    expect(moveAction(card({ section: "prospect" }), "passed")).toEqual({ section: "passed" });
  });
});
