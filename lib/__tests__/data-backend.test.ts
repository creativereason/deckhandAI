import { afterEach, describe, expect, it, vi } from "vitest";
import { dataBackend } from "@/lib/data-backend";

afterEach(() => vi.unstubAllEnvs());

describe("dataBackend", () => {
  // Z — Zero
  it("returns github when DATA_BACKEND is unset", () => {
    vi.stubEnv("DATA_BACKEND", "");
    expect(dataBackend()).toBe("github");
  });

  // O — One
  it("returns supabase when DATA_BACKEND is supabase", () => {
    vi.stubEnv("DATA_BACKEND", "supabase");
    expect(dataBackend()).toBe("supabase");
  });

  // B — Boundary: screenshot runs must never reach a real database
  it("returns github when local demo fixtures are active", () => {
    vi.stubEnv("DATA_BACKEND", "supabase");
    vi.stubEnv("DEMO_MODE", "true");
    vi.stubEnv("DEMO_PERSONA", "dev");
    expect(dataBackend()).toBe("github");
  });

  // E — Exception: a typo must fail loudly, not fall back silently
  it("throws when DATA_BACKEND is not a known backend", () => {
    vi.stubEnv("DATA_BACKEND", "supabse");
    expect(() => dataBackend()).toThrow(/DATA_BACKEND/);
  });
});
