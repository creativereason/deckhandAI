import { describe, it, expect, afterEach } from "vitest";
import { buildBody } from "@/lib/model";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("buildBody", () => {
  describe("when the endpoint is Gemini's OpenAI-compatible API", () => {
    it("disables thinking via extra_body so the reasoning budget doesn't eat the visible answer", () => {
      // Arrange
      process.env.AI_PROVIDER = "custom";
      process.env.AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
      process.env.AI_MODEL = "gemini-2.5-flash";

      // Act
      const body = JSON.parse(buildBody({}, [{ role: "user", content: "hi" }], false));

      // Assert
      expect(body.extra_body).toEqual({ google: { thinking_config: { thinking_budget: 0 } } });
    });
  });

  describe("when the provider is anthropic", () => {
    it("does not include a Gemini extra_body", () => {
      // Arrange
      process.env.AI_PROVIDER = "anthropic";
      delete process.env.AI_BASE_URL;
      process.env.AI_MODEL = "claude-sonnet-4-6";

      // Act
      const body = JSON.parse(buildBody({}, [{ role: "user", content: "hi" }], false));

      // Assert
      expect(body.extra_body).toBeUndefined();
    });
  });
});
