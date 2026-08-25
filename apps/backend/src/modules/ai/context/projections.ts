import {
  ContextBlock,
  GapCode,
  InputManifestEntry,
  aiCapabilitySchema,
  contextBlockSchema,
} from 'shared';

/**
 * Context projection enforcement (ADR-018 §2/§4).
 *
 * Blocks arrive from M12 assemblers that used AUTHORIZED READERS; this layer
 * independently enforces the ALLOWLIST contract before anything may reach a
 * prompt: unknown block types fail closed, forbidden fields cannot validate
 * (schemas are `.strict()`), and the manifest is derived mechanically.
 */
export function parseContextBlock(raw: unknown): ContextBlock {
  return contextBlockSchema.parse(raw);
}

export function parseContextBlocks(raw: readonly unknown[]): ContextBlock[] {
  return raw.map(parseContextBlock);
}

/** Mechanical manifest derivation — the citation-validation source of truth. */
export function buildInputManifest(
  blocks: readonly ContextBlock[],
  capturedAt: Date,
): InputManifestEntry[] {
  const manifest: InputManifestEntry[] = [];
  for (const b of blocks) {
    switch (b.blockType) {
      case 'clinical_record':
        manifest.push({
          sourceType: 'CLINICAL_RECORD',
          sourceId: b.sourceId,
          version: b.version,
          capturedAt: capturedAt.toISOString(),
        });
        break;
      case 'diagnostic_order':
        manifest.push({
          sourceType: 'DIAGNOSTIC_ORDER',
          sourceId: b.sourceId,
          capturedAt: capturedAt.toISOString(),
        });
        break;
      case 'diagnostic_result':
        manifest.push({
          sourceType: 'DIAGNOSTIC_RESULT',
          sourceId: b.sourceId,
          capturedAt: capturedAt.toISOString(),
        });
        break;
      // patient_demographics / encounter_metadata are descriptive context,
      // not citable sources (no durable record id to cite).
      default:
        break;
    }
  }
  return manifest;
}

/**
 * Defense-in-depth helper for M12 instruction-slot validation: detects direct
 * identifier patterns in arbitrary free text (ADR-018 §4 battery primitive).
 * Conservative — tuned to obvious identifiers, not clinical abbreviations.
 */
const IDENTIFIER_PATTERNS: RegExp[] = [
  /\bMRN-\d{4}-\d{4,6}\b/i,
  /\baadhaar|\bpan\b|\bpassport no/i,
  /\b\d{10}\b/, // bare 10-digit phone-like numbers
  /\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/, // ISO DOB
];

export function containsDirectIdentifierPattern(text: string): boolean {
  return IDENTIFIER_PATTERNS.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// Deterministic gap detection (ADR-018 §6) — computed BEFORE provider call.
// The model must echo these; it never invents the authoritative list.
// ---------------------------------------------------------------------------

export function computeInformationGaps(
  capability: string,
  blocks: readonly ContextBlock[],
): GapCode[] {
  const cap = aiCapabilitySchema.parse(capability);
  const gaps: GapCode[] = [];

  if (cap === 'note_draft') {
    const enc = blocks.find((b) => b.blockType === 'encounter_metadata');
    if (!enc || enc.blockType !== 'encounter_metadata' || !enc.chiefComplaint) {
      gaps.push('NO_CHIEF_COMPLAINT');
    }
    if (!blocks.some((b) => b.blockType === 'clinical_record' && b.recordType === 'vital_signs')) {
      gaps.push('NO_VITALS_SIGNS');
    }
    if (
      !blocks.some(
        (b) =>
          b.blockType === 'clinical_record' &&
          (b.recordType === 'soap' || b.recordType === 'progress_note'),
      )
    ) {
      gaps.push('NO_PRIOR_NOTES');
    }
    if (!blocks.some((b) => b.blockType === 'diagnostic_order')) gaps.push('NO_DIAGNOSTIC_ORDERS');
    if (!blocks.some((b) => b.blockType === 'diagnostic_result'))
      gaps.push('NO_DIAGNOSTIC_RESULTS');
    // No medication/allergy module exists yet — always surfaced honestly.
    gaps.push('NO_MEDICATION_HISTORY', 'NO_ALLERGY_DATA');
  } else {
    if (!blocks.some((b) => b.blockType === 'clinical_record')) gaps.push('NO_PRIOR_NOTES');
    if (!blocks.some((b) => b.blockType === 'diagnostic_result'))
      gaps.push('NO_DIAGNOSTIC_RESULTS');
  }

  return gaps; // deterministic order of first-occurrence per rule list above
}
