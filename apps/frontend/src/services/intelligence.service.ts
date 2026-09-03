import { apiClient } from './api-client';
import {
  ClinicalTimelineResponse,
  ChartAnswerOutput,
  DiagnosticTrendResponse,
  TimelineMetadata,
  HospitalIntelligenceAnalysisResponse,
  DetectedSignal,
} from 'shared';

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

  analyzeOperations: async (
    scope: 'department' | 'hospital_admin' = 'department',
  ): Promise<HospitalIntelligenceAnalysisResponse> => {
    return apiClient<HospitalIntelligenceAnalysisResponse>(
      '/hospital-intelligence/analyze',
      { method: 'POST', body: { scope } },
    );
  },

  getHospitalSignals: async (): Promise<DetectedSignal[]> => {
    return apiClient<DetectedSignal[]>(
      '/hospital-intelligence/signals',
      { method: 'GET' },
    );
  },
};
