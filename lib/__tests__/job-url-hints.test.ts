import { describe, expect, it } from "vitest";
import { deriveJobHints } from "@/lib/job-fetcher";

describe("deriveJobHints", () => {
  it("returns empty hints for an unparseable URL", () => {
    expect(deriveJobHints("not a url")).toEqual({ company: "", role: "" });
  });

  it("skips generic subdomains and reads the role from the slug, dropping numeric ids", () => {
    expect(
      deriveJobHints("https://careers.thrivent.com/jobs/48479/director-design-systems-operations-and-bank-design"),
    ).toEqual({ company: "thrivent", role: "director design systems operations and bank design" });
  });

  it("reads the company from the first path segment on shared ATS hosts", () => {
    expect(deriveJobHints("https://jobs.lever.co/thrivent/3f2a9c1e-7b4d-4e2a-9a1f-0c5d6e7f8a9b").company).toBe("thrivent");
  });

  it("uses the tenant subdomain on Workday and leaves an opaque id out of the role", () => {
    expect(deriveJobHints("https://acme.myworkdayjobs.com/en-US/External/job/Remote/Senior-Designer_R12345")).toEqual({
      company: "acme",
      role: "Senior Designer",
    });
  });
});
