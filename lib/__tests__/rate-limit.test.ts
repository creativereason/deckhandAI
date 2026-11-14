import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  // Z — Zero
  it("allows the first request", () => {
    expect(createRateLimiter({ limit: 3, windowMs: 60_000 }).check("a", 0).allowed).toBe(true);
  });

  // M — Many / B — Boundary: exactly `limit` requests fit in the window, the next does not
  it("allows up to the limit and refuses the next request", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });

    const results = [0, 1, 2, 3].map((t) => limiter.check("a", t).allowed);

    expect(results).toEqual([true, true, true, false]);
  });

  it("tells a refused caller how long to wait, rounded up to whole seconds", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check("a", 0);

    expect(limiter.check("a", 10_500)).toEqual({ allowed: false, retryAfterSeconds: 50 });
  });

  // B — Boundary: the window slides, it is not a fixed bucket that resets all at once
  it("lets a request through once the oldest one leaves the window", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });
    limiter.check("a", 0);
    limiter.check("a", 600);

    expect(limiter.check("a", 900).allowed).toBe(false);
    expect(limiter.check("a", 1_000).allowed).toBe(true);
  });

  it("does not count refused requests against the caller", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });
    limiter.check("a", 0);
    for (let t = 1; t < 900; t += 100) limiter.check("a", t);

    expect(limiter.check("a", 1_000).allowed).toBe(true);
  });

  // I — Interface: each agent has its own budget
  it("keeps separate budgets per key", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    limiter.check("muse", 0);

    expect(limiter.check("muse", 1).allowed).toBe(false);
    expect(limiter.check("duet", 1).allowed).toBe(true);
  });
});
