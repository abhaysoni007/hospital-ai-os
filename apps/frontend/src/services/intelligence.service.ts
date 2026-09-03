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
    limit?: number,
  ): Promise<HospitalIntelligenceAnalysisResponse> => {
    const res = await apiClient<{ data: HospitalIntelligenceAnalysisResponse } | HospitalIntelligenceAnalysisResponse>(
      '/hospital-intelligence/analyze',
      { method: 'POST', body: { scope, ...(limit ? { limit } : {}) } },
    );
    return res && typeof res === 'object' && 'data' in res
      ? (res as { data: HospitalIntelligenceAnalysisResponse }).data
      : (res as HospitalIntelligenceAnalysisResponse);
  },

  getHospitalSignals: async (scope?: 'department' | 'hospital_admin'): Promise<DetectedSignal[]> => {
    const qs = scope ? `?scope=${scope}` : '';
    const res = await apiClient<{ data: DetectedSignal[] } | DetectedSignal[]>(
      `/hospital-intelligence/signals${qs}`,
      { method: 'GET' },
    );
    return res && typeof res === 'object' && 'data' in res
      ? (res as { data: DetectedSignal[] }).data
      : (res as DetectedSignal[]);
  },

  getSignalById: async (signalId: string): Promise<DetectedSignal | null> => {
    const res = await apiClient<{ data: DetectedSignal } | DetectedSignal>(
      `/hospital-intelligence/signals/${signalId}`,
      { method: 'GET' },
    );
    return res && typeof res === 'object' && 'data' in res
      ? (res as { data: DetectedSignal }).data
      : (res as DetectedSignal);
  },

  approveRecommendation: async (
    recommendationId: string,
    idempotencyKey: string,
  ): Promise<{ status: 'approved' | 'executed'; recommendationId: string }> => {
    const res = await apiClient<{ data: { status: 'approved' | 'executed'; recommendationId: string } } | { status: 'approved' | 'executed'; recommendationId: string }>(
      `/hospital-intelligence/recommendations/${recommendationId}/approve`,
      { method: 'POST', body: { idempotencyKey } },
    );
    return res && typeof res === 'object' && 'data' in res
      ? (res as { data: { status: 'approved' | 'executed'; recommendationId: string } }).data
      : (res as { status: 'approved' | 'executed'; recommendationId: string });
  },

  rejectRecommendation: async (
    recommendationId: string,
    rejectionReason?: string,
  ): Promise<{ status: 'rejected'; recommendationId: string }> => {
    const res = await apiClient<{ data: { status: 'rejected'; recommendationId: string } } | { status: 'rejected'; recommendationId: string }>(
      `/hospital-intelligence/recommendations/${recommendationId}/reject`,
      { method: 'POST', body: { rejectionReason } },
    );
    return res && typeof res === 'object' && 'data' in res
      ? (res as { data: { status: 'rejected'; recommendationId: string } }).data
      : (res as { status: 'rejected'; recommendationId: string });
  },
};

