/**
 * Per-user sliding-window invocation limiter (ADR-017 §6). PER-INSTANCE by
 * design — documented acceptable at hospital-intranet scale; the daily token
 * budget carries the globally-correct enforcement via the database.
 */
export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
}

export class PerUserRateLimiter {
  private hits = new Map<string, number[]>();
  private readonly windowMs: number;

  constructor(
    private readonly maxPerWindow: number,
    windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {
    if (maxPerWindow < 1) throw new Error('Rate limit must be >= 1');
    this.windowMs = windowMs;
  }

  check(userId: string): RateLimitDecision {
    const t = this.now();
    const arr = (this.hits.get(userId) ?? []).filter((ts) => t - ts < this.windowMs);
    if (arr.length >= this.maxPerWindow) {
      const oldest = arr[0];
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((this.windowMs - (t - oldest)) / 1000)),
      };
    }
    arr.push(t);
    this.hits.set(userId, arr);
    return { allowed: true, retryAfterSec: 0 };
  }
}
