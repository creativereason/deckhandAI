import { describe, expect, it } from "vitest";
import { shouldEvaluateJobUrl } from "@/components/ChatDrawer";

describe("shouldEvaluateJobUrl", () => {
  // Z — Zero: no URL at all should never trigger evaluation.
  it("returns false when the message has no URL", () => {
    expect(shouldEvaluateJobUrl("what have I applied to?")).toBe(false);
  });

  // O — One: the explicit evaluate-URL prompt prefix is always a trigger.
  it("returns true for the EVALUATE_URL_PROMPT prefix followed by a URL", () => {
    expect(shouldEvaluateJobUrl("Evaluate this job URL: https://jobs.example.com/123")).toBe(true);
  });

  // M — Many: any of several job/evaluate-intent keywords alongside a URL should trigger.
  it.each([
    "evaluate https://jobs.example.com/123",
    "can you check this job https://jobs.example.com/123",
    "what do you think of this posting https://jobs.example.com/123",
    "is this role a fit https://jobs.example.com/123",
    "should I apply to https://jobs.example.com/123",
  ])("returns true for %s", (text) => {
    expect(shouldEvaluateJobUrl(text)).toBe(true);
  });

  // E — Exception: a bare URL with no job/evaluate intent must NOT trigger a fabricated evaluation.
  it("returns false for an unrelated URL with no job/evaluate-intent keyword", () => {
    expect(shouldEvaluateJobUrl("check my LinkedIn https://linkedin.com/in/someone")).toBe(false);
  });
});
