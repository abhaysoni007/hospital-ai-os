/**
 * Delimiter canonicalization (PROMPT_ARCHITECTURE.md §4, ADR-018 §11).
 * Clinical text is UNTRUSTED data: delimiter-like tokens inside clinical
 * content are neutralized before serialization so context can never forge
 * structural boundaries or system markers.
 */
export const CONTEXT_START = '[CLINICAL_CONTEXT_START]';
export const CONTEXT_END = '[CLINICAL_CONTEXT_END]';
export const PATIENT_INPUT_OPEN = '[PATIENT_INPUT]';
export const PATIENT_INPUT_CLOSE = '[/PATIENT_INPUT]';

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\[CLINICAL_CONTEXT_START\]/gi,
  /\[CLINICAL_CONTEXT_END\]/gi,
  /\[PATIENT_INPUT\]/gi,
  /\[\/PATIENT_INPUT\]/gi,
  /\[SYSTEM_[A-Z_]+\]/g,
];

/**
 * Neutralizes structural tokens in untrusted text. Deterministic and
 * idempotent; adversarial fixtures assert no forged boundary survives.
 */
export function canonicalizeUntrustedText(text: string): string {
  let out = text;
  for (const pattern of FORBIDDEN_PATTERNS) {
    out = out.replace(pattern, (match) => match.replace(/\[/g, '(').replace(/\]/g, ')'));
  }
  return out;
}
