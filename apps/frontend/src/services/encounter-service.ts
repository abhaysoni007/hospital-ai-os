import { apiClient } from './api-client';
import type {
  GetEncountersQuery,
  EncounterDetailResponse,
  EncounterListItem,
  EncounterStatusValue,
} from 'shared';
import type { PaginatedResponse } from './patient-service';

export const encounterService = {
  async getEncounters(query?: GetEncountersQuery): Promise<PaginatedResponse<EncounterListItem>> {
    const searchParams = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const queryString = searchParams.toString();
    return apiClient(queryString ? `/encounters?${queryString}` : '/encounters', {
      method: 'GET',
    });
  },

  async getEncounterById(id: string): Promise<{ data: EncounterDetailResponse }> {
    return apiClient(`/encounters/${id}`, { method: 'GET' });
  },

  async activateEncounter(
    id: string,
    expectedVersion: number,
  ): Promise<{ data: { id: string; status: EncounterStatusValue; version: number } }> {
    return apiClient(`/encounters/${id}/activate`, {
      method: 'PATCH',
      body: { expectedVersion },
    });
  },

  async dischargeEncounter(
    id: string,
    payload: { expectedVersion: number; summary: string },
  ): Promise<{ data: { id: string; status: EncounterStatusValue; version: number } }> {
    return apiClient(`/encounters/${id}/discharge`, {
      method: 'POST',
      body: payload,
    });
  },
};
