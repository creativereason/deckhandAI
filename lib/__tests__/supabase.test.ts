import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe("getSupabase", () => {
  // E — Exception: a missing key must fail at first use, not become an undefined header
  it.each([
    ["SUPABASE_URL", "https://x.supabase.co", "SUPABASE_SERVICE_ROLE_KEY"],
    ["SUPABASE_SERVICE_ROLE_KEY", "secret", "SUPABASE_URL"],
  ])("throws when %s is set but %s is missing", async (present, value, missing) => {
    vi.stubEnv(present, value);
    vi.stubEnv(missing, "");
    const { getSupabase } = await import("@/lib/supabase");

    expect(() => getSupabase()).toThrow(/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
  });

  // O — One
  it("returns the same client on every call", async () => {
    vi.stubEnv("SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "secret");
    const { getSupabase } = await import("@/lib/supabase");

    expect(getSupabase()).toBe(getSupabase());
  });
});
