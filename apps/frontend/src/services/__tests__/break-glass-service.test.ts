import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { breakGlassService } from '../break-glass-service';
import { apiClient } from '../api-client';
import { ApiError } from '../api-client';

vi.mock('../api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api-client')>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

describe('BreakGlassService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('activateSession', () => {
    it('submits the correct backend payload', async () => {
      const mockResponse = { id: 'bg-123', status: 'active' };
      vi.mocked(apiClient).mockResolvedValueOnce(mockResponse as never);

      const payload = {
        patientId: 'patient-123',
        encounterId: 'encounter-123',
        reason: 'emergency_care' as const,
        justification: 'Patient is coding, need immediate access to history',
      };

      const result = await breakGlassService.activateSession(payload);

      expect(apiClient).toHaveBeenCalledWith('/break-glass/sessions', {
        method: 'POST',
        body: payload,
      });
      expect(result).toEqual(mockResponse);
    });

    it('throws ApiError on backend rejection', async () => {
      const apiError = new ApiError(500, { message: 'Mock error', code: 'MOCK_ERROR_CODE' });
      vi.mocked(apiClient).mockRejectedValueOnce(apiError);

      const payload = {
        patientId: 'patient-123',
        reason: 'patient_safety' as const,
        justification: 'Need access to check allergies before administering meds',
      };

      await expect(breakGlassService.activateSession(payload)).rejects.toThrow(ApiError);
    });
  });
});

