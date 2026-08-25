import { describe, expect, it } from 'vitest';
import { CircuitBreaker, AiCircuitOpenError } from '../resilience/circuit-breaker';
import { Semaphore, AiBusyError } from '../resilience/semaphore';
import { PerUserRateLimiter } from '../resilience/rate-limiter';
import { aiShutdownRegistry, withProviderTimeout } from '../resilience/timeout';

describe('Circuit breaker (ADR-017 §4)', () => {
  it('opens after the consecutive-failure threshold', async () => {
    const t = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 3, openMs: 1000, now: () => t });
    const boom = () => Promise.reject(new Error('x'));

    for (let i = 0; i < 3; i++) await expect(breaker.execute(boom)).rejects.toThrow('x');
    expect(breaker.getState()).toBe('open');
    await expect(breaker.execute(() => Promise.resolve(1))).rejects.toBeInstanceOf(
      AiCircuitOpenError,
    );
  });

  it('admits exactly one half-open probe after openMs, then closes on success', async () => {
    let t = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 1, openMs: 100, now: () => t });
    await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow();
    expect(breaker.getState()).toBe('open');

    t = 101; // advance past openMs
    expect(breaker.getState()).toBe('half_open');

    // A second concurrent call while the probe runs is rejected.
    const probe = breaker.execute(() => new Promise((r) => setTimeout(() => r('ok'), 10)));
    await expect(breaker.execute(() => Promise.resolve('second'))).rejects.toBeInstanceOf(
      AiCircuitOpenError,
    );
    await expect(probe).resolves.toBe('ok');
    expect(breaker.getState()).toBe('closed');
  });

  it('re-opens when the half-open probe fails', async () => {
    let t = 0;
    const breaker = new CircuitBreaker({ failureThreshold: 1, openMs: 50, now: () => t });
    await expect(breaker.execute(() => Promise.reject(new Error('f')))).rejects.toThrow();
    t = 51;
    await expect(breaker.execute(() => Promise.reject(new Error('probe-fail')))).rejects.toThrow(
      'probe-fail',
    );
    expect(breaker.getState()).toBe('open');
  });
});

describe('Semaphore (ADR-017 §5)', () => {
  it('reports overflow immediately instead of queueing', async () => {
    const sem = new Semaphore(1);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    const first = sem.run(() => gate.then(() => 'first'));
    await expect(sem.run(async () => 'second')).rejects.toBeInstanceOf(AiBusyError);

    release();
    await expect(first).resolves.toBe('first');
  });

  it('releases slots deterministically', async () => {
    const sem = new Semaphore(2);
    await expect(sem.run(async () => 1)).resolves.toBe(1);
    expect(sem.available).toBe(2);
  });
});

describe('Per-user rate limiter (ADR-017 §6)', () => {
  it('allows up to the limit then reports retry-after', () => {
    let t = 0;
    const limiter = new PerUserRateLimiter(2, 60_000, () => t);
    expect(limiter.check('u').allowed).toBe(true);
    expect(limiter.check('u').allowed).toBe(true);
    const denied = limiter.check('u');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);

    // Different users are isolated.
    expect(limiter.check('other').allowed).toBe(true);

    // Window expiry restores allowance.
    t = 61_000;
    expect(limiter.check('u').allowed).toBe(true);
  });
});

describe('Provider timeout + shutdown registry (ADR-017 §3/§9)', () => {
  it('releases the caller at timeout even when the provider hangs', async () => {
    const start = Date.now();
    await expect(
      withProviderTimeout(40, () => new Promise<string>(() => undefined)),
    ).rejects.toThrow(/TIMEOUT/);
    expect(Date.now() - start).toBeLessThan(2000);
    expect(aiShutdownRegistry.inFlight).toBe(0);
  });

  it('abortAll aborts every in-flight provider call (graceful shutdown)', async () => {
    const pending = withProviderTimeout(
      30_000,
      (signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted-by-shutdown')));
        }),
    );
    await Promise.resolve();
    expect(aiShutdownRegistry.inFlight).toBe(1);
    expect(aiShutdownRegistry.abortAll('test')).toBe(1);
    await expect(pending).rejects.toThrow('aborted-by-shutdown');
    expect(aiShutdownRegistry.inFlight).toBe(0);
  });

  it('cleans up registration on successful completion', async () => {
    await expect(withProviderTimeout(1000, () => Promise.resolve('done'))).resolves.toBe('done');
    expect(aiShutdownRegistry.inFlight).toBe(0);
  });
});
