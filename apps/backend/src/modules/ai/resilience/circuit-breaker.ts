/**
 * In-process circuit breaker (ADR-017 §4).
 * CLOSED → OPEN after `failureThreshold` consecutive failures OR >50% failure
 * rate within `windowMs` → HALF_OPEN after `openMs` → a single probe decides.
 * Clock is injectable for deterministic tests. No retry logic lives here.
 */
export type BreakerState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // consecutive failures to trip (default 3)
  windowMs?: number; // sliding window for rate-based trip (default 60_000)
  openMs?: number; // time in OPEN before admitting one probe (default 30_000)
  now?: () => number;
}

interface AttemptRecord {
  at: number;
  ok: boolean;
}

export class CircuitBreaker {
  private state: BreakerState = 'closed';
  private consecutiveFailures = 0;
  private attempts: AttemptRecord[] = [];
  private openedAt = 0;
  private probeInFlight = false;
  private readonly failureThreshold: number;
  private readonly windowMs: number;
  private readonly openMs: number;
  private readonly now: () => number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.windowMs = options.windowMs ?? 60_000;
    this.openMs = options.openMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  getState(): BreakerState {
    if (this.state === 'open' && this.now() - this.openedAt >= this.openMs) {
      // Admit exactly one probe; remains half_open until the probe resolves.
      return 'half_open';
    }
    return this.state;
  }

  /**
   * Executes `fn` under breaker discipline. Throws AiCircuitOpenError while
   * OPEN (or while a HALF_OPEN probe is already in flight).
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.getState();
    if (state === 'open') throw new AiCircuitOpenError();
    if (state === 'half_open') {
      if (this.probeInFlight) throw new AiCircuitOpenError();
      this.probeInFlight = true;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    } finally {
      if (state === 'half_open') this.probeInFlight = false;
    }
  }

  private prune(): void {
    const t = this.now();
    this.attempts = this.attempts.filter((a) => t - a.at <= this.windowMs);
  }

  private onSuccess(): void {
    this.attempts.push({ at: this.now(), ok: true });
    this.consecutiveFailures = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    const t = this.now();
    this.attempts.push({ at: t, ok: false });
    this.consecutiveFailures += 1;
    this.prune();

    const recent = this.attempts.filter((a) => !a.ok);
    const total = this.attempts.length;
    // Rate-based trip requires a meaningful sample so the consecutive-failure
    // threshold governs low-volume behavior (ai-architecture §8.1).
    const rateTripped = total >= 4 && recent.length / total > 0.5;

    if (this.consecutiveFailures >= this.failureThreshold || rateTripped) {
      this.state = 'open';
      this.openedAt = t;
    }
  }
}

export class AiCircuitOpenError extends Error {
  constructor() {
    super('AI circuit breaker is open');
    this.name = 'AiCircuitOpenError';
  }
}
