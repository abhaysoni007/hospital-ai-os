import { apiClient } from './api-client';
import type { AiNoteDraftResponse } from 'shared';

/** M12 AI capability client (hero note-draft + lifecycle). */
export const aiService = {
  async draftNote(
    encounterId: string,
    recordType: 'soap' | 'progress_note',
    instructions?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any> {
    return apiClient<AiNoteDraftResponse>('/ai/note-draft', {
      method: 'POST',
      body: { encounterId, recordType, instructions: instructions || undefined },
    });
  },

  async rejectInteraction(
    interactionId: string,
    reasonCategory: string,
    reasonNote?: string,
  ): Promise<void> {
    await apiClient(`/ai/interactions/${interactionId}/action`, {
      method: 'PATCH',
      body: {
        action: 'rejected',
        reasonCategory,
        reasonNote: reasonNote || undefined,
      },
    });
  },
};
