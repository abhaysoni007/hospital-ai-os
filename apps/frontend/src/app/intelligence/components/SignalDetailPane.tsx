import React from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Database,
  Activity,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Lock,
  FileCheck,
} from 'lucide-react';
import {
  DetectedSignal,
  EvidenceRef,
  Recommendation,
  RecommendationStatus,
  SignalSeverity,
} from 'shared';
import { Badge, Button } from '../../../components/ui';
import styles from '../intelligence.module.css';

export interface SignalDetailPaneProps {
  signal: DetectedSignal;
  onBackToStream?: () => void;
  canApprove: boolean;
  recommendationOverride?: {
    status: RecommendationStatus;
    rejectionReason?: string;
  };
  onOpenApprove: (signal: DetectedSignal, rec: Recommendation) => void;
  onOpenReject: (signal: DetectedSignal, rec: Recommendation) => void;
}

export function SignalDetailPane({
  signal,
  onBackToStream,
  canApprove,
  recommendationOverride,
  onOpenApprove,
  onOpenReject,
}: SignalDetailPaneProps) {
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

  const rec = signal.recommendation;
  const currentStatus: RecommendationStatus = rec
    ? recommendationOverride?.status ?? rec.executableStatus
    : 'unavailable';

  // Find diagnostic order or patient link from evidence
  const diagnosticOrderEvidence = signal.evidenceRefs.find(
    (e) => e.sourceType === 'DIAGNOSTIC_ORDER' && e.evidenceStatus === 'present',
  );

  return (
    <div className={styles.detailStage} role="region" aria-label="Signal Investigation Detail">
      {/* Header */}
      <div className={styles.detailStageHeader}>
        {onBackToStream && (
          <div className={styles.mobileBackBar}>
            <Button
              variant="secondary"
              size="sm"
              onClick={onBackToStream}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              <span>Back to Bottlenecks</span>
            </Button>
          </div>
        )}

        <div className={styles.detailTitleRow}>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getSeverityBadgeVariant(signal.severity)}>
              {signal.severity} PRIORITY
            </Badge>
            <h2 className={styles.detailTitle}>{signal.title}</h2>
          </div>
          <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            SIGNAL: {signal.signalType}
          </span>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.metaItem}>
            <span className="text-muted-foreground">Detected:</span>
            <strong className="font-mono text-xs">
              {new Date(signal.detectedAt).toLocaleString()}
            </strong>
          </span>

          {signal.encounterId && (
            <span className={styles.metaItem}>
              <span className="text-muted-foreground">Encounter:</span>
              <strong className="font-mono text-xs truncate max-w-[150px]">
                {signal.encounterId}
              </strong>
            </span>
          )}

          {signal.patientId && (
            <span className={styles.metaItem}>
              <span className="text-muted-foreground">Patient ID:</span>
              <strong className="font-mono text-xs truncate max-w-[150px]">
                {signal.patientId}
              </strong>
            </span>
          )}

          <span className={styles.metaItem}>
            <span className="text-muted-foreground">Correlation:</span>
            <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]">
              {signal.correlationId}
            </span>
          </span>
        </div>
      </div>

      <div className={styles.detailBody}>
        {/* Stage 1: Deterministic System Finding */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>
              <ShieldAlert size={15} className="text-primary" aria-hidden="true" />
              <span>1. Deterministic Rule Engine (Ground Truth)</span>
            </span>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              VERIFIED NON-HALLUCINATORY
            </span>
          </div>
          <div className={styles.sectionContent}>
            <p className="text-xs text-muted-foreground m-0">
              The operational detection query triggered with the following deterministic criteria:
            </p>
            <div className={styles.deterministicHighlight}>
              {signal.deterministicReason}
            </div>
            <p className="text-xs text-muted-foreground m-0">
              Description: {signal.description}
            </p>
          </div>
        </div>

        {/* Stage 2: Grounded Clinical Evidence */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>
              <Database size={15} className="text-primary" aria-hidden="true" />
              <span>2. Supporting Audit Evidence ({signal.evidenceRefs.length} Records)</span>
            </span>
            <span className="text-[11px] text-muted-foreground">
              Direct DB references cited in detection
            </span>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className={styles.evidenceTable}>
              <thead>
                <tr>
                  <th scope="col">Source Type</th>
                  <th scope="col">Record ID</th>
                  <th scope="col">Status</th>
                  <th scope="col">Relationship to Signal</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {signal.evidenceRefs.map((ref: EvidenceRef) => (
                  <tr key={ref.evidenceId}>
                    <td className="font-semibold">
                      <span className="font-mono text-[11px]">[{ref.sourceType}]</span>
                    </td>
                    <td>
                      <span className={styles.evidenceCode} title={ref.sourceRecordId}>
                        {ref.sourceRecordId.slice(0, 13)}…
                      </span>
                    </td>
                    <td>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                          ref.evidenceStatus === 'present'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : ref.evidenceStatus === 'missing'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {ref.evidenceStatus}
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {ref.relationToSignal}
                    </td>
                    <td>
                      {ref.sourceType === 'DIAGNOSTIC_ORDER' && (
                        <Link
                          href={`/diagnostics`}
                          className={styles.evidenceActionBtn}
                          title="Open diagnostics workspace"
                        >
                          <span>Diagnostics</span>
                          <ExternalLink size={10} aria-hidden="true" />
                        </Link>
                      )}
                      {ref.sourceType === 'ENCOUNTER' && (
                        <Link
                          href={`/encounters`}
                          className={styles.evidenceActionBtn}
                          title="Open clinical encounter"
                        >
                          <span>Encounter</span>
                          <ExternalLink size={10} aria-hidden="true" />
                        </Link>
                      )}
                      {ref.sourceType === 'CLINICAL_RECORD' && signal.patientId && (
                        <Link
                          href={`/patients/${signal.patientId}`}
                          className={styles.evidenceActionBtn}
                          title="Open patient chart"
                        >
                          <span>Patient Chart</span>
                          <ExternalLink size={10} aria-hidden="true" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stage 3: Bounded AI Operational Briefing */}
        <div className={`${styles.sectionCard} ${styles.aiContainer}`}>
          <div className={`${styles.sectionHeader} ${styles.aiHeader}`}>
            <span className={styles.sectionLabel}>
              <Activity size={15} className="text-primary" aria-hidden="true" />
              <span>3. Bounded AI Operational Briefing (Advisory Only)</span>
            </span>
            <span className="text-[11px] font-mono font-medium text-primary">
              MANIFEST-GROUNDED
            </span>
          </div>
          <div className={styles.sectionContent}>
            {signal.aiExplanation ? (
              <>
                <p className={styles.aiSummaryText}>{signal.aiExplanation.summary}</p>

                {signal.aiExplanation.clinicalImpact && (
                  <div className={styles.aiImpactBox}>
                    <strong className="text-foreground">Operational / Clinical Impact: </strong>
                    <span>{signal.aiExplanation.clinicalImpact}</span>
                  </div>
                )}

                {signal.aiExplanation.citations.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <strong>Evidence Citations: </strong>
                    <span className="font-mono text-[11px]">
                      {signal.aiExplanation.citations.map((c) => c.sourceId).join(', ')}
                    </span>
                  </div>
                )}

                {signal.aiExplanation.disclaimers.length > 0 && (
                  <div className={styles.aiDisclaimer}>
                    {signal.aiExplanation.disclaimers.join(' ')}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.degradedBox}>
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <strong className="text-sm text-amber-800 dark:text-amber-300">
                    AI Advisory Subsystem Degraded or Offline
                  </strong>
                  <p className="text-xs text-amber-700 dark:text-amber-400 m-0">
                    Deterministic bottleneck detection and supporting audit evidence remain fully authoritative. Operational actions below can proceed with complete clinical safety.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stage 4: Governed Recommendations & Human Authorization */}
        {rec && (
          <div className={styles.actionCard}>
            <div className={styles.actionHeader}>
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-primary" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  4. Governed Action Recommendation
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={styles.actionTypePill}>
                  {rec.actionType}
                </span>
                <span className={`${styles.statusChip} ${getStatusChipClass(currentStatus)}`}>
                  STATUS: {currentStatus}
                </span>
              </div>
            </div>

            <div className={styles.actionBody}>
              <div className={styles.actionRationale}>
                <strong>Recommended Next Step: </strong>
                <span>{rec.rationale}</span>
              </div>

              {rec.uncertaintyNote && (
                <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded border border-border">
                  <strong>Uncertainty / Boundary Note: </strong>
                  <span>{rec.uncertaintyNote}</span>
                </div>
              )}

              {/* Status Specific Information Banner */}
              {currentStatus === 'approved' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>
                    Action authorized by clinician. Task has been dispatched to authorized hospital services.
                  </span>
                </div>
              )}

              {currentStatus === 'executed' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <FileCheck size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>
                    Action execution confirmed by backend service. Recorded in SHA-256 audit log.
                  </span>
                </div>
              )}

              {currentStatus === 'rejected' && (
                <div className="bg-muted border border-border p-3 rounded-lg flex items-center gap-2.5 text-xs text-muted-foreground">
                  <XCircle size={16} className="text-muted-foreground shrink-0" aria-hidden="true" />
                  <span>
                    Recommendation was declined by operator. Reason: {recommendationOverride?.rejectionReason || 'Declined by human operator'}.
                  </span>
                </div>
              )}

              {currentStatus === 'execution_failed' && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0" aria-hidden="true" />
                  <span>
                    Execution was not completed by the downstream service. Please review service logs or contact system administration.
                  </span>
                </div>
              )}
            </div>

            {/* Governed Action Controls */}
            <div className={styles.actionFooterBar}>
              <div className={styles.permissionNotice}>
                {!canApprove ? (
                  <>
                    <Lock size={13} className="text-amber-600" aria-hidden="true" />
                    <span>
                      Approval restricted to Attending Physicians and Hospital Administrators.
                    </span>
                  </>
                ) : (
                  <span>Human decision required before operational execution.</span>
                )}
              </div>

              <div className={styles.actionButtons}>
                {/* Direct resource shortcuts for view actions */}
                {rec.actionType === 'VIEW_DIAGNOSTIC_ORDER' && diagnosticOrderEvidence && (
                  <Link href="/diagnostics">
                    <Button variant="secondary" size="sm" className="gap-1.5">
                      <span>Go to Diagnostic Order</span>
                      <ExternalLink size={12} aria-hidden="true" />
                    </Button>
                  </Link>
                )}

                {rec.actionType === 'VIEW_PATIENT_RECORD' && signal.patientId && (
                  <Link href={`/patients/${signal.patientId}`}>
                    <Button variant="secondary" size="sm" className="gap-1.5">
                      <span>Open Patient Chart</span>
                      <ExternalLink size={12} aria-hidden="true" />
                    </Button>
                  </Link>
                )}

                {/* Governed Approval / Rejection buttons */}
                {currentStatus === 'proposed' && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenReject(signal, rec)}
                      disabled={!canApprove}
                      id="reject-recommendation-button"
                    >
                      Decline
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onOpenApprove(signal, rec)}
                      disabled={!canApprove}
                      id="approve-recommendation-button"
                      className="gap-1.5"
                    >
                      <UserCheck size={14} aria-hidden="true" />
                      <span>Authorize Action</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
