import React from 'react';
import { Activity, Play, Shield } from 'lucide-react';
import { Button, Spinner } from '../../../components/ui';
import styles from '../intelligence.module.css';

export interface IntelligenceHeaderProps {
  isAnalyzing: boolean;
  aiStatus?: 'grounded' | 'degraded' | 'unavailable' | null;
  scope: 'department' | 'hospital_admin';
  canSelectAdminScope: boolean;
  onScopeChange: (scope: 'department' | 'hospital_admin') => void;
  onRunAnalysis: () => void;
  canTriggerAnalysis: boolean;
}

export function IntelligenceHeader({
  isAnalyzing,
  aiStatus,
  scope,
  canSelectAdminScope,
  onScopeChange,
  onRunAnalysis,
  canTriggerAnalysis,
}: IntelligenceHeaderProps) {
  const getAiDotClass = () => {
    switch (aiStatus) {
      case 'grounded':
        return styles.dotGrounded;
      case 'degraded':
        return styles.dotDegraded;
      case 'unavailable':
        return styles.dotUnavailable;
      default:
        return styles.dotGrounded;
    }
  };

  const getAiLabel = () => {
    switch (aiStatus) {
      case 'grounded':
        return 'AI Engine: Grounded';
      case 'degraded':
        return 'AI Engine: Degraded (Deterministic Mode)';
      case 'unavailable':
        return 'AI Engine: Offline (Deterministic Mode)';
      default:
        return 'AI Engine: Ready';
    }
  };

  return (
    <div className={styles.headerCard}>
      <div className={styles.headerTitles}>
        <div className={styles.titleRow}>
          <span className={styles.titleIcon} aria-hidden="true">
            <Activity size={20} />
          </span>
          <h1 className={styles.title}>
            <span>Hospital Intelligence Center</span>
            <span className={styles.versionTag}>TELEMETRY KERNEL</span>
          </h1>
        </div>
        <p className={styles.subtitle}>
          Deterministic operational bottleneck detection paired with citable audit evidence and human-authorized action governance.
        </p>
      </div>

      <div className={styles.headerControls}>
        <div className={styles.telemetryPills}>
          {/* Subsystem Health Indicator */}
          <span
            className={styles.telemetryPill}
            title="Operational AI Subsystem Status. Deterministic signals remain active regardless of AI status."
            aria-label={getAiLabel()}
          >
            <span className={`${styles.dot} ${getAiDotClass()}`} aria-hidden="true" />
            <span>{getAiLabel()}</span>
          </span>

          {/* SLA Rule Engine Status */}
          <span className={styles.telemetryPill} title="Deterministic Clinical SLA Engine">
            <span className={`${styles.dot} ${styles.dotGrounded}`} aria-hidden="true" />
            <span>SLA Engine: Online</span>
          </span>

          {/* Scope indicator or selector for admin */}
          {canSelectAdminScope ? (
            <select
              className={`${styles.telemetryPill} ${styles.telemetrySelect}`}
              value={scope}
              onChange={(e) => onScopeChange(e.target.value as 'department' | 'hospital_admin')}
              disabled={isAnalyzing}
              aria-label="Intelligence Analysis Scope"
            >
              <option value="department">Scope: Department</option>
              <option value="hospital_admin">Scope: Hospital-Wide (Admin)</option>
            </select>
          ) : (
            <span className={styles.telemetryPill}>
              <Shield size={12} aria-hidden="true" />
              <span>Scope: Assigned Department</span>
            </span>
          )}
        </div>

        {/* Primary Action Button */}
        <Button
          variant="primary"
          onClick={onRunAnalysis}
          disabled={isAnalyzing || !canTriggerAnalysis}
          className="gap-2 font-mono text-xs font-semibold"
          id="run-intelligence-analysis-button"
          title={!canTriggerAnalysis ? 'Requires intelligence:analyze permission' : undefined}
        >
          {isAnalyzing ? (
            <>
              <Spinner size="sm" />
              <span>Scanning Bottlenecks...</span>
            </>
          ) : (
            <>
              <Play size={14} aria-hidden="true" />
              <span>Run Intelligence Analysis</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
