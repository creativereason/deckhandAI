import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateAiSummary } from "@/lib/job-summary-server";
import { readConfig } from "@/lib/config-repository";
import { fetchGenerate } from "@/lib/model";

vi.mock("@/lib/config-repository", () => ({
  readConfig: vi.fn(),
}));

vi.mock("@/lib/model", () => ({
  fetchGenerate: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(readConfig).mockResolvedValue({});
  vi.mocked(fetchGenerate).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateAiSummary", () => {
  it("returns an empty string without calling the provider when there is no source text", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");

    const summary = await generateAiSummary({ company: "Acme", role: "Designer" });

    expect(summary).toBe("");
    expect(fetchGenerate).not.toHaveBeenCalled();
  });

  it("returns an empty string without calling the provider when AI is not configured", async () => {
    const summary = await generateAiSummary({
      company: "Acme",
      role: "Designer",
      notes: "Team of five, reports to VP Design.",
    });

    expect(summary).toBe("");
    expect(fetchGenerate).not.toHaveBeenCalled();
  });

  it("returns the normalized provider response when AI is configured and source text exists", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.mocked(fetchGenerate).mockResolvedValue('"**Acme builds robots. The role owns the design system.**"');

    const summary = await generateAiSummary({
      company: "Acme",
      role: "Designer",
      jdText: "Full job description text.",
    });

    expect(summary).toBe("Acme builds robots. The role owns the design system.");
  });

  it("returns an empty string instead of throwing when the provider call fails", async () => {
    vi.stubEnv("AI_API_KEY", "test-key");
    vi.mocked(fetchGenerate).mockRejectedValue(new Error("provider down"));

    const summary = await generateAiSummary({
      company: "Acme",
      role: "Designer",
      notes: "Some notes.",
    });

    expect(summary).toBe("");
  });
});
