import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeForSection } from "@/lib/job-normalize";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-16T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

const job = { company: "Acme", role: "Designer" };

describe("normalizeForSection", () => {
  // O — One: each section's required fields get a default
  it("gives an applied job a status and today's date", () => {
    expect(normalizeForSection(job, "applied")).toMatchObject({ status: "applied", date: "2026-07-16" });
  });

  it.each(["prospect", "local", "staffing"] as const)("gives a %s job a fit", (section) => {
    expect(normalizeForSection(job, section).fit).toBe("good");
  });

  it("gives a pending job a scrape group and date", () => {
    expect(normalizeForSection(job, "pending")).toMatchObject({ scrapeGroup: "remote", scrapeDate: "2026-07-16" });
  });

  it("adds nothing to a passed job", () => {
    expect(normalizeForSection(job, "passed")).toEqual(job);
  });

  // B — Boundary: values the job already has are never overwritten
  it("keeps an existing status, date, fit and scrape fields", () => {
    expect(normalizeForSection({ ...job, status: "interview", date: "2026-01-01" }, "applied")).toMatchObject({ status: "interview", date: "2026-01-01" });
    expect(normalizeForSection({ ...job, fit: "strong" }, "prospect").fit).toBe("strong");
    expect(normalizeForSection({ ...job, scrapeGroup: "local", scrapeDate: "2026-02-02" }, "pending")).toMatchObject({ scrapeGroup: "local", scrapeDate: "2026-02-02" });
  });

  // I — Interface: pure, so the caller's object is untouched
  it("returns a copy and leaves the input alone", () => {
    const input = { ...job };

    const output = normalizeForSection(input, "applied");

    expect(input).toEqual(job);
    expect(output).not.toBe(input);
  });
});
