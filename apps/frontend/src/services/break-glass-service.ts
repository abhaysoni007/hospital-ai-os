import { apiClient } from './api-client';

export interface BreakGlassSessionResponse {
  id: string;
  actorId: string;
  patientId: string;
  encounterId: string | null;
  reason: 'emergency_care' | 'patient_safety' | 'continuity_of_care';
  justification: string | null; // Only populated for review API
  status: 'active' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

export const breakGlassService = {
  activateSession: (payload: { patientId: string; encounterId?: string; reason: string; justification: string }) =>
    apiClient<{ data: BreakGlassSessionResponse }>('/break-glass/sessions', {
      method: 'POST',
      body: payload,
    }),

  listSessions: (params: { page?: number; limit?: number; status?: 'active' | 'revoked' | 'expired' } = {}) => {
    const search = new URLSearchParams();
    if (params.page) search.set('page', params.page.toString());
    if (params.limit) search.set('limit', params.limit.toString());
    if (params.status) search.set('status', params.status);
    return apiClient<{ data: BreakGlassSessionResponse[]; meta: { total: number } }>(`/break-glass/sessions?${search.toString()}`);
  },

  revokeSession: (id: string, reason: string) =>
    apiClient<{ data: BreakGlassSessionResponse }>(`/break-glass/sessions/${id}/revoke`, {
      method: 'POST',
      body: { reason },
    }),

  reviewSession: (id: string) =>
    apiClient<{ data: BreakGlassSessionResponse }>(`/break-glass/sessions/${id}/review`),
};
