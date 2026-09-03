import {
  HospitalIntelligenceAnalysisResponse,
  RecommendationStatus,
} from 'shared';

export type SignalFilterCategory = 'all' | 'critical' | 'diagnostic' | 'documentation' | 'actionable';

export interface SignalFilterState {
  category: SignalFilterCategory;
  searchQuery: string;
}

export interface IntelligenceState {
  analysis: HospitalIntelligenceAnalysisResponse | null;
  selectedSignalId: string | null;
  isAnalyzing: boolean;
  error: string | null;
  activeFilter: SignalFilterCategory;
  searchQuery: string;
  // Track action lifecycle state locally once mutated
  recommendationOverrides: Record<
    string,
    {
      status: RecommendationStatus;
      rejectionReason?: string;
      approvedAt?: string;
    }
  >;
}
