import { apiClient } from './api-client';
import {
  RegisterPatientRequest,
  UpdatePatientRequest,
  GetPatientsQuery,
  PatientResponse,
} from 'shared';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const patientService = {
  /**
   * Register a new patient
   */
  async registerPatient(payload: RegisterPatientRequest): Promise<{ data: PatientResponse }> {
    return apiClient('/patients', {
      method: 'POST',
      body: payload,
    });
  },

  /**
   * Update an existing patient (with optimistic concurrency check via expectedVersion)
   */
  async updatePatient(
    id: string,
    payload: UpdatePatientRequest,
  ): Promise<{ data: PatientResponse }> {
    return apiClient(`/patients/${id}`, {
      method: 'PATCH',
      body: payload,
    });
  },

  /**
   * Search and list patients
   */
  async getPatients(query?: GetPatientsQuery): Promise<PaginatedResponse<PatientResponse>> {
    const searchParams = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/patients?${queryString}` : '/patients';

    return apiClient(endpoint, {
      method: 'GET',
    });
  },

  /**
   * Get a patient by ID
   */
  async getPatientById(id: string): Promise<{ data: PatientResponse }> {
    return apiClient(`/patients/${id}`, {
      method: 'GET',
    });
  },
};

