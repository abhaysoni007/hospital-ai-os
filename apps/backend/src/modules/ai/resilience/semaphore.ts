/**
 * Non-blocking concurrency semaphore (ADR-017 §5). Overflow is reported
 * immediately (honest 503 BUSY backpressure) — never queued invisibly.
 */
export class Semaphore {
  private inFlight = 0;

  constructor(private readonly size: number) {
    if (size < 1) throw new Error('Semaphore size must be >= 1');
  }

  get available(): number {
    return Math.max(0, this.size - this.inFlight);
  }

  tryAcquire(): boolean {
    if (this.inFlight >= this.size) return false;
    this.inFlight += 1;
    return true;
  }

  release(): void {
    if (this.inFlight === 0) throw new Error('Semaphore release without acquire');
    this.inFlight -= 1;
  }

  /** Runs `fn` under the semaphore or throws AiBusyError immediately. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.tryAcquire()) throw new AiBusyError();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export class AiBusyError extends Error {
  constructor() {
    super('AI subsystem at maximum concurrent provider calls');
    this.name = 'AiBusyError';
  }
}
