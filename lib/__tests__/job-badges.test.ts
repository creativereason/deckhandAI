import { describe, expect, it } from "vitest";
import {
  fitBadgeVariant,
  groupBadgeVariant,
  statusBadgeVariant,
  typeBadgeVariant,
} from "@/lib/job-badges";
import type { JobFit, JobStatus, JobType } from "@/lib/jobs";

describe("fitBadgeVariant", () => {
  // Z — Zero: unmapped/empty input falls back to a neutral tone instead of throwing
  it("returns the neutral fallback tone when the value is not a known fit", () => {
    expect(fitBadgeVariant("" as JobFit)).toBe("tone-neutral");
  });

  // O — One: a single known fit maps to its dedicated tone
  it("returns the success tone for a strong fit", () => {
    expect(fitBadgeVariant("strong")).toBe("tone-success");
  });

  // M — Many: each known fit maps to a distinct tone
  it("maps every known fit to a different tone", () => {
    const tones = new Set(
      (["strong", "good", "caution", "weak"] as JobFit[]).map(fitBadgeVariant)
    );
    expect(tones.size).toBe(4);
  });

  // B — Boundary: hand-edited JSON data drifting in case still resolves correctly
  it("normalizes case so hand-edited data like 'Strong' still resolves", () => {
    expect(fitBadgeVariant("Strong" as JobFit)).toBe("tone-success");
  });

  // E — Exception: a value outside the known set never throws, it degrades gracefully
  it("does not throw for a value outside the known fit set", () => {
    expect(() => fitBadgeVariant("unknown-value" as JobFit)).not.toThrow();
  });
});

describe("statusBadgeVariant", () => {
  it("returns the neutral fallback tone when the value is not a known status", () => {
    expect(statusBadgeVariant("" as JobStatus)).toBe("tone-neutral");
  });

  it("returns the info tone for an applied status", () => {
    expect(statusBadgeVariant("applied")).toBe("tone-info");
  });

  it("normalizes case so hand-edited data like 'Interview' still resolves", () => {
    expect(statusBadgeVariant("Interview" as JobStatus)).toBe("tone-purple");
  });
});

describe("typeBadgeVariant", () => {
  it("returns the neutral fallback tone when the value is not a known type", () => {
    expect(typeBadgeVariant("" as JobType)).toBe("tone-neutral");
  });

  it("returns the teal tone for a remote type", () => {
    expect(typeBadgeVariant("remote")).toBe("tone-teal");
  });
});

describe("groupBadgeVariant", () => {
  it("returns the purple tone for the local group", () => {
    expect(groupBadgeVariant("local")).toBe("tone-purple");
  });

  it("returns the neutral tone for the remote group", () => {
    expect(groupBadgeVariant("remote")).toBe("tone-neutral");
  });
});
