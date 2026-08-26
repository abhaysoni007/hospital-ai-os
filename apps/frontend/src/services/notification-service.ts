import { apiClient } from './api-client';
import type {
  NotificationItem,
  NotificationListResponse,
  NotificationStatus,
  NotificationPriority,
} from 'shared';

/**
 * M12.2 — Critical notification client (minimum operational loop).
 * Scope is server-derived from the JWT; no recipient filters exist here.
 */

export interface GetNotificationsParams {
  page?: number;
  pageSize?: number;
  status?: NotificationStatus;
  priority?: NotificationPriority;
}

export const notificationService = {
  async list(params: GetNotificationsParams = {}): Promise<NotificationListResponse> {
    const search = new URLSearchParams();
    if (params.page !== undefined) search.set('page', String(params.page));
    if (params.pageSize !== undefined) search.set('pageSize', String(params.pageSize));
    if (params.status) search.set('status', params.status);
    if (params.priority) search.set('priority', params.priority);
    const qs = search.toString();
    return apiClient<NotificationListResponse>(`/notifications${qs ? `?${qs}` : ''}`, {
      method: 'GET',
    });
  },

  async acknowledge(id: string): Promise<{ data: NotificationItem }> {
    return apiClient(`/notifications/${id}/acknowledge`, { method: 'PATCH' });
  },
};
