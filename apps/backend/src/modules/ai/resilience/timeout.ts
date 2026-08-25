import { randomUUID } from 'crypto';
import { AIProviderError } from '../adapters/provider.interface';

/**
 * Abort/drain registry (ADR-017 §9): every in-flight provider call registers
 * its AbortController here so the graceful-shutdown hook can abort them on
 * SIGTERM/SIGINT. Per-call timeouts route through the same mechanism.
 */
class AiShutdownRegistry {
  private controllers = new Map<string, AbortController>();

  register(controller: AbortController): string {
    const id = randomUUID();
    this.controllers.set(id, controller);
    return id;
  }

  unregister(id: string): void {
    this.controllers.delete(id);
  }

  /** Aborts every in-flight provider call. Called from graceful shutdown. */
  abortAll(reason = 'graceful-shutdown'): number {
    const count = this.controllers.size;
    for (const c of this.controllers.values()) {
      c.abort(new Error(reason));
    }
    this.controllers.clear();
    return count;
  }

  get inFlight(): number {
    return this.controllers.size;
  }
}

export const aiShutdownRegistry = new AiShutdownRegistry();

/**
 * Races `fn` against a hard timeout. The linked AbortSignal is handed to the
 * provider so cooperative cancellation can occur; the race guarantees the
 * caller is released at `timeoutMs` regardless.
 */
export async function withProviderTimeout<T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const id = aiShutdownRegistry.register(controller);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AIProviderError('TIMEOUT', `provider aborted after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  // The provider may win the race; swallow the losing rejection.
  timeoutPromise.catch(() => undefined);

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    aiShutdownRegistry.unregister(id);
  }
}
