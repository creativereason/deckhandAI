import { describe, expect, it } from "vitest";
import { buildAiSummaryPrompt, normalizeAiSummary } from "@/lib/job-summary";

describe("normalizeAiSummary", () => {
  // Z — zero
  it("returns an empty string when input is empty", () => {
    expect(normalizeAiSummary("")).toBe("");
  });

  it("returns an empty string when input is not a string", () => {
    expect(normalizeAiSummary(undefined)).toBe("");
    expect(normalizeAiSummary(null)).toBe("");
    expect(normalizeAiSummary(42)).toBe("");
  });

  // O — one
  it("returns a single clean sentence unchanged", () => {
    const sentence = "Linear is a project-tracking tool company hiring a Head of Design to lead a four-person team.";
    expect(normalizeAiSummary(sentence)).toBe(sentence);
  });

  // M — many
  it("clamps output to the first two sentences when more are returned", () => {
    const result = normalizeAiSummary(
      "First sentence about the role. Second sentence about the company. Third sentence that rambles. Fourth sentence."
    );
    expect(result).toBe("First sentence about the role. Second sentence about the company.");
  });

  it("collapses internal newlines and repeated whitespace into single spaces", () => {
    expect(normalizeAiSummary("Leads design\n\n  across   two teams.")).toBe("Leads design across two teams.");
  });

  // B — boundary
  it("strips wrapping quotes, markdown emphasis, and a leading Summary label", () => {
    expect(normalizeAiSummary('"**Summary:** Owns design systems at Acme."')).toBe("Owns design systems at Acme.");
  });

  it("strips code fences from a fenced response", () => {
    expect(normalizeAiSummary("```\nOwns design systems at Acme.\n```")).toBe("Owns design systems at Acme.");
  });

  it("is idempotent — normalizing an already-normalized summary changes nothing", () => {
    const once = normalizeAiSummary("**Acme** builds robots. The role owns UX.\nExtra trailing sentence.");
    expect(normalizeAiSummary(once)).toBe(once);
  });

  // E — exception / garbage
  it("returns an empty string when the text is only punctuation or whitespace", () => {
    expect(normalizeAiSummary("  \n ** \"\" ```")).toBe("");
  });
});

describe("buildAiSummaryPrompt", () => {
  // I — interface
  it("includes the company, role, and source text in the user prompt", () => {
    const { system, user } = buildAiSummaryPrompt({
      company: "Acme",
      role: "Staff Designer",
      jdText: "Owns the design system and mentors two designers.",
    });
    expect(system).toContain("1–2 sentence");
    expect(user).toContain("Acme");
    expect(user).toContain("Staff Designer");
    expect(user).toContain("Owns the design system");
  });

  it("truncates jdText so oversized pages cannot blow the prompt budget", () => {
    const { user } = buildAiSummaryPrompt({
      company: "Acme",
      role: "Designer",
      jdText: "x".repeat(20000),
    });
    expect(user.length).toBeLessThan(8000);
  });

  it("falls back to notes as source text when no jdText is provided", () => {
    const { user } = buildAiSummaryPrompt({
      company: "Acme",
      role: "Designer",
      notes: "Hybrid role, team of five, reports to VP Design.",
    });
    expect(user).toContain("Hybrid role, team of five");
  });
});
