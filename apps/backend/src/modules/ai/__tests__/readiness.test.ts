import { describe, expect, it } from 'vitest';
import { computeAiSubsystemState, isEncryptionKeyValid } from '../ai.readiness';

describe('AI subsystem readiness (ADR-020 §3)', () => {
  it('is disabled when AI_ENABLED=false even with keys present', () => {
    expect(
      computeAiSubsystemState(
        { aiEnabled: false, apiKeyPresent: true, encryptionKeyValid: true },
        'closed',
      ),
    ).toBe('disabled');
  });

  it('is disabled when API key absent', () => {
    expect(
      computeAiSubsystemState(
        { aiEnabled: true, apiKeyPresent: false, encryptionKeyValid: true },
        'closed',
      ),
    ).toBe('disabled');
  });

  it('is disabled when encryption key invalid (never plaintext fallback)', () => {
    expect(
      computeAiSubsystemState(
        { aiEnabled: true, apiKeyPresent: true, encryptionKeyValid: false },
        'closed',
      ),
    ).toBe('disabled');
  });

  it('mirrors breaker state when otherwise ready', () => {
    expect(
      computeAiSubsystemState(
        { aiEnabled: true, apiKeyPresent: true, encryptionKeyValid: true },
        'open',
      ),
    ).toBe('breaker_open');
    expect(
      computeAiSubsystemState(
        { aiEnabled: true, apiKeyPresent: true, encryptionKeyValid: true },
        'half_open',
      ),
    ).toBe('unavailable');
    expect(
      computeAiSubsystemState(
        { aiEnabled: true, apiKeyPresent: true, encryptionKeyValid: true },
        'closed',
      ),
    ).toBe('ready');
  });

  it('production requires a strong encryption key; dev/test allow the fallback', () => {
    expect(isEncryptionKeyValid('production', undefined)).toBe(false);
    expect(isEncryptionKeyValid('production', 'short')).toBe(false);
    expect(isEncryptionKeyValid('production', 'x'.repeat(32))).toBe(true);
    expect(isEncryptionKeyValid('development', undefined)).toBe(true);
    expect(isEncryptionKeyValid('test', undefined)).toBe(true);
  });

  it('marks fake provider as ready when AI_ENABLED=true without needing API key', () => {
    expect(
      computeAiSubsystemState(
        { aiEnabled: true, apiKeyPresent: true, encryptionKeyValid: true },
        'closed',
      ),
    ).toBe('ready');
  });

  it('remains fail-closed if AI is disabled regardless of provider', () => {
    expect(
      computeAiSubsystemState(
        { aiEnabled: false, apiKeyPresent: true, encryptionKeyValid: true },
        'closed',
      ),
    ).toBe('disabled');
  });
});
