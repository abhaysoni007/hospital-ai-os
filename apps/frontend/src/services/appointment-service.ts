import { apiClient } from './api-client';
import type {
  CreateAppointmentRequest,
  GetAppointmentsQuery,
  AppointmentResponse,
  AppointmentListItem,
  BookingOptionsResponse,
} from 'shared';
import type { PaginatedResponse } from './patient-service';

export const appointmentService = {
  async bookAppointment(payload: CreateAppointmentRequest): Promise<{ data: AppointmentResponse }> {
    return apiClient('/appointments', {
      method: 'POST',
      body: payload,
    });
  },

  async getAppointments(
    query?: GetAppointmentsQuery,
  ): Promise<PaginatedResponse<AppointmentListItem>> {
    const searchParams = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) searchParams.append(key, String(value));
      });
    }
    const queryString = searchParams.toString();
    return apiClient(queryString ? `/appointments?${queryString}` : '/appointments', {
      method: 'GET',
    });
  },

  async cancelAppointment(id: string, reason?: string): Promise<{ data: AppointmentResponse }> {
    return apiClient(`/appointments/${id}/cancel`, {
      method: 'PATCH',
      body: { reason },
    });
  },

  async checkInAppointment(id: string): Promise<{
    data: { appointment: AppointmentResponse; encounter: { id: string; status: string } };
  }> {
    return apiClient(`/appointments/${id}/check-in`, { method: 'PATCH' });
  },

  async getBookingOptions(): Promise<{ data: BookingOptionsResponse }> {
    return apiClient('/appointments/booking-options', { method: 'GET' });
  },
};
