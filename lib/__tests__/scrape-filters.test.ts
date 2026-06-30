import { describe, expect, it } from "vitest";
import { buildLocalRegex, isQualifyingRemoteOrLocal } from "@/lib/scrape-filters";

describe("buildLocalRegex", () => {
  // Z — Zero: missing hub config should not accidentally match every listing.
  it("returns a regex that does not match locations when hub city and state are missing", () => {
    const localRegex = buildLocalRegex();

    expect(localRegex.test("Chicago, IL")).toBe(false);
  });
});

describe("isQualifyingRemoteOrLocal", () => {
  // O — One: common seniority shorthand should qualify like the full word.
  it("returns true for a remote Sr. UX Designer listing", () => {
    const localRegex = buildLocalRegex("Chicago", "IL");

    const qualifies = isQualifyingRemoteOrLocal("Sr. UX Designer", "Remote", localRegex);

    expect(qualifies).toBe(true);
  });
});
