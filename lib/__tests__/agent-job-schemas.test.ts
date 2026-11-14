import { describe, expect, it } from "vitest";
import { AgentCreateJob, AgentEditJob, AgentListQuery, AgentMoveJob } from "@/lib/agent-job-schemas";

const valid = { company: "Acme", role: "Designer", url: "https://example.com/jobs/1" };

describe("AgentCreateJob", () => {
  // O — One
  it("accepts a company, role and URL, defaulting the rest", () => {
    expect(AgentCreateJob.parse(valid)).toMatchObject({ company: "Acme", role: "Designer", salary: "", notes: "" });
  });

  // B — Boundary: an agent can only add to pending, so it cannot name a section or any triage field
  it.each(["section", "fit", "status", "date", "id", "isNew", "deleted_at"])("rejects the field %s", (field) => {
    expect(AgentCreateJob.safeParse({ ...valid, [field]: "x" }).success).toBe(false);
  });

  it("accepts the fields a scraper legitimately supplies", () => {
    expect(AgentCreateJob.safeParse({ ...valid, salary: "$150k", notes: "n", aiSummary: "s", scrapeGroup: "local" }).success).toBe(true);
  });

  // E — Exception: stored URLs become links in the UI, so only web URLs may be stored
  it.each(["javascript:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd", "ftp://x.test/a", "not a url", "//evil.test"])(
    "rejects the URL %s",
    (url) => {
      expect(AgentCreateJob.safeParse({ ...valid, url }).success).toBe(false);
    },
  );

  it("allows a job with no URL yet", () => {
    expect(AgentCreateJob.safeParse({ ...valid, url: "" }).success).toBe(true);
  });

  it.each([
    ["a blank company", { company: "  " }],
    ["a missing role", { role: undefined }],
    ["an over-long company", { company: "x".repeat(201) }],
    ["over-long notes", { notes: "x".repeat(20_001) }],
    ["a non-string role", { role: 5 }],
    ["a bad scrape group", { scrapeGroup: "mars" }],
  ])("rejects %s", (_name, patch) => {
    expect(AgentCreateJob.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});

describe("AgentEditJob", () => {
  // B — Boundary: edit is limited to the four fields the jobs:edit scope describes
  it.each(["notes", "aiSummary", "scoreRationale", "fit"])("accepts a change to %s", (field) => {
    expect(AgentEditJob.safeParse({ [field]: field === "fit" ? "strong" : "text" }).success).toBe(true);
  });

  it.each(["company", "role", "url", "status", "section", "id", "salary", "isGhost"])("rejects a change to %s", (field) => {
    expect(AgentEditJob.safeParse({ notes: "n", [field]: "x" }).success).toBe(false);
  });

  // E — Exception
  it("rejects an empty edit and a bad fit", () => {
    expect(AgentEditJob.safeParse({}).success).toBe(false);
    expect(AgentEditJob.safeParse({ fit: "great" }).success).toBe(false);
  });
});

describe("AgentMoveJob", () => {
  it("accepts any of the six sections", () => {
    for (const to of ["applied", "prospect", "local", "staffing", "passed", "pending"]) {
      expect(AgentMoveJob.safeParse({ to }).success).toBe(true);
    }
  });

  it("rejects an unknown section, a missing target and extra fields", () => {
    expect(AgentMoveJob.safeParse({ to: "trash" }).success).toBe(false);
    expect(AgentMoveJob.safeParse({}).success).toBe(false);
    expect(AgentMoveJob.safeParse({ to: "passed", notes: "x" }).success).toBe(false);
  });
});

describe("AgentListQuery", () => {
  // Z — Zero
  it("defaults to the first 100 jobs across every section", () => {
    expect(AgentListQuery.parse({})).toEqual({ limit: 100, offset: 0 });
  });

  it("reads numbers from query strings", () => {
    expect(AgentListQuery.parse({ section: "pending", limit: "25", offset: "50" })).toEqual({ section: "pending", limit: 25, offset: 50 });
  });

  // B — Boundary
  it("caps the page size at 500", () => {
    expect(AgentListQuery.safeParse({ limit: "501" }).success).toBe(false);
    expect(AgentListQuery.safeParse({ limit: "500" }).success).toBe(true);
  });

  it("rejects a bad section, a zero limit and a negative offset", () => {
    expect(AgentListQuery.safeParse({ section: "x" }).success).toBe(false);
    expect(AgentListQuery.safeParse({ limit: "0" }).success).toBe(false);
    expect(AgentListQuery.safeParse({ offset: "-1" }).success).toBe(false);
  });
});
