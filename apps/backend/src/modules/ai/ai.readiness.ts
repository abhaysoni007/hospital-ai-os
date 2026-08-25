/**
 * AI subsystem readiness (ADR-020 §3). Determined BEFORE any request reaches
 * the provider: production missing/weak ENCRYPTION_KEY or AI_ENABLED=false or
 * absent API key ⇒ disabled. Never plaintext fallback; never mid-transaction
 * discovery.
 */
import { BreakerState } from './resilience/circuit-breaker';

export type AiSubsystemState = 'disabled' | 'ready' | 'breaker_open' | 'unavailable';

export interface ReadinessInputs {
  aiEnabled: boolean;
  apiKeyPresent: boolean;
  encryptionKeyValid: boolean;
}

/** Single source of truth for readiness inputs (orchestrator + health). */
export function resolveReadinessInputs(cfg: {
  AI_ENABLED: boolean;
  AI_PROVIDER: string;
  AI_API_KEY?: string;
  NODE_ENV: string;
}): ReadinessInputs {
  return {
    aiEnabled: cfg.AI_ENABLED,
    // The deterministic fake provider requires no credentials by design.
    apiKeyPresent: cfg.AI_PROVIDER === 'fake' || Boolean(cfg.AI_API_KEY),
    encryptionKeyValid: isEncryptionKeyValid(cfg.NODE_ENV, process.env.ENCRYPTION_KEY),
  };
}

const MIN_PRODUCTION_KEY_LENGTH = 32;

/** Mirrors utils/encryption.ts policy without importing process.env here. */
export function isEncryptionKeyValid(nodeEnv: string, encryptionKey: string | undefined): boolean {
  if (nodeEnv === 'production') {
    return typeof encryptionKey === 'string' && encryptionKey.length >= MIN_PRODUCTION_KEY_LENGTH;
  }
  // development/test use the documented insecure fallback key.
  return true;
}

export function computeAiSubsystemState(
  inputs: ReadinessInputs,
  breakerState: BreakerState,
  providerReachableHint = true,
): AiSubsystemState {
  if (!inputs.aiEnabled || !inputs.apiKeyPresent || !inputs.encryptionKeyValid) {
    return 'disabled';
  }
  if (!providerReachableHint) return 'unavailable';
  if (breakerState === 'open') return 'breaker_open';
  if (breakerState === 'half_open') return 'unavailable';
  return 'ready';
}
