import { afterEach, describe, expect, it, vi } from "vitest";
import { isPlaywrightFallbackEnabled } from "@/lib/env";

describe("isPlaywrightFallbackEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when the env var is unset", () => {
    // Arrange
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", undefined);

    // Act / Assert
    expect(isPlaywrightFallbackEnabled()).toBe(false);
  });

  it("returns true when the env var is exactly 'true'", () => {
    // Arrange
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "true");

    // Act / Assert
    expect(isPlaywrightFallbackEnabled()).toBe(true);
  });

  it("returns false for any other value, not just 'false'", () => {
    // Arrange
    vi.stubEnv("ENABLE_PLAYWRIGHT_FALLBACK", "1");

    // Act / Assert
    expect(isPlaywrightFallbackEnabled()).toBe(false);
  });
});
