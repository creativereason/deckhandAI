import { describe, it, expect } from "vitest";
import { resolveAiSettings, formatModelLabel } from "@/lib/ai-settings";

describe("resolveAiSettings", () => {
  describe("when nothing is configured", () => {
    it("falls back to anthropic with no model and nothing locked", () => {
      const result = resolveAiSettings(undefined, {});

      expect(result.effective).toEqual({ provider: "anthropic", model: undefined, base_url: undefined });
      expect(result.envLocked).toEqual({ provider: false, model: false, base_url: false });
    });
  });

  describe("when only the stored config sets the model", () => {
    it("uses the stored values and locks nothing", () => {
      const result = resolveAiSettings({ provider: "openai", model: "gpt-4o" }, {});

      expect(result.effective.provider).toBe("openai");
      expect(result.effective.model).toBe("gpt-4o");
      expect(result.envLocked.model).toBe(false);
    });
  });

  describe("when AI_MODEL is set in the environment", () => {
    it("reports the env model as effective and locks the model", () => {
      const result = resolveAiSettings({ model: "claude-sonnet-4-5" }, { AI_MODEL: "claude-haiku-5-5" });

      expect(result.effective.model).toBe("claude-haiku-5-5");
      expect(result.envLocked.model).toBe(true);
    });

    it("leaves the provider unlocked when AI_PROVIDER is not set", () => {
      const result = resolveAiSettings({ provider: "openai" }, { AI_MODEL: "gpt-4o-mini" });

      expect(result.effective.provider).toBe("openai");
      expect(result.envLocked.provider).toBe(false);
    });
  });

  describe("when env vars are set but blank", () => {
    it("ignores them so a stray `AI_MODEL=` does not lock the setting", () => {
      const result = resolveAiSettings({ model: "gpt-4o" }, { AI_MODEL: "  ", AI_PROVIDER: "" });

      expect(result.effective.model).toBe("gpt-4o");
      expect(result.envLocked).toEqual({ provider: false, model: false, base_url: false });
    });
  });

  describe("when AI_PROVIDER and AI_BASE_URL are set", () => {
    it("locks each one independently and prefers them over stored values", () => {
      const result = resolveAiSettings(
        { provider: "openai", base_url: "https://stored.example/v1" },
        { AI_PROVIDER: "custom", AI_BASE_URL: "https://env.example/v1" },
      );

      expect(result.effective.provider).toBe("custom");
      expect(result.effective.base_url).toBe("https://env.example/v1");
      expect(result.envLocked).toEqual({ provider: true, model: false, base_url: true });
    });
  });
});

describe("formatModelLabel", () => {
  it("returns an empty string when there is no model to show", () => {
    expect(formatModelLabel({ provider: "anthropic" })).toBe("");
  });

  it("joins provider and model", () => {
    expect(formatModelLabel({ provider: "anthropic", model: "claude-haiku-5-5" })).toBe("anthropic / claude-haiku-5-5");
  });
});
