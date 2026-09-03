import React from 'react';
import { AlertCircle, Clock, FileWarning, Layers } from 'lucide-react';
import { DetectedSignal } from 'shared';
import { SignalFilterCategory } from './intelligence.types';
import styles from '../intelligence.module.css';

export interface OperationalSummaryBarProps {
  signals: DetectedSignal[];
  activeFilter: SignalFilterCategory;
  onFilterChange: (category: SignalFilterCategory) => void;
}

export function OperationalSummaryBar({
  signals,
  activeFilter,
  onFilterChange,
}: OperationalSummaryBarProps) {
  const totalCount = signals.length;
  const criticalCount = signals.filter((s) => s.severity === 'CRITICAL').length;
  const diagnosticCount = signals.filter(
    (s) => s.signalType === 'PENDING_DIAGNOSTIC_RESULT',
  ).length;
  const documentationCount = signals.filter(
    (s) => s.signalType === 'ENCOUNTER_WITHOUT_CLINICAL_RECORD',
  ).length;

  const handleKeyDown = (category: SignalFilterCategory, e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFilterChange(activeFilter === category ? 'all' : category);
    }
  };

  return (
    <div className={styles.summaryGrid} role="region" aria-label="Operational Bottleneck Summary">
      {/* Total Bottlenecks */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onFilterChange('all')}
        onKeyDown={(e) => handleKeyDown('all', e)}
        className={`${styles.summaryCard} ${activeFilter === 'all' ? styles.summaryCardActive : ''}`}
        aria-pressed={activeFilter === 'all'}
      >
        <div className={styles.summaryLabel}>
          <span>Active Bottlenecks</span>
          <Layers size={14} className="text-muted-foreground" aria-hidden="true" />
        </div>
        <div className={styles.summaryValue} id="summary-total-count">
          {totalCount}
        </div>
        <div className={styles.summaryHint}>All detected operational signals</div>
      </div>

      {/* Critical SLA Alerts */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onFilterChange(activeFilter === 'critical' ? 'all' : 'critical')}
        onKeyDown={(e) => handleKeyDown('critical', e)}
        className={`${styles.summaryCard} ${activeFilter === 'critical' ? styles.summaryCardActive : ''}`}
        aria-pressed={activeFilter === 'critical'}
      >
        <div className={styles.summaryLabel}>
          <span className="text-rose-600 dark:text-rose-400">Critical SLA Alerts</span>
          <AlertCircle size={14} className="text-rose-600 dark:text-rose-400" aria-hidden="true" />
        </div>
        <div className={`${styles.summaryValue} text-rose-600 dark:text-rose-400`} id="summary-critical-count">
          {criticalCount}
        </div>
        <div className={styles.summaryHint}>STAT delay & unacknowledged panic alerts</div>
      </div>

      {/* Pending Diagnostics */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onFilterChange(activeFilter === 'diagnostic' ? 'all' : 'diagnostic')}
        onKeyDown={(e) => handleKeyDown('diagnostic', e)}
        className={`${styles.summaryCard} ${activeFilter === 'diagnostic' ? styles.summaryCardActive : ''}`}
        aria-pressed={activeFilter === 'diagnostic'}
      >
        <div className={styles.summaryLabel}>
          <span>Diagnostic Blockers</span>
          <Clock size={14} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
        </div>
        <div className={styles.summaryValue} id="summary-diagnostic-count">
          {diagnosticCount}
        </div>
        <div className={styles.summaryHint}>Orders exceeding turnaround thresholds</div>
      </div>

      {/* Documentation Gaps */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onFilterChange(activeFilter === 'documentation' ? 'all' : 'documentation')}
        onKeyDown={(e) => handleKeyDown('documentation', e)}
        className={`${styles.summaryCard} ${activeFilter === 'documentation' ? styles.summaryCardActive : ''}`}
        aria-pressed={activeFilter === 'documentation'}
      >
        <div className={styles.summaryLabel}>
          <span>Documentation Gaps</span>
          <FileWarning size={14} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
        </div>
        <div className={styles.summaryValue} id="summary-documentation-count">
          {documentationCount}
        </div>
        <div className={styles.summaryHint}>Active encounters without signed note</div>
      </div>
    </div>
  );
}
