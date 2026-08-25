import { z } from 'zod';
import { Citation, GapCode, InputManifestEntry, ValidationFailure } from 'shared';

/**
 * Output validation pipeline (ADR-018 §6/§7, PROMPT_ARCHITECTURE.md §5):
 *   provider raw text → PARSE → SCHEMA → BUSINESS → CITATION → GAP
 * Invalid output NEVER enters application state. No silent repair.
 *
 * Guarantee vocabulary: a `grounded` result is SOURCE-GROUNDED
 * (provenance-verified) — it does NOT claim semantic entailment or clinical
 * correctness; mandatory human review is the semantic control.
 */

export type PipelineStatus = 'grounded' | 'validation_failed';

export interface PipelineResult<T> {
  status: PipelineStatus;
  parsed?: T;
  failures: ValidationFailure[];
}

export interface PipelineOptions<T> {
  /** Capability output schema (shared contract). */
  schema: z.ZodType<T>;
  /** Manifest entries assembled for THIS interaction (citation source of truth). */
  manifest: readonly InputManifestEntry[];
  /** System-computed gaps the model must echo (superset check). */
  requiredGaps: readonly GapCode[];
}

export function runValidationPipeline<T>(
  rawText: unknown,
  options: PipelineOptions<T>,
): PipelineResult<T> {
  // Stage 1 — PARSE
  if (typeof rawText !== 'string') {
    return fail('PARSE', 'Provider response was not text');
  }
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    return fail('PARSE', 'Response was not valid JSON');
  }

  // Stage 2 — SCHEMA
  const parsed = options.schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return fail('SCHEMA', `Schema validation failed — ${first}`);
  }
  const output = parsed.data;

  // Stage 3 — BUSINESS (structural invariants beyond shape)
  const citations = extractCitations(output);
  if (citations.length === 0) {
    return fail('BUSINESS', 'Output contained no citations');
  }

  // Stage 4 — CITATION (provenance integrity: manifest subset, exact ids)
  const manifestKeys = new Set(options.manifest.map((m) => `${m.sourceType}:${m.sourceId}`));
  for (const c of citations) {
    if (!manifestKeys.has(`${c.sourceType}:${c.sourceId}`)) {
      return fail(
        'CITATION',
        `Foreign/fabricated citation rejected: ${c.sourceType}:${c.sourceId}`,
      );
    }
  }

  // Stage 5 — GAP fidelity (output gaps ⊇ computed gaps)
  const outputGaps = new Set(extractGaps(output));
  for (const g of options.requiredGaps) {
    if (!outputGaps.has(g)) {
      return fail('GAP', `System-computed gap not echoed by model: ${g}`);
    }
  }

  return { status: 'grounded', parsed: output, failures: [] };
}

function fail(stage: ValidationFailure['stage'], message: string): PipelineResult<never> {
  return { status: 'validation_failed', failures: [{ stage, message }] };
}

/** Shape-agnostic extraction so pipeline stays generic across capabilities. */
function extractCitations(output: unknown): Citation[] {
  const out: Citation[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (
        typeof obj['sourceType'] === 'string' &&
        typeof obj['sourceId'] === 'string' &&
        typeof obj['excerpt'] === 'string'
      ) {
        out.push(obj as unknown as Citation);
      }
      Object.values(obj).forEach(visit);
    }
  };
  visit(output);
  return out;
}

function extractGaps(output: unknown): GapCode[] {
  if (
    output &&
    typeof output === 'object' &&
    Array.isArray((output as Record<string, unknown>)['informationGaps'])
  ) {
    return (output as { informationGaps: GapCode[] }).informationGaps;
  }
  return [];
}
