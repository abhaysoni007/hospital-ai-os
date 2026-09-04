import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileWarning,
  Play,
  RotateCw,
} from 'lucide-react';
import { Button, Spinner } from '../../../components/ui';
import styles from '../intelligence.module.css';

export function IdleState({
  onRunAnalysis,
  canTriggerAnalysis,
}: {
  onRunAnalysis: () => void;
  canTriggerAnalysis: boolean;
}) {
  return (
    <div className={styles.stateCard}>
      <div className={styles.stateIcon}>
        <Activity size={24} aria-hidden="true" />
      </div>

      <h2 className={styles.stateTitle}>
        Operational Intelligence Engine Standing By
      </h2>
      <p className={styles.stateDesc}>
        Run an on-demand analysis to detect real operational bottlenecks across your hospital operations. The system queries active orders, panic alerts, and encounters against deterministic SLA thresholds.
      </p>

      {/* The 3 Hero Capabilities */}
      <div className={styles.heroGrid}>
        <div className={styles.heroCard}>
          <div className={styles.heroCardTitle}>
            <Clock size={16} color="#3b82f6" aria-hidden="true" />
            <span>Pending Diagnostic Results</span>
          </div>
          <p className={styles.heroCardDesc}>
            Detects STAT orders pending over 1–2 hours and routine tests exceeding SLA turnaround.
          </p>
        </div>

        <div className={styles.heroCard}>
          <div className={styles.heroCardTitle}>
            <AlertTriangle size={16} color="#f43f5e" aria-hidden="true" />
            <span>Critical Alerts Unacknowledged</span>
          </div>
          <p className={styles.heroCardDesc}>
            Flags panic lab values unacknowledged past the 30-minute patient safety threshold.
          </p>
        </div>

        <div className={styles.heroCard}>
          <div className={styles.heroCardTitle}>
            <FileWarning size={16} color="#f59e0b" aria-hidden="true" />
            <span>Active Encounters Without Notes</span>
          </div>
          <p className={styles.heroCardDesc}>
            Catches active inpatient encounters exceeding 2+ hours lacking signed clinical notes.
          </p>
        </div>
      </div>

      <div className={styles.stateActions}>
        <Button
          variant="primary"
          onClick={onRunAnalysis}
          disabled={!canTriggerAnalysis}
          id="idle-start-analysis-btn"
          style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}
        >
          <Play size={16} aria-hidden="true" fill="currentColor" />
          <span>Initiate Operational Bottleneck Scan</span>
        </Button>
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className={styles.stateCard}>
      <Spinner size="lg" style={{ margin: '0 auto 1.5rem auto' }} />
      <h2 className={styles.stateTitle}>
        Scanning Operational Bottlenecks
      </h2>
      <p className={styles.stateDesc}>
        Executing deterministic queries against active diagnostic orders, panic lab notifications, and clinical encounters...
      </p>

      <div style={{
        marginTop: '2rem',
        textAlign: 'left',
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-subtle)',
        padding: '1rem',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ color: 'var(--color-success-main)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>Connected to hospital operational database</span>
        </div>
        <div style={{ color: 'var(--color-primary-600)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Activity size={14} aria-hidden="true" />
          <span>Scanning diagnostic orders against SLA thresholds...</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Activity size={14} aria-hidden="true" />
          <span>Evaluating unacknowledged critical alert window (30m)...</span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Activity size={14} aria-hidden="true" />
          <span>Grounding AI explanations with authorized evidence...</span>
        </div>
      </div>
    </div>
  );
}

export function ZeroSignalsState({ onRecheck }: { onRecheck: () => void }) {
  return (
    <div className={styles.stateCard}>
      <div className={`${styles.stateIcon} ${styles.stateIconSuccess}`}>
        <CheckCircle2 size={24} aria-hidden="true" />
      </div>
      <h2 className={styles.stateTitle}>
        Zero Operational Bottlenecks Detected
      </h2>
      <p className={styles.stateDesc}>
        All active diagnostic orders, critical laboratory notifications, and inpatient encounters are currently progressing within established clinical SLA thresholds.
      </p>
      <div className={styles.stateActions}>
        <Button variant="secondary" onClick={onRecheck} style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
          <RotateCw size={14} aria-hidden="true" />
          <span>Re-evaluate Operations</span>
        </Button>
      </div>
    </div>
  );
}

export function ErrorBanner({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div style={{
      background: 'rgba(220, 38, 38, 0.1)',
      border: '1px solid rgba(220, 38, 38, 0.2)',
      borderRadius: '8px',
      padding: '1rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: '#b91c1c'
    }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <AlertTriangle size={20} aria-hidden="true" />
        <div>
          <strong style={{ display: 'block', fontSize: '0.875rem' }}>Analysis Request Failed</strong>
          <span style={{ fontSize: '0.75rem' }}>{error}</span>
        </div>
      </div>
      <Button variant="secondary" onClick={onRetry} style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
        <RotateCw size={14} aria-hidden="true" />
        <span>Retry Analysis</span>
      </Button>
    </div>
  );
}

