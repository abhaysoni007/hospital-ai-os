import { AiCapability, ContextBlock, GapCode } from 'shared';
import { NOTE_DRAFT_TEMPLATE_ID, buildNoteDraftPrompt } from './note-draft.v1';
import { CHART_SEARCH_TEMPLATE_ID, buildChartSearchPrompt } from './chart-search.v1';

export {
  canonicalizeUntrustedText,
  CONTEXT_START,
  CONTEXT_END,
  PATIENT_INPUT_OPEN,
  PATIENT_INPUT_CLOSE,
} from './canonicalize';
export { NOTE_DRAFT_TEMPLATE_ID, buildNoteDraftPrompt } from './note-draft.v1';
export type { NoteDraftPromptInput } from './note-draft.v1';
export { CHART_SEARCH_TEMPLATE_ID, buildChartSearchPrompt } from './chart-search.v1';
export type { ChartSearchPromptInput } from './chart-search.v1';

/**
 * Prompt template registry (PROMPT_ARCHITECTURE.md §1). Versioned templates
 * live in code; the id persisted per interaction is the reproducibility key.
 */
export interface PromptTemplate {
  templateId: string;
  build: (input: {
    blocks: readonly ContextBlock[];
    gaps: readonly GapCode[];
    instructions?: string;
  }) => {
    templateId: string;
    systemInstruction: string;
    userPrompt: string;
  };
}

export const PROMPT_TEMPLATES: Record<AiCapability, PromptTemplate> = {
  note_draft: {
    templateId: NOTE_DRAFT_TEMPLATE_ID,
    build: (input) =>
      buildNoteDraftPrompt({
        blocks: input.blocks,
        gaps: input.gaps,
        instructions: input.instructions,
        recordType: 'soap',
      }),
  },
  chart_search: {
    templateId: CHART_SEARCH_TEMPLATE_ID,
    build: (input) =>
      buildChartSearchPrompt({
        blocks: input.blocks,
        gaps: input.gaps,
        question: input.instructions,
      }),
  },
};

export function getPromptTemplate(capability: AiCapability): PromptTemplate {
  const t = PROMPT_TEMPLATES[capability];
  if (!t) throw new Error(`No prompt template registered for capability ${capability}`);
  return t;
}
