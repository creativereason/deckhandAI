// A sliding-window limiter held in memory. On serverless each instance has its own
// window, so the effective limit can be a few times `limit` across instances: this stops
// a runaway agent, it is not a billing-grade quota.
export interface RateLimiter {
  check(key: string, now?: number): { allowed: boolean; retryAfterSeconds: number };
}

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    check(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds: Math.ceil((recent[0] + windowMs - now) / 1000) };
      }
      hits.set(key, [...recent, now]);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
