import { auditService } from '../audit/audit.service';
import { config } from '../../config';
import { FakeProvider } from './adapters/fake.provider';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { AIProviderAdapter } from './adapters/provider.interface';
import { AIOrchestrator } from './orchestrator';
import { computeAiSubsystemState, isEncryptionKeyValid, AiSubsystemState } from './ai.readiness';

/**
 * Composition root for the M11 AI infrastructure (ADR-017 §11).
 * The Gemini SDK is constructed ONLY here and ONLY inside adapters/.
 * When AI is disabled or unconfigured the adapter is inert: readiness reports
 * `disabled` and every orchestrator invocation short-circuits with 503.
 */

function buildAdapter(): AIProviderAdapter {
  if (config.AI_PROVIDER === 'fake') return new FakeProvider();
  return new GeminiAdapter(config.AI_API_KEY ?? 'unconfigured', config.AI_MODEL_NAME);
}

// Constructed eagerly but harmlessly: GeminiAdapter's constructor only builds
// a client handle; no network occurs until a call is made.
const adapter = buildAdapter();
export const aiOrchestrator = new AIOrchestrator(adapter, auditService);

export function getAiSubsystemState(): AiSubsystemState {
  return computeAiSubsystemState(
    {
      aiEnabled: config.AI_ENABLED,
      apiKeyPresent: Boolean(config.AI_API_KEY),
      encryptionKeyValid: isEncryptionKeyValid(config.NODE_ENV, process.env.ENCRYPTION_KEY),
    },
    aiOrchestrator.breakerState,
  );
}

/** Metadata-only snapshot for the health endpoint (no secrets, no credentials). */
export function getAiHealthSnapshot(): {
  state: AiSubsystemState;
  enabled: boolean;
  provider: string;
  breaker: string;
} {
  return {
    state: getAiSubsystemState(),
    enabled: config.AI_ENABLED,
    provider: config.AI_PROVIDER,
    breaker: aiOrchestrator.breakerState,
  };
}
