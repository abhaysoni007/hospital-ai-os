import { apiClient } from './api-client';
import { AuditEventResponse, GetAuditEventsQuery } from 'shared';

export interface AuditEventsResponse {
  data: AuditEventResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const auditService = {
  /**
   * Query the tamper-evident audit ledger using the backend GET /api/v1/audit endpoint.
   * Server filters supported: page, pageSize, eventType, actorId, patientId, startDate, endDate.
   */
  async getEvents(query?: GetAuditEventsQuery): Promise<AuditEventsResponse> {
    const searchParams = new URLSearchParams();
    if (query) {
      if (query.page !== undefined && query.page !== null) {
        searchParams.set('page', String(query.page));
      }
      if (query.pageSize !== undefined && query.pageSize !== null) {
        searchParams.set('pageSize', String(query.pageSize));
      }
      if (query.eventType) {
        searchParams.set('eventType', query.eventType);
      }
      if (query.actorId) {
        searchParams.set('actorId', query.actorId);
      }
      if (query.patientId) {
        searchParams.set('patientId', query.patientId);
      }
      if (query.startDate) {
        searchParams.set('startDate', query.startDate);
      }
      if (query.endDate) {
        searchParams.set('endDate', query.endDate);
      }
    }

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/audit?${queryString}` : '/audit';

    return apiClient<AuditEventsResponse>(endpoint, {
      method: 'GET',
    });
  },
};
