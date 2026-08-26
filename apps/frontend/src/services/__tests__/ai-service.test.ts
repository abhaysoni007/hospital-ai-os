import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiService } from '../ai-service';
import type { AiNoteDraftResponse } from 'shared';

describe('aiService (M12 note-draft frontend contract)', () => {
  const mockResponse: { data: AiNoteDraftResponse } = {
    data: {
      interactionId: '11111111-1111-1111-1111-111111111111',
      groundingStatus: 'grounded',
      promptTemplateId: 'note_draft@1',
      provider: 'fake',
      model: 'gemini-2.0-flash',
      latencyMs: 120,
      computedGaps: ['NO_VITALS_SIGNS'],
      draft: {
        sections: [
          {
            heading: 'subjective',
            content: 'Subjective report',
            citations: [
              {
                sourceType: 'CLINICAL_RECORD',
                sourceId: '22222222-2222-2222-2222-222222222222',
                excerpt: 'history',
              },
            ],
          },
          {
            heading: 'objective',
            content: 'Objective findings',
            citations: [
              {
                sourceType: 'CLINICAL_RECORD',
                sourceId: '22222222-2222-2222-2222-222222222222',
                excerpt: 'vitals',
              },
            ],
          },
          {
            heading: 'assessment',
            content: 'Assessment',
            citations: [
              {
                sourceType: 'CLINICAL_RECORD',
                sourceId: '22222222-2222-2222-2222-222222222222',
                excerpt: 'diagnosis',
              },
            ],
          },
          {
            heading: 'plan',
            content: 'Treatment plan',
            citations: [
              {
                sourceType: 'CLINICAL_RECORD',
                sourceId: '22222222-2222-2222-2222-222222222222',
                excerpt: 'orders',
              },
            ],
          },
        ],
        disclaimers: ['AI-generated draft for clinician review.'],
        informationGaps: ['NO_VITALS_SIGNS'],
      },
    },
  };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('draftNote returns envelope with data property containing AiNoteDraftResponse', async () => {
    const res = await aiService.draftNote('test-encounter-id', 'soap');
    expect(res).toBeDefined();
    expect(res.data).toBeDefined();
    expect(res.data.interactionId).toBe('11111111-1111-1111-1111-111111111111');
    expect(res.data.groundingStatus).toBe('grounded');
    expect(res.data.computedGaps).toContain('NO_VITALS_SIGNS');
    expect(res.data.draft).toBeDefined();
    if ('sections' in res.data.draft) {
      expect(res.data.draft.sections).toHaveLength(4);
    }
  });

  it('rejectInteraction sends action rejection payload', async () => {
    let capturedBody: string | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        capturedBody = init?.body as string;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { success: true } }),
        };
      }),
    );

    await aiService.rejectInteraction('test-interaction-id', 'INACCURATE_CLINICAL_CONTENT', 'note');
    expect(capturedBody).toBeDefined();
    const parsed = JSON.parse(capturedBody!);
    expect(parsed).toEqual({
      action: 'rejected',
      reasonCategory: 'INACCURATE_CLINICAL_CONTENT',
      reasonNote: 'note',
    });
  });
});
