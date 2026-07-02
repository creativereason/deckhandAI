import { describe, expect, it } from "vitest";
import { jobKey } from "@/lib/jobs";

describe("jobKey", () => {
  // Z — Zero: empty strings must not collide with each other
  it("returns a non-empty string when both arguments are empty", () => {
    expect(jobKey("", "")).toBe("::");
  });

  // O — One: single valid pair produces a deterministic key
  it("returns company::role for a normal pair", () => {
    expect(jobKey("Meta", "Product Designer")).toBe("Meta::Product Designer");
  });

  // M — Many: separator prevents prefix collisions across multiple pairs
  it("produces distinct keys for pairs that share a concatenated prefix", () => {
    const a = jobKey("Meta", "Product Designer");
    const b = jobKey("Met", "aProduct Designer");
    expect(a).not.toBe(b);
  });

  // B — Boundary: special characters and whitespace are preserved as-is
  it("preserves whitespace and special characters in both parts", () => {
    expect(jobKey("A & B", "Sr. Engineer (IC)")).toBe("A & B::Sr. Engineer (IC)");
  });

  // I — Interface: output is always a string of the form `${company}::${role}`
  it("always contains exactly one :: separator", () => {
    const key = jobKey("Acme Corp", "Staff Designer");
    const parts = key.split("::");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe("Acme Corp");
    expect(parts[1]).toBe("Staff Designer");
  });

  // E — Exception: neither argument can be undefined at the type level,
  // but the function must not throw when called with empty strings
  it("does not throw for empty-string arguments", () => {
    expect(() => jobKey("", "")).not.toThrow();
  });

  // S — Simple: end-to-end — key from one call matches key from another
  it("produces the same key for identical inputs called twice", () => {
    expect(jobKey("Stripe", "Design Lead")).toBe(jobKey("Stripe", "Design Lead"));
  });
});
