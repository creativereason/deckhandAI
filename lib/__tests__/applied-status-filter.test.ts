import { describe, expect, it } from "vitest";
import type { JobStatus } from "@/lib/jobs";
import {
  DEFAULT_HIDDEN_STATUSES,
  filterByStatus,
  parseHiddenStatuses,
  statusCounts,
  toggleStatus,
} from "@/lib/applied-status-filter";

const job = (status: JobStatus, role: string = status) => ({ company: "Acme", role, status });

describe("DEFAULT_HIDDEN_STATUSES", () => {
  it("hides declined and nothing else by default", () => {
    expect(DEFAULT_HIDDEN_STATUSES).toEqual(["declined"]);
  });
});

describe("filterByStatus", () => {
  // Z — Zero
  it("returns an empty list for an empty board", () => {
    expect(filterByStatus([], new Set<JobStatus>(["declined"]))).toEqual([]);
  });

  // O — One
  it("drops a job whose status is hidden", () => {
    expect(filterByStatus([job("declined")], new Set<JobStatus>(["declined"]))).toEqual([]);
  });

  // M — Many
  it("keeps the others in their original order", () => {
    const jobs = [job("applied", "A"), job("declined", "B"), job("interview", "C")];

    expect(filterByStatus(jobs, new Set<JobStatus>(["declined"])).map((j) => j.role)).toEqual(["A", "C"]);
  });

  // B — Boundary: nothing hidden shows everything; every status hidden shows nothing
  it("shows every job when no status is hidden", () => {
    const jobs = [job("applied"), job("declined")];

    expect(filterByStatus(jobs, new Set())).toEqual(jobs);
  });

  it("never hides a job whose status is missing or unknown (legacy data)", () => {
    const legacy = { company: "Acme", role: "Old" } as unknown as ReturnType<typeof job>;

    expect(filterByStatus([legacy], new Set<JobStatus>(["declined"]))).toEqual([legacy]);
  });
});

describe("statusCounts", () => {
  it("counts every status, with zero for ones that have no jobs", () => {
    expect(statusCounts([job("declined"), job("declined"), job("offer")])).toEqual({
      applied: 0,
      screening: 0,
      interview: 0,
      offer: 1,
      declined: 2,
    });
  });
});

describe("toggleStatus", () => {
  it("adds a status that is shown and removes one that is hidden, without mutating the input", () => {
    const hidden = new Set<JobStatus>(["declined"]);

    expect(toggleStatus(hidden, "offer")).toEqual(new Set(["declined", "offer"]));
    expect(toggleStatus(hidden, "declined")).toEqual(new Set());
    expect(hidden).toEqual(new Set(["declined"]));
  });
});

describe("parseHiddenStatuses", () => {
  // I — Interface: storage written by another version, or by hand
  it("falls back to the default when nothing usable was saved", () => {
    for (const bad of [undefined, null, "declined", 5, {}]) {
      expect(parseHiddenStatuses(bad)).toEqual(["declined"]);
    }
  });

  it("keeps a saved choice, including showing everything", () => {
    expect(parseHiddenStatuses([])).toEqual([]);
    expect(parseHiddenStatuses(["offer", "declined"])).toEqual(["offer", "declined"]);
  });

  // E — Exception
  it("ignores values that are not statuses", () => {
    expect(parseHiddenStatuses(["declined", "bogus", 3])).toEqual(["declined"]);
  });
});
