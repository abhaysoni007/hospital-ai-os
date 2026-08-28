import { apiClient } from './api-client';
import { ClinicalTimelineResponse, ChartAnswerOutput, DiagnosticTrendResponse, TimelineMetadata } from 'shared';

export interface ChartBriefResponse {
  metadata: TimelineMetadata;
  brief: ChartAnswerOutput;
  interactionId: string;
}

export const intelligenceService = {
  getTimeline: async (patientId: string, limit: number = 50): Promise<ClinicalTimelineResponse> => {
    const response = await apiClient.get<ClinicalTimelineResponse>(
      `/api/v1/intelligence/timeline/${patientId}?limit=${limit}`
    );
    return response.data;
  },

  generateChartBrief: async (patientId: string, question?: string): Promise<ChartBriefResponse> => {
    const response = await apiClient.post<ChartBriefResponse>(
      `/api/v1/intelligence/chart-brief/${patientId}`,
      { question }
    );
    return response.data;
  },

  getDiagnosticTrend: async (patientId: string, testCode: string): Promise<DiagnosticTrendResponse> => {
    const response = await apiClient.get<DiagnosticTrendResponse>(
      `/api/v1/intelligence/diagnostic-trend/${patientId}/${testCode}`
    );
    return response.data;
  },
};
