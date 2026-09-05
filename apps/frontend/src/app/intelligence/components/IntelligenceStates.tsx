import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileWarning,
  Play,
  RotateCw,
  Cpu,
  Database,
  Radio,
  Shield,
  Layers,
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
      {/* Tactical Telemetry Ribbon */}
      <div className={styles.deckTelemetryRibbon}>
        <div className={styles.ribbonItem}>
          <span className={`${styles.dot} ${styles.dotGrounded}`} aria-hidden="true" />
          <span>SENSORS: EHR • LIS • PACS ONLINE</span>
        </div>
        <div className={styles.ribbonItem}>
          <Layers size={13} className="text-sky-500" aria-hidden="true" />
          <span>SLA ENGINE: 3 ACTIVE DETERMINISTIC SENTINELS</span>
        </div>
        <div className={styles.ribbonItem}>
          <Shield size={13} className="text-emerald-500" aria-hidden="true" />
          <span>AUDIT CHAIN: SHA-256 GROUNDED</span>
        </div>
      </div>

      <div className={styles.deckBody}>
        <div className={styles.stateIcon}>
          <Cpu size={28} aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h2 className={styles.stateTitle}>
            Operational Intelligence Engine Standing By
          </h2>
          <p className={styles.stateDesc}>
            Run an on-demand analysis to detect real operational bottlenecks across your hospital operations. The system queries active orders, panic alerts, and encounters against deterministic SLA thresholds.
          </p>
        </div>

        {/* 4-Stage Operational Architecture Visualizer */}
        <div className={styles.pipelineVisual} aria-label="System Architecture Flow">
          <div className={styles.pipelineStage}>
            <span className={styles.pipelineStageNum}>Stage 01</span>
            <span className={styles.pipelineStageName}>Live Hospital Ingestion</span>
            <span className={styles.pipelineStageDesc}>Direct DB queries on active orders, labs & encounters</span>
          </div>
          <div className={styles.pipelineStage}>
            <span className={styles.pipelineStageNum}>Stage 02</span>
            <span className={styles.pipelineStageName}>Deterministic SLA Rules</span>
            <span className={styles.pipelineStageDesc}>Zero hallucination: pure mathematical criteria</span>
          </div>
          <div className={styles.pipelineStage}>
            <span className={styles.pipelineStageNum}>Stage 03</span>
            <span className={styles.pipelineStageName}>Bounded AI Briefing</span>
            <span className={styles.pipelineStageDesc}>Synthesized clinical context with strict disclaimers</span>
          </div>
          <div className={styles.pipelineStage}>
            <span className={styles.pipelineStageNum}>Stage 04</span>
            <span className={styles.pipelineStageName}>Governed Human Gate</span>
            <span className={styles.pipelineStageDesc}>Idempotent clinician authorization required</span>
          </div>
        </div>

        {/* The 3 Hero Capabilities (Strictly preserving test strings) */}
        <div className={styles.heroGrid}>
          {/* Hero 1: Pending Diagnostic Results */}
          <div className={`${styles.heroCard} ${styles.heroCardBlue}`}>
            <div className={styles.heroCardHeader}>
              <div className={styles.heroCardTitle}>
                <Clock size={16} className="text-sky-600 dark:text-sky-400" aria-hidden="true" />
                <span>Pending Diagnostic Results</span>
              </div>
              <span className={`${styles.heroThresholdBadge} bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30`}>
                STAT SLA
              </span>
            </div>
            <p className={styles.heroCardDesc}>
              Detects STAT orders pending over 1–2 hours and routine tests exceeding SLA turnaround.
            </p>
            <div className={styles.heroCardFooter}>
              <span>SOURCE: diagnostic_orders</span>
              <span className="text-sky-600 dark:text-sky-400">● ARMED</span>
            </div>
          </div>

          {/* Hero 2: Critical Alerts Unacknowledged */}
          <div className={`${styles.heroCard} ${styles.heroCardRose}`}>
            <div className={styles.heroCardHeader}>
              <div className={styles.heroCardTitle}>
                <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" aria-hidden="true" />
                <span>Critical Alerts Unacknowledged</span>
              </div>
              <span className={`${styles.heroThresholdBadge} bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30`}>
                SAFETY SLA
              </span>
            </div>
            <p className={styles.heroCardDesc}>
              Flags panic lab values unacknowledged past the 30-minute patient safety threshold.
            </p>
            <div className={styles.heroCardFooter}>
              <span>SOURCE: lab_results (Panic)</span>
              <span className="text-rose-600 dark:text-rose-400">● ESCALATION</span>
            </div>
          </div>

          {/* Hero 3: Active Encounters Without Notes */}
          <div className={`${styles.heroCard} ${styles.heroCardAmber}`}>
            <div className={styles.heroCardHeader}>
              <div className={styles.heroCardTitle}>
                <FileWarning size={16} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
                <span>Active Encounters Without Notes</span>
              </div>
              <span className={`${styles.heroThresholdBadge} bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30`}>
                DOC SLA
              </span>
            </div>
            <p className={styles.heroCardDesc}>
              Catches active inpatient encounters exceeding 2+ hours lacking signed clinical notes.
            </p>
            <div className={styles.heroCardFooter}>
              <span>SOURCE: encounters & notes</span>
              <span className="text-amber-600 dark:text-amber-400">● AUDITING</span>
            </div>
          </div>
        </div>

        {/* Primary Command Trigger */}
        <div className={styles.stateActions}>
          <Button
            variant="primary"
            onClick={onRunAnalysis}
            disabled={!canTriggerAnalysis}
            id="idle-start-analysis-btn"
            className="gap-2.5 font-mono text-sm font-semibold px-8 py-3.5 shadow-lg shadow-sky-500/20"
          >
            <Play size={16} aria-hidden="true" fill="currentColor" />
            <span>Initiate Operational Bottleneck Scan</span>
          </Button>
          <span className={styles.stateActionHint}>
            Deterministic query against active clinical data • Zero fabricated metrics
          </span>
        </div>
      </div>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className={styles.stateCard}>
      <div className={styles.deckTelemetryRibbon}>
        <div className={styles.ribbonItem}>
          <span className={`${styles.dot} ${styles.dotGrounded}`} aria-hidden="true" />
          <span>REAL-TIME SCAN IN PROGRESS</span>
        </div>
        <div className={styles.ribbonItem}>
          <span>TARGET SCOPE: ACTIVE DEPARTMENT</span>
        </div>
      </div>

      <div className={styles.deckBody}>
        <div className="flex justify-center mb-2">
          <div className="relative">
            <Spinner size="lg" />
            <Radio size={16} className="absolute inset-0 m-auto text-sky-500 animate-ping" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className={styles.stateTitle}>
            Scanning Operational Bottlenecks
          </h2>
          <p className={styles.stateDesc}>
            Executing deterministic queries against active diagnostic orders, panic lab notifications, and clinical encounters...
          </p>
        </div>

        <div className={styles.scanningProgressWrap}>
          <div className={styles.scanningProgressBar} />
        </div>

        <div className={styles.scanningLogContainer}>
          <div className={`${styles.scanningLogItem} text-emerald-600 dark:text-emerald-400`}>
            <CheckCircle2 size={14} aria-hidden="true" />
            <span>Connected to hospital operational database</span>
          </div>
          <div className={`${styles.scanningLogItem} text-sky-600 dark:text-sky-400 font-semibold`}>
            <Activity size={14} className="animate-pulse" aria-hidden="true" />
            <span>Scanning diagnostic orders against SLA thresholds...</span>
          </div>
          <div className={styles.scanningLogItem}>
            <Database size={14} aria-hidden="true" />
            <span>Evaluating unacknowledged critical alert window (30m)...</span>
          </div>
          <div className={styles.scanningLogItem}>
            <Cpu size={14} aria-hidden="true" />
            <span>Grounding AI explanations with authorized evidence...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ZeroSignalsState({ onRecheck }: { onRecheck: () => void }) {
  return (
    <div className={styles.stateCard}>
      <div className={styles.deckTelemetryRibbon}>
        <div className={styles.ribbonItem}>
          <span className={`${styles.dot} ${styles.dotGrounded}`} aria-hidden="true" />
          <span>SLA ENGINE: ALL PASSING</span>
        </div>
      </div>

      <div className={styles.deckBody}>
        <div className={`${styles.stateIcon} ${styles.stateIconSuccess}`}>
          <CheckCircle2 size={30} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className={styles.stateTitle}>
            Zero Operational Bottlenecks Detected
          </h2>
          <p className={styles.stateDesc}>
            All active diagnostic orders, critical laboratory notifications, and inpatient encounters are currently progressing within established clinical SLA thresholds.
          </p>
        </div>
        <div className={styles.stateActions}>
          <Button
            variant="secondary"
            onClick={onRecheck}
            className="gap-2 font-mono text-xs px-6 py-2.5"
          >
            <RotateCw size={14} aria-hidden="true" />
            <span>Re-evaluate Operations</span>
          </Button>
        </div>
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
    <div className={styles.errorBannerCard}>
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} className="shrink-0" aria-hidden="true" />
        <div>
          <strong className="block text-sm font-semibold">Analysis Request Failed</strong>
          <span className="text-xs opacity-90">{error}</span>
        </div>
      </div>
      <Button
        variant="secondary"
        onClick={onRetry}
        size="sm"
        className="gap-1.5 font-mono text-xs"
      >
        <RotateCw size={13} aria-hidden="true" />
        <span>Retry Analysis</span>
      </Button>
    </div>
  );
}

