import { describe, it, expect, afterEach, vi } from "vitest";
import { githubRead, githubWrite } from "@/lib/github";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("githubRead / githubWrite", () => {
  describe("when running with local demo fixtures (DEMO_MODE + DEMO_PERSONA)", () => {
    it("reads from the persona sample file on disk without touching the network", async () => {
      // Arrange
      process.env.DEMO_MODE = "true";
      process.env.DEMO_PERSONA = "design";
      const fetchSpy = vi.spyOn(global, "fetch");

      // Act
      const raw = await githubRead("data/scrape-targets.json");

      // Assert
      expect(() => JSON.parse(raw)).not.toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("serves previously written content back on read instead of the real repo, and never touches the network", async () => {
      // Arrange
      process.env.DEMO_MODE = "true";
      process.env.DEMO_PERSONA = "dev";
      const fetchSpy = vi.spyOn(global, "fetch");

      // Act
      await githubWrite("data/jobs.json", JSON.stringify({ applied: ["placeholder"] }), "test write");
      const raw = await githubRead("data/jobs.json");

      // Assert
      expect(JSON.parse(raw)).toEqual({ applied: ["placeholder"] });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
