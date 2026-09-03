'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/rbac';
import { intelligenceService } from '../../services/intelligence.service';
import {
  DetectedSignal,
  HospitalIntelligenceAnalysisResponse,
  Recommendation,
  RecommendationStatus,
} from 'shared';
import { IntelligenceHeader } from './components/IntelligenceHeader';
import { OperationalSummaryBar } from './components/OperationalSummaryBar';
import { SignalStream } from './components/SignalStream';
import { SignalDetailPane } from './components/SignalDetailPane';
import { ApproveActionModal } from './components/ApproveActionModal';
import { RejectActionModal } from './components/RejectActionModal';
import {
  IdleState,
  LoadingState,
  ZeroSignalsState,
  ErrorBanner,
} from './components/IntelligenceStates';
import { SignalFilterCategory } from './components/intelligence.types';
import styles from './intelligence.module.css';

/**
 * M19.4 — Hospital Intelligence Center
 * Flagship operational console for bottleneck detection, evidence grounding,
 * and human-authorized action governance.
 *
 * Core architectural principle:
 * AI recommends. Policy validates. Human authorizes. Existing authorized services execute. Audit records everything.
 */
export default function IntelligenceCenterPage() {
  const { user } = useAuth();

  // Permissions
  const canTriggerAnalysis = hasPermission(user?.role, 'intelligence:analyze');
  const canApprove = hasPermission(user?.role, 'intelligence:approve');
  const canSelectAdminScope = user?.role === 'hospital_admin';

  // Analysis State
  const [scope, setScope] = useState<'department' | 'hospital_admin'>(
    canSelectAdminScope ? 'hospital_admin' : 'department',
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<HospitalIntelligenceAnalysisResponse | null>(null);

  // Filter & Selection State
  const [activeFilter, setActiveFilter] = useState<SignalFilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Local Action Lifecycle Overrides
  const [recommendationOverrides, setRecommendationOverrides] = useState<
    Record<string, { status: RecommendationStatus; rejectionReason?: string }>
  >({});

  // Action Modals State
  const [approveModal, setApproveModal] = useState<{
    isOpen: boolean;
    signal: DetectedSignal | null;
    rec: Recommendation | null;
  }>({ isOpen: false, signal: null, rec: null });

  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    signal: DetectedSignal | null;
    rec: Recommendation | null;
  }>({ isOpen: false, signal: null, rec: null });

  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Auto-select initial signal on successful analysis run
  useEffect(() => {
    if (analysis && analysis.signals.length > 0 && !selectedSignalId) {
      // Pick highest severity first (e.g. CRITICAL)
      const criticalSignal = analysis.signals.find((s) => s.severity === 'CRITICAL');
      const firstSignal = criticalSignal ?? analysis.signals[0];
      if (firstSignal) {
        setSelectedSignalId(firstSignal.signalId);
      }
    }
  }, [analysis, selectedSignalId]);

  // Selected signal object
  const selectedSignal = useMemo(() => {
    if (!analysis || !selectedSignalId) return null;
    return analysis.signals.find((s) => s.signalId === selectedSignalId) ?? null;
  }, [analysis, selectedSignalId]);

  // Handle Analysis Trigger
  const handleRunAnalysis = async () => {
    if (isAnalyzing || !canTriggerAnalysis) return;
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const res = await intelligenceService.analyzeOperations(scope);
      setAnalysis(res);
      // Auto-select first/critical signal
      if (res.signals.length > 0) {
        const topSignal = res.signals.find((s) => s.severity === 'CRITICAL') ?? res.signals[0];
        setSelectedSignalId(topSignal ? topSignal.signalId : null);
      } else {
        setSelectedSignalId(null);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to complete intelligence analysis. Please check your network or credentials.';
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Signal Selection
  const handleSelectSignal = (signalId: string) => {
    setSelectedSignalId(signalId);
    setMobileShowDetail(true);
  };

  // Open Approval Modal
  const handleOpenApprove = (signal: DetectedSignal, rec: Recommendation) => {
    setApproveModal({ isOpen: true, signal, rec });
  };

  // Open Rejection Modal
  const handleOpenReject = (signal: DetectedSignal, rec: Recommendation) => {
    setRejectModal({ isOpen: true, signal, rec });
  };

  // Confirm Approval
  const handleConfirmApprove = async (idempotencyKey: string) => {
    if (!approveModal.rec) return;
    const recId = approveModal.rec.recommendationId;
    setIsSubmittingAction(true);

    try {
      const res = await intelligenceService.approveRecommendation(recId, idempotencyKey);
      setRecommendationOverrides((prev) => ({
        ...prev,
        [recId]: { status: res.status },
      }));
      setApproveModal({ isOpen: false, signal: null, rec: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      alert(`Approval error: ${msg}`);
      setRecommendationOverrides((prev) => ({
        ...prev,
        [recId]: { status: 'execution_failed' },
      }));
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Confirm Rejection
  const handleConfirmReject = async (reason: string) => {
    if (!rejectModal.rec) return;
    const recId = rejectModal.rec.recommendationId;
    setIsSubmittingAction(true);

    try {
      const res = await intelligenceService.rejectRecommendation(recId, reason);
      setRecommendationOverrides((prev) => ({
        ...prev,
        [recId]: { status: res.status, rejectionReason: reason },
      }));
      setRejectModal({ isOpen: false, signal: null, rec: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rejection failed';
      alert(`Rejection error: ${msg}`);
    } finally {
      setIsSubmittingAction(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={['Operations', 'Intelligence']}
      requiredPermission="intelligence:read"
      variant="wide"
    >
      <div className={styles.container}>
        {/* Flagship Command Header */}
        <IntelligenceHeader
          isAnalyzing={isAnalyzing}
          aiStatus={analysis?.aiStatus ?? null}
          scope={scope}
          canSelectAdminScope={canSelectAdminScope}
          onScopeChange={setScope}
          onRunAnalysis={handleRunAnalysis}
          canTriggerAnalysis={canTriggerAnalysis}
        />

        {/* Operational Error Banner (if analysis failed) */}
        {analysisError && (
          <ErrorBanner error={analysisError} onRetry={handleRunAnalysis} />
        )}

        {/* Operational Summary Bar (Real Data Only) */}
        {analysis && analysis.signals.length > 0 && !isAnalyzing && (
          <OperationalSummaryBar
            signals={analysis.signals}
            activeFilter={activeFilter}
            onFilterChange={setActiveFilter}
          />
        )}

        {/* Dynamic State View */}
        {isAnalyzing && <LoadingState />}

        {!isAnalyzing && !analysis && (
          <IdleState
            onRunAnalysis={handleRunAnalysis}
            canTriggerAnalysis={canTriggerAnalysis}
          />
        )}

        {!isAnalyzing && analysis && analysis.signals.length === 0 && (
          <ZeroSignalsState onRecheck={handleRunAnalysis} />
        )}

        {!isAnalyzing && analysis && analysis.signals.length > 0 && (
          <div className={styles.consoleGrid}>
            {/* Master Column: Signal Stream (Hidden on small screens when viewing detail) */}
            <div className={mobileShowDetail ? 'hidden lg:block' : 'block'}>
              <SignalStream
                signals={analysis.signals}
                selectedSignalId={selectedSignalId}
                onSelectSignal={handleSelectSignal}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                recommendationOverrides={recommendationOverrides}
              />
            </div>

            {/* Detail Column: Deep Investigation & Governance Stage */}
            <div className={!mobileShowDetail ? 'hidden lg:block' : 'block'}>
              {selectedSignal ? (
                <SignalDetailPane
                  signal={selectedSignal}
                  onBackToStream={() => setMobileShowDetail(false)}
                  canApprove={canApprove}
                  recommendationOverride={
                    selectedSignal.recommendation
                      ? recommendationOverrides[selectedSignal.recommendation.recommendationId]
                      : undefined
                  }
                  onOpenApprove={handleOpenApprove}
                  onOpenReject={handleOpenReject}
                />
              ) : (
                <div className="p-12 text-center text-sm text-muted-foreground border border-border rounded-xl bg-card">
                  Select a detected bottleneck signal from the stream to investigate evidence and govern actions.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Human Authorization Modal */}
        {approveModal.signal && approveModal.rec && (
          <ApproveActionModal
            isOpen={approveModal.isOpen}
            signal={approveModal.signal}
            recommendation={approveModal.rec}
            actorRole={user?.role}
            isSubmitting={isSubmittingAction}
            onConfirm={handleConfirmApprove}
            onCancel={() => setApproveModal({ isOpen: false, signal: null, rec: null })}
          />
        )}

        {/* Human Rejection Modal */}
        {rejectModal.signal && rejectModal.rec && (
          <RejectActionModal
            isOpen={rejectModal.isOpen}
            signal={rejectModal.signal}
            recommendation={rejectModal.rec}
            isSubmitting={isSubmittingAction}
            onConfirm={handleConfirmReject}
            onCancel={() => setRejectModal({ isOpen: false, signal: null, rec: null })}
          />
        )}
      </div>
    </AppShell>
  );
}
