import { apiClient } from './api-client';
import { ClinicalTimelineResponse, ChartAnswerOutput, DiagnosticTrendResponse, TimelineMetadata } from 'shared';

export interface ChartBriefResponse {
  metadata: TimelineMetadata;
  brief: ChartAnswerOutput;
  interactionId: string;
}

export const intelligenceService = {
  getTimeline: async (patientId: string, limit: number = 50): Promise<ClinicalTimelineResponse> => {
    return apiClient<ClinicalTimelineResponse>(
      `/intelligence/timeline/${patientId}?limit=${limit}`,
      { method: 'GET' }
    );
  },

  generateChartBrief: async (patientId: string, question?: string): Promise<ChartBriefResponse> => {
    return apiClient<ChartBriefResponse>(
      `/intelligence/chart-brief/${patientId}`,
      { method: 'POST', body: { question } }
    );
  },

  getDiagnosticTrend: async (patientId: string, testCode: string): Promise<DiagnosticTrendResponse> => {
    return apiClient<DiagnosticTrendResponse>(
      `/intelligence/diagnostic-trend/${patientId}/${testCode}`,
      { method: 'GET' }
    );
  },
};
