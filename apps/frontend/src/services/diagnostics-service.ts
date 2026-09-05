import { apiClient } from './api-client';
import type {
  CreateDiagnosticOrderRequest,
  EnterResultRequest,
  DiagnosticOrderResponse,
  DiagnosticResultResponse,
  GetDiagnosticOrdersQuery,
  CancelDiagnosticOrderRequest,
} from 'shared';
import type { PaginatedResponse } from './patient-service';

function toQuery(query?: GetDiagnosticOrdersQuery): string {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) params.append(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const diagnosticsService = {
  // ---- Encounter-scoped ----------------------------------------------------
  async createOrder(
    encounterId: string,
    payload: CreateDiagnosticOrderRequest,
  ): Promise<{ data: DiagnosticOrderResponse }> {
    return apiClient(`/encounters/${encounterId}/diagnostic-orders`, {
      method: 'POST',
      body: payload,
    });
  },

  async getEncounterOrders(encounterId: string): Promise<{
    data: DiagnosticOrderResponse[];
  }> {
    return apiClient(`/encounters/${encounterId}/diagnostic-orders`, { method: 'GET' });
  },

  // ---- Lab queue / order ops ------------------------------------------------

  async getLabQueue(
    query?: GetDiagnosticOrdersQuery,
  ): Promise<PaginatedResponse<DiagnosticOrderResponse>> {
    return apiClient(`/diagnostic-orders${toQuery(query)}`, { method: 'GET' });
  },

  async getOrder(id: string): Promise<{ data: DiagnosticOrderResponse }> {
    return apiClient(`/diagnostic-orders/${id}`, { method: 'GET' });
  },

  async collectSample(id: string): Promise<{ data: DiagnosticOrderResponse }> {
    return apiClient(`/diagnostic-orders/${id}/collect-sample`, { method: 'PATCH' });
  },

  async cancelOrder(
    id: string,
    payload?: CancelDiagnosticOrderRequest,
  ): Promise<{ data: DiagnosticOrderResponse }> {
    return apiClient(`/diagnostic-orders/${id}/cancel`, {
      method: 'PATCH',
      body: payload ?? {},
    });
  },

  async enterResult(
    orderId: string,
    payload: EnterResultRequest,
  ): Promise<{ data: DiagnosticResultResponse }> {
    return apiClient(`/diagnostic-orders/${orderId}/result`, {
      method: 'POST',
      body: payload,
    });
  },

  async getResult(orderId: string): Promise<{ data: DiagnosticResultResponse }> {
    return apiClient(`/diagnostic-orders/${orderId}/result`, { method: 'GET' });
  },

  async verifyResult(orderId: string): Promise<{ data: DiagnosticResultResponse }> {
    return apiClient(`/diagnostic-orders/${orderId}/result/verify`, {
      method: 'POST',
      body: {},
    });
  },

  async acknowledgeResult(orderId: string): Promise<{ data: DiagnosticResultResponse }> {
    return apiClient(`/diagnostic-orders/${orderId}/result/acknowledge`, {
      method: 'POST',
      body: {},
    });
  },
};
