import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auditService } from '../audit-service';
import { apiClient } from '../api-client';

vi.mock('../api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api-client')>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

describe('AuditService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('queries GET /audit with default parameters', async () => {
    const mockResponse = {
      data: [],
      meta: { total: 0, page: 1, limit: 50, totalPages: 0 },
    };
    vi.mocked(apiClient).mockResolvedValueOnce(mockResponse as never);

    const result = await auditService.getEvents();

    expect(apiClient).toHaveBeenCalledWith('/audit', {
      method: 'GET',
    });
    expect(result).toEqual(mockResponse);
  });

  it('serializes supported server query parameters correctly', async () => {
    const mockResponse = {
      data: [],
      meta: { total: 10, page: 2, limit: 20, totalPages: 1 },
    };
    vi.mocked(apiClient).mockResolvedValueOnce(mockResponse as never);

    const result = await auditService.getEvents({
      page: 2,
      pageSize: 20,
      eventType: 'BREAK_GLASS_ACTIVATED',
      actorId: '00000000-0000-0000-0000-000000000001',
      patientId: '11111111-1111-1111-1111-111111111111',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-09-05T23:59:59.000Z',
    });

    const expectedUrl =
      '/audit?page=2&pageSize=20&eventType=BREAK_GLASS_ACTIVATED&actorId=00000000-0000-0000-0000-000000000001&patientId=11111111-1111-1111-1111-111111111111&startDate=2026-09-01T00%3A00%3A00.000Z&endDate=2026-09-05T23%3A59%3A59.000Z';

    expect(apiClient).toHaveBeenCalledWith(expectedUrl, {
      method: 'GET',
    });
    expect(result.meta.page).toBe(2);
  });
});
