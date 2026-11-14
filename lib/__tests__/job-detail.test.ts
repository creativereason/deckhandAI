import { describe, expect, it } from "vitest";
import { findJobForDetail, jobDetailHref } from "@/lib/job-detail";

describe("jobDetailHref", () => {
  // O — One
  it("puts section, company and role in the query string", () => {
    expect(jobDetailHref({ section: "prospect", company: "Acme", role: "Designer" }))
      .toBe("/job?section=prospect&company=Acme&role=Designer");
  });

  // B — Boundary: the id is what makes the link unambiguous
  it("adds the id when the job has one", () => {
    const href = jobDetailHref({ section: "prospect", company: "Acme", role: "Designer", id: "job-1" });

    expect(new URL(href, "http://x").searchParams.get("id")).toBe("job-1");
  });

  it("encodes characters that would break the query string", () => {
    const params = new URL(jobDetailHref({ section: "applied", company: "A&B", role: "Lead / Design" }), "http://x").searchParams;

    expect([params.get("company"), params.get("role")]).toEqual(["A&B", "Lead / Design"]);
  });
});

describe("findJobForDetail", () => {
  const dup = (id: string, notes: string) => ({ id, company: "Acme", role: "Designer", notes });

  // Z — Zero
  it("returns undefined for an empty list", () => {
    expect(findJobForDetail([], { company: "Acme", role: "Designer" })).toBeUndefined();
  });

  // M — Many: the bug this fixes — two identical company + role
  it("returns the job with the requested id even when an earlier job has the same company and role", () => {
    const list = [dup("a", "first"), dup("b", "second")];

    expect(findJobForDetail(list, { id: "b", company: "Acme", role: "Designer" })).toBe(list[1]);
  });

  // B — Boundary: an edit renamed the job, the old URL still opens it
  it("finds the job by id after its company or role changed", () => {
    const list = [{ id: "a", company: "Acme Inc", role: "Head of Design" }];

    expect(findJobForDetail(list, { id: "a", company: "Acme", role: "Designer" })).toBe(list[0]);
  });

  // I — Interface: links made before ids existed
  it("falls back to company and role when the URL has no id", () => {
    const list = [{ company: "Acme", role: "Designer" }];

    expect(findJobForDetail(list, { company: "Acme", role: "Designer" })).toBe(list[0]);
  });

  // E — Exception: a stale id must not silently open some other job
  it("returns undefined when the id matches nothing, even if company and role do", () => {
    const list = [dup("a", "x")];

    expect(findJobForDetail(list, { id: "gone", company: "Acme", role: "Designer" })).toBeUndefined();
  });
});
