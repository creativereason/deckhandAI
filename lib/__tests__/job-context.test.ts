import { describe, expect, it } from "vitest";
import { jobContext, jobContextLabel } from "@/lib/job-context";

describe("jobContext", () => {
  // Z
  it("returns just company and role when nothing else is known", () => {
    expect(jobContext({ company: "Acme", role: "Lead" })).toBe("Company: Acme\nRole: Lead");
  });
  // O
  it("adds the fields the assistant needs to judge a job, one per line", () => {
    const text = jobContext({ company: "Acme", role: "Lead", section: "pending", fit: "good", salary: "$150k", url: "https://x.test/j", aiSummary: "A summary.", notes: "Remote.", scoreRationale: "Matches." });
    expect(text.split("\n")).toEqual([
      "Company: Acme", "Role: Lead", "Section: pending", "Fit: good", "Salary: $150k", "URL: https://x.test/j",
      "Role summary: A summary.", "Notes: Remote.", "AI Assessment: Matches.",
    ]);
  });
  // B — empty strings are as good as missing, and never leave a "Salary: " line behind
  it("skips empty fields", () => {
    expect(jobContext({ company: "Acme", role: "Lead", salary: "", url: "" })).toBe("Company: Acme\nRole: Lead");
  });
  // I — the job page parses lines as "Label: value"
  it("keeps the label: value format the job page parses", () => {
    expect(jobContext({ company: "Acme", role: "Lead", url: "https://x.test" })).toContain("\nURL: https://x.test");
  });
});

describe("jobContextLabel", () => {
  it("names the job for the chip shown in the assistant", () => {
    expect(jobContextLabel({ company: "Acme", role: "Lead" })).toBe("Acme · Lead");
  });
});
