import React, { useMemo } from 'react';
import { Search, Database } from 'lucide-react';
import { DetectedSignal, RecommendationStatus, SignalSeverity } from 'shared';
import { Badge } from '../../../components/ui';
import { SignalFilterCategory } from './intelligence.types';
import styles from '../intelligence.module.css';

export interface SignalStreamProps {
  signals: DetectedSignal[];
  selectedSignalId: string | null;
  onSelectSignal: (id: string) => void;
  activeFilter: SignalFilterCategory;
  onFilterChange: (category: SignalFilterCategory) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  recommendationOverrides: Record<string, { status: RecommendationStatus }>;
}

export function SignalStream({
  signals,
  selectedSignalId,
  onSelectSignal,
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  recommendationOverrides,
}: SignalStreamProps) {
  // Filter logic
  const filteredSignals = useMemo(() => {
    return signals.filter((signal) => {
      // 1. Category Filter
      if (activeFilter === 'critical' && signal.severity !== 'CRITICAL') return false;
      if (
        activeFilter === 'diagnostic' &&
        signal.signalType !== 'PENDING_DIAGNOSTIC_RESULT'
      )
        return false;
      if (
        activeFilter === 'documentation' &&
        signal.signalType !== 'ENCOUNTER_WITHOUT_CLINICAL_RECORD'
      )
        return false;
      if (activeFilter === 'actionable') {
        const effectiveStatus = signal.recommendation
          ? recommendationOverrides[signal.recommendation.recommendationId]?.status ??
            signal.recommendation.executableStatus
          : null;
        if (effectiveStatus !== 'proposed') return false;
      }

      // 2. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = signal.title.toLowerCase().includes(query);
        const matchesReason = signal.deterministicReason.toLowerCase().includes(query);
        const matchesPatient = signal.patientId?.toLowerCase().includes(query);
        const matchesEncounter = signal.encounterId?.toLowerCase().includes(query);
        const matchesEvidence = signal.evidenceRefs.some((ref) =>
          ref.sourceRecordId.toLowerCase().includes(query),
        );
        if (
          !matchesTitle &&
          !matchesReason &&
          !matchesPatient &&
          !matchesEncounter &&
          !matchesEvidence
        ) {
          return false;
        }
      }

      return true;
    });
  }, [signals, activeFilter, searchQuery, recommendationOverrides]);

  const getSeverityBadgeVariant = (
    severity: SignalSeverity,
  ): 'critical' | 'urgent' | 'pending' | 'neutral' => {
    switch (severity) {
      case 'CRITICAL':
        return 'critical';
      case 'HIGH':
        return 'urgent';
      case 'MEDIUM':
        return 'pending';
      case 'LOW':
      default:
        return 'neutral';
    }
  };

  const getSeverityBorderClass = (severity: SignalSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return styles.cardSeverityCritical;
      case 'HIGH':
        return styles.cardSeverityHigh;
      case 'MEDIUM':
        return styles.cardSeverityMedium;
      case 'LOW':
      default:
        return styles.cardSeverityLow;
    }
  };

  const getStatusChipClass = (status: RecommendationStatus) => {
    switch (status) {
      case 'proposed':
        return styles.statusProposed;
      case 'approved':
        return styles.statusApproved;
      case 'executed':
        return styles.statusExecuted;
      case 'rejected':
      case 'policy_rejected':
        return styles.statusRejected;
      case 'execution_failed':
        return styles.statusFailed;
      default:
        return styles.statusProposed;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.max(1, Math.floor(diffMs / 60000));
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    } catch {
      return 'recent';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, signalId: string, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectSignal(signalId);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = Math.min(index + 1, filteredSignals.length - 1);
      const nextSignal = filteredSignals[nextIndex];
      if (nextSignal) onSelectSignal(nextSignal.signalId);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = Math.max(index - 1, 0);
      const prevSignal = filteredSignals[prevIndex];
      if (prevSignal) onSelectSignal(prevSignal.signalId);
    }
  };

  return (
    <div className={styles.streamPanel} role="region" aria-label="Detected Signals Stream">
      {/* Filter & Search Header */}
      <div className={styles.filterHeader}>
        <div className={styles.searchInputWrap}>
          <Search size={14} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by title, reason, or record ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Filter detected signals"
          />
        </div>

        <div className={styles.categoryPills} role="tablist" aria-label="Signal Categories">
          {(
            [
              { id: 'all', label: `All (${signals.length})` },
              {
                id: 'critical',
                label: `Critical (${signals.filter((s) => s.severity === 'CRITICAL').length})`,
              },
              {
                id: 'diagnostic',
                label: `Diagnostic (${signals.filter((s) => s.signalType === 'PENDING_DIAGNOSTIC_RESULT').length})`,
              },
              {
                id: 'documentation',
                label: `Documentation (${signals.filter((s) => s.signalType === 'ENCOUNTER_WITHOUT_CLINICAL_RECORD').length})`,
              },
              {
                id: 'actionable',
                label: `Actionable (${signals.filter((s) => s.recommendation?.executableStatus === 'proposed').length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeFilter === tab.id}
              className={`${styles.categoryPill} ${
                activeFilter === tab.id ? styles.categoryPillActive : ''
              }`}
              onClick={() => onFilterChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Signals List */}
      <div className={styles.streamList} role="list" aria-label="Signals List">
        {filteredSignals.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No bottleneck signals match the current filter or search criteria.
          </div>
        ) : (
          filteredSignals.map((signal, index) => {
            const isSelected = signal.signalId === selectedSignalId;
            const effectiveStatus: RecommendationStatus = signal.recommendation
              ? recommendationOverrides[signal.recommendation.recommendationId]?.status ??
                signal.recommendation.executableStatus
              : 'unavailable';

            return (
              <div
                key={signal.signalId}
                role="listitem"
                tabIndex={0}
                aria-selected={isSelected}
                onClick={() => onSelectSignal(signal.signalId)}
                onKeyDown={(e) => handleKeyDown(e, signal.signalId, index)}
                className={`${styles.signalCard} ${getSeverityBorderClass(signal.severity)} ${
                  isSelected ? styles.signalCardSelected : ''
                }`}
                id={`signal-card-${signal.signalId}`}
              >
                <div className={styles.signalCardTop}>
                  <Badge variant={getSeverityBadgeVariant(signal.severity)}>
                    {signal.severity}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatRelativeTime(signal.detectedAt)}
                  </span>
                </div>

                <h3 className={styles.signalCardTitle}>{signal.title}</h3>
                <p className={styles.signalCardReason}>{signal.deterministicReason}</p>

                <div className={styles.signalCardFooter}>
                  <div className={styles.signalCardPills}>
                    <span
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded"
                      title={`${signal.evidenceRefs.length} real evidence records cited`}
                    >
                      <Database size={11} aria-hidden="true" />
                      <span>{signal.evidenceRefs.length} cited</span>
                    </span>

                    {signal.recommendation && (
                      <span
                        className={`${styles.statusChip} ${getStatusChipClass(effectiveStatus)}`}
                      >
                        {effectiveStatus}
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-muted-foreground font-mono">
                    {signal.signalType === 'PENDING_DIAGNOSTIC_RESULT'
                      ? 'DIAGNOSTIC'
                      : signal.signalType === 'CRITICAL_RESULT_UNACKNOWLEDGED'
                        ? 'CRITICAL_ALERT'
                        : 'DOC_GAP'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
