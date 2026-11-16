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
      const body = JSON.parse(buildBody({}, [{ role: "user", content: "hi" }], { stream: false }));

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
      const body = JSON.parse(buildBody({}, [{ role: "user", content: "hi" }], { stream: false }));

      // Assert
      expect(body.extra_body).toBeUndefined();
    });
  });

  describe("output length", () => {
    const msgs = [{ role: "user" as const, content: "hi" }];

    // O — the default stays as it was for every existing caller
    it("allows 2048 output tokens by default", () => {
      process.env.AI_PROVIDER = "anthropic";
      expect(JSON.parse(buildBody({}, msgs, { stream: false })).max_tokens).toBe(2048);
    });

    // B — a long structured answer (a tailored resume) can ask for more, on either request shape
    it("uses the requested limit for Anthropic requests", () => {
      process.env.AI_PROVIDER = "anthropic";
      expect(JSON.parse(buildBody({}, msgs, { stream: false, maxTokens: 8192 })).max_tokens).toBe(8192);
    });

    it("uses the requested limit for OpenAI-compatible requests", () => {
      process.env.AI_PROVIDER = "openai";
      expect(JSON.parse(buildBody({}, msgs, { stream: false, maxTokens: 8192 })).max_tokens).toBe(8192);
    });
  });
});
