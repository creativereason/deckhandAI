import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/config/route";
import { readConfig } from "@/lib/config-repository";

vi.mock("@/lib/config-repository", () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  delete process.env.AI_PROVIDER;
  delete process.env.AI_MODEL;
  delete process.env.AI_BASE_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("GET /api/config", () => {
  describe("when AI_MODEL is set in the environment", () => {
    it("reports the env model as effective while leaving the stored config untouched", async () => {
      vi.mocked(readConfig).mockResolvedValue({ ai: { provider: "anthropic", model: "claude-sonnet-4-5" } });
      process.env.AI_MODEL = "claude-haiku-5-5";

      const body = await (await GET()).json();

      expect(body.ai.model).toBe("claude-sonnet-4-5");
      expect(body.ai_effective).toEqual({ provider: "anthropic", model: "claude-haiku-5-5" });
      expect(body.ai_env_locked).toEqual({ provider: false, model: true, base_url: false });
    });
  });

  describe("when no AI env vars are set", () => {
    it("reports the stored config as effective and locks nothing", async () => {
      vi.mocked(readConfig).mockResolvedValue({ ai: { provider: "openai", model: "gpt-4o" } });

      const body = await (await GET()).json();

      expect(body.ai_effective).toEqual({ provider: "openai", model: "gpt-4o" });
      expect(body.ai_env_locked).toEqual({ provider: false, model: false, base_url: false });
    });
  });
});
