'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Table, THead, TH, TBody, TR, TD } from '../../../components/ui/Table/Table';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Button } from '../../../components/ui/Button/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { breakGlassService, BreakGlassSessionResponse } from '../../../services/break-glass-service';
import { Shield } from 'lucide-react';
import styles from './security.module.css';


export default function SecurityAdminPage() {
  const [sessions, setSessions] = useState<BreakGlassSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<BreakGlassSessionResponse | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await breakGlassService.listSessions({ limit: 100 });
      setSessions(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setError('Could not load break-glass sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = async () => {
    if (!revokingId) return;
    if (revokeReason.trim().length < 5) {
      setRevokeError('Please provide a valid revocation reason.');
      return;
    }

    setRevokeError(null);
    try {
      await breakGlassService.revokeSession(revokingId, revokeReason);
      setRevokingId(null);
      setRevokeReason('');
      await fetchSessions();
    } catch (err: unknown) {
      setRevokeError((err as Error).message || 'Failed to revoke session.');
    }
  };

  const handleReview = async (id: string) => {
    setReviewingId(id);
    setReviewData(null);
    setReviewLoading(true);
    setReviewError(null);

    try {
      const res = await breakGlassService.reviewSession(id);
      setReviewData(res.data);
    } catch (err: unknown) {
      setReviewError((err as Error).message || 'Failed to fetch session justification.');
    } finally {
      setReviewLoading(false);
    }
  };

  const activeCount = sessions.filter((s) => s.status === 'active').length;

  return (
    <AppShell breadcrumbs={['Administration', 'Security']} requiredPermission="break_glass:review">
      <div className={styles.container}>

        {/* Tactical Header */}
        <div className={styles.headerCard}>
          <span className={styles.headerIcon} aria-hidden="true">
            <Shield size={18} />
          </span>
          <div className={styles.headerContent}>
            <h1 className={styles.title}>
              Security Administration
              <span className={styles.versionTag}>GOVERNANCE</span>
            </h1>
            <p className={styles.subtitle}>
              Monitor and review Break-Glass emergency access sessions. All actions are immutably audit-logged.
            </p>
          </div>
        </div>

        {/* Sessions Table Card */}
        <div className={styles.tableCard}>
          <div className={styles.cardBar}>
            <h2 className={styles.cardTitle}>
              Active &amp; Recent Sessions
            </h2>
            <span className={styles.liveCount}>
              {activeCount} active
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '1.5rem' }}>
              <Skeleton variant="rectangular" height={200} />
            </div>
          ) : error ? (
            <div style={{ padding: '1.5rem' }}>
              <ErrorState title="Error Loading Data" message={error} onRetry={() => void fetchSessions()} />
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: '1.5rem' }}>
              <EmptyState
                icon={<Shield size={32} />}
                title="No Break-Glass Sessions"
                description="There are currently no active or recent emergency access sessions."
              />
            </div>
          ) : (
            <Table ariaLabel="Break Glass Sessions">
              <THead>
                <tr>
                  <TH>Status</TH>
                  <TH>Actor ID</TH>
                  <TH>Patient ID</TH>
                  <TH>Reason Code</TH>
                  <TH>Activated</TH>
                  <TH aria-label="Actions" />
                </tr>
              </THead>
              <TBody>
                {sessions.map((s) => (
                  <TR key={s.id}>
                    <TD>
                      <Badge variant={s.status === 'active' ? 'critical' : 'neutral'} size="sm">
                        {s.status.toUpperCase()}
                      </Badge>
                    </TD>
                    <TD><span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.8125rem' }}>{s.actorId}</span></TD>
                    <TD><span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.8125rem' }}>{s.patientId}</span></TD>
                    <TD>{s.reason.replace(/_/g, ' ')}</TD>
                    <TD><span style={{ fontFamily: 'var(--font-family-mono)', fontSize: '0.8125rem' }}>{new Date(s.createdAt).toLocaleString()}</span></TD>
                    <TD align="right">
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <Button variant="secondary" size="sm" onClick={() => void handleReview(s.id)}>
                          Review
                        </Button>
                        {s.status === 'active' && (
                          <Button variant="danger" size="sm" onClick={() => setRevokingId(s.id)}>
                            Revoke
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>

        {/* Revoke Modal */}
        {revokingId && (
          <ConfirmDialog
            isOpen
            title="Revoke Emergency Access"
            confirmLabel="Force Revoke Session"
            variant="danger"
            onConfirm={() => void handleRevoke()}
            onCancel={() => { setRevokingId(null); setRevokeError(null); }}
          >
            <div className={styles.dialogBody}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Forcibly revoking this session immediately removes emergency access to the patient&apos;s records.
              </p>
              {revokeError && (
                <AlertBanner severity="critical" title="Revocation failed" dismissible onDismiss={() => setRevokeError(null)}>
                  {revokeError}
                </AlertBanner>
              )}
              <div>
                <label htmlFor="revoke-reason" className={styles.dialogLabel}>Revocation Reason</label>
                <input
                  id="revoke-reason"
                  className={styles.reasonInput}
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. Unauthorized access, emergency concluded"
                />
              </div>
            </div>
          </ConfirmDialog>
        )}

        {/* Review Modal */}
        {reviewingId && (
          <ConfirmDialog
            isOpen
            title="Review Session Justification"
            confirmLabel="Close"
            onConfirm={() => setReviewingId(null)}
            onCancel={() => setReviewingId(null)}
          >
            <div className={styles.dialogBody}>
              {reviewLoading ? (
                <Skeleton variant="text" />
              ) : reviewError ? (
                <AlertBanner severity="warning" title="Could not load justification">{reviewError}</AlertBanner>
              ) : reviewData ? (
                <>
                  <div className={styles.reviewSection}>
                    <span className={styles.reviewLabel}>Clinical Justification</span>
                    <div className={styles.justificationBlock}>
                      &quot;{reviewData.justification}&quot;
                    </div>
                  </div>
                  <div className={styles.reviewGrid}>
                    <div className={styles.reviewSection}>
                      <span className={styles.reviewLabel}>Actor ID</span>
                      <span className={styles.reviewValue} style={{ fontFamily: 'var(--font-family-mono)' }}>{reviewData.actorId}</span>
                    </div>
                    <div className={styles.reviewSection}>
                      <span className={styles.reviewLabel}>Patient ID</span>
                      <span className={styles.reviewValue} style={{ fontFamily: 'var(--font-family-mono)' }}>{reviewData.patientId}</span>
                    </div>
                  </div>
                  {reviewData.revokedAt && (
                    <div className={styles.reviewSection}>
                      <span className={styles.reviewLabel}>Revocation</span>
                      <span className={styles.revokedNote}>
                        Revoked by {reviewData.revokedBy} at {new Date(reviewData.revokedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </ConfirmDialog>
        )}

      </div>
    </AppShell>
  );
}
