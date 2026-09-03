'use client';

import React, { useState } from 'react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import {
  Button,
  Card,
  Badge,
  Spinner,
  EmptyState,
  AlertBanner,
} from '../../components/ui';
import { Activity, AlertTriangle, CheckCircle2, Play, FileText } from 'lucide-react';
import { intelligenceService } from '../../services/intelligence.service';
import {
  DetectedSignal,
  HospitalIntelligenceAnalysisResponse,
  SignalSeverity,
} from 'shared';

/**
 * M19.2 — Minimal Functional Verification Surface for Hospital Intelligence.
 * Allows clinicians/administrators to run bottleneck analysis, inspect deterministically
 * detected signals, review grounded evidence, and inspect bounded AI recommendations.
 * Full operational analytics dashboard arrives in M19.4.
 */
export default function IntelligencePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<HospitalIntelligenceAnalysisResponse | null>(null);

  const handleRunAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await intelligenceService.analyzeOperations('department');
      setAnalysis(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis request failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityVariant = (severity: SignalSeverity): 'critical' | 'urgent' | 'pending' | 'info' => {
    switch (severity) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'urgent';
      case 'MEDIUM':
        return 'pending';
      case 'LOW':
      default:
        return 'info';
    }
  };

  return (
    <AppShell
      breadcrumbs={['Operations', 'Intelligence']}
      requiredPermission="intelligence:read"
    >
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header and Trigger Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-card border border-border rounded-xl shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Hospital Bottleneck Intelligence</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Deterministic operational bottleneck detection paired with bounded, grounded AI explanation.
            </p>
          </div>
          <div>
            <Button
              variant="primary"
              onClick={handleRunAnalysis}
              disabled={loading}
              className="gap-2"
              id="run-analysis-button"
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  <span>Analyzing Hospital State...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>Run Intelligence Analysis</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <AlertBanner severity="critical" title="Analysis Failed">
            {error}
          </AlertBanner>
        )}

        {/* Results view */}
        {loading && (
          <Card className="p-12 text-center flex flex-col items-center justify-center space-y-4">
            <Spinner size="lg" />
            <p className="text-sm font-medium text-muted-foreground">
              Executing deterministic detection queries across active orders, alerts, and encounters...
            </p>
          </Card>
        )}

        {!loading && !analysis && (
          <EmptyState
            icon={<Activity size={36} className="text-muted-foreground" />}
            title="No Active Intelligence Run"
            description="Click 'Run Intelligence Analysis' above to detect real operational bottlenecks across your department."
          />
        )}

        {!loading && analysis && analysis.signals.length === 0 && (
          <Card className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="text-lg font-semibold">No Workflow Bottlenecks Detected</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              All active diagnostic orders, laboratory alerts, and clinical encounters are progressing within defined operational SLA thresholds.
            </p>
          </Card>
        )}

        {!loading && analysis && analysis.signals.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
              <span>
                Found <strong className="text-foreground">{analysis.signals.length}</strong> operational bottleneck(s)
              </span>
              <span>
                AI Subsystem Status:{' '}
                <strong
                  className={
                    analysis.aiStatus === 'grounded'
                      ? 'text-emerald-500'
                      : analysis.aiStatus === 'degraded'
                        ? 'text-amber-500'
                        : 'text-rose-500'
                  }
                >
                  {analysis.aiStatus.toUpperCase()}
                </strong>
              </span>
            </div>

            {analysis.signals.map((signal: DetectedSignal) => (
              <Card key={signal.signalId} className="p-6 space-y-4 border-l-4 border-l-primary">
                {/* Signal Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityVariant(signal.severity)}>
                      {signal.severity}
                    </Badge>
                    <h2 className="text-base font-semibold">{signal.title}</h2>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    Type: {signal.signalType}
                  </span>
                </div>

                {/* Deterministic Reason */}
                <div className="text-sm">
                  <span className="font-medium text-foreground">Deterministic Detection Reason: </span>
                  <span className="text-muted-foreground font-mono text-xs">{signal.deterministicReason}</span>
                </div>

                {/* Grounded Evidence List */}
                <div className="space-y-2 bg-muted/40 p-3 rounded-lg border border-border">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Grounded Evidence Records ({signal.evidenceRefs.length})
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {signal.evidenceRefs.map((ref) => (
                      <li key={ref.evidenceId} className="flex items-start gap-2">
                        <span className="font-semibold text-foreground shrink-0">
                          [{ref.sourceType}]
                        </span>
                        <span className="text-muted-foreground">{ref.relationToSignal}</span>
                        <span
                          className={`ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded ${
                            ref.evidenceStatus === 'present'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-amber-500/10 text-amber-500'
                          }`}
                        >
                          {ref.evidenceStatus}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* AI Explanation Section */}
                {signal.aiExplanation ? (
                  <div className="space-y-3 bg-primary/5 p-4 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                      <Activity className="h-4 w-4" />
                      <span>Bounded AI Operational Explanation</span>
                    </div>
                    <p className="text-sm text-foreground">{signal.aiExplanation.summary}</p>
                    {signal.aiExplanation.clinicalImpact && (
                      <div className="text-xs text-muted-foreground">
                        <strong className="text-foreground">Operational Impact: </strong>
                        {signal.aiExplanation.clinicalImpact}
                      </div>
                    )}
                    {signal.aiExplanation.disclaimers.length > 0 && (
                      <div className="text-[11px] text-muted-foreground italic border-t border-primary/10 pt-2">
                        Note: {signal.aiExplanation.disclaimers.join(' ')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <span>AI explanation unavailable or degraded. Deterministic signal remains fully valid.</span>
                  </div>
                )}

                {/* Proposed Recommendation (Non-executable in M19.2) */}
                {signal.recommendation && (
                  <div className="p-4 bg-muted/60 border border-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Proposed Action:
                        </span>
                        <span className="text-xs font-bold text-foreground">
                          {signal.recommendation.actionType}
                        </span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-mono">
                          STATUS: {signal.recommendation.policyStatus.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {signal.recommendation.rationale}
                      </p>
                      <p className="text-[10px] text-muted-foreground italic">
                        * Human authorization required before execution. Action execution enabled in M19.3.
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Button variant="secondary" size="sm" disabled>
                        Awaiting Approval (M19.3)
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
