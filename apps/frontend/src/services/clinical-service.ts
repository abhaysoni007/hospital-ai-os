import { apiClient } from './api-client';
import type {
  CreateClinicalRecordRequest,
  UpdateClinicalRecordRequest,
  ClinicalRecordResponse,
} from 'shared';
import type { PaginatedResponse } from './patient-service';

export const clinicalService = {
  async createClinicalRecord(
    encounterId: string,
    payload: CreateClinicalRecordRequest,
  ): Promise<{ data: ClinicalRecordResponse }> {
    return apiClient(`/encounters/${encounterId}/clinical-records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getClinicalRecords(
    encounterId: string,
  ): Promise<PaginatedResponse<ClinicalRecordResponse>> {
    return apiClient(`/encounters/${encounterId}/clinical-records`, { method: 'GET' });
  },

  async getClinicalRecord(
    encounterId: string,
    recordId: string,
  ): Promise<{ data: ClinicalRecordResponse }> {
    return apiClient(`/encounters/${encounterId}/clinical-records/${recordId}`, { method: 'GET' });
  },

  async updateClinicalRecord(
    encounterId: string,
    recordId: string,
    payload: UpdateClinicalRecordRequest,
  ): Promise<{ data: ClinicalRecordResponse }> {
    return apiClient(`/encounters/${encounterId}/clinical-records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async signClinicalRecord(
    encounterId: string,
    recordId: string,
    expectedVersion: number,
  ): Promise<{ data: ClinicalRecordResponse }> {
    return apiClient(`/encounters/${encounterId}/clinical-records/${recordId}/sign`, {
      method: 'POST',
      body: JSON.stringify({ expectedVersion }),
    });
  },
};
