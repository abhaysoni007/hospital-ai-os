'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { PageHeader } from '../../../components/ui/PageHeader/PageHeader';
import { Card, CardContent } from '../../../components/ui/Card/Card';
import { Table, THead, TH, TBody, TR, TD } from '../../../components/ui/Table/Table';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Button } from '../../../components/ui/Button/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog/ConfirmDialog';
import { Skeleton } from '../../../components/ui/Skeleton/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState/ErrorState';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { breakGlassService, BreakGlassSessionResponse } from '../../../services/break-glass-service';
import { Shield, EyeOff, ShieldOff } from 'lucide-react';
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
      setSessions(res.data);
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
    } catch (err: any) {
      setRevokeError(err.message || 'Failed to revoke session.');
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
    } catch (err: any) {
      setReviewError(err.message || 'Failed to fetch session justification.');
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <AppShell breadcrumbs={['Administration', 'Security']} requiredPermission="break_glass:review">
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
        <PageHeader
          title="Security Administration"
          description="Monitor and review Break-Glass emergency access sessions."
        />

        <Card elevation="xs" padding="none">
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>Active & Recent Sessions</h3>
          </div>
          
          {loading ? (
            <CardContent>
              <Skeleton variant="rectangular" height={200} />
            </CardContent>
          ) : error ? (
            <CardContent>
              <ErrorState title="Error Loading Data" message={error} onRetry={() => void fetchSessions()} />
            </CardContent>
          ) : sessions.length === 0 ? (
            <CardContent>
              <EmptyState
                icon={<Shield size={32} />}
                title="No Break-Glass Sessions"
                description="There are currently no active or recent emergency access sessions."
              />
            </CardContent>
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
                      <Badge variant={s.status === 'active' ? 'danger' : 'neutral'} size="sm">
                        {s.status.toUpperCase()}
                      </Badge>
                    </TD>
                    <TD>{s.actorId}</TD>
                    <TD>{s.patientId}</TD>
                    <TD>{s.reason.replace(/_/g, ' ')}</TD>
                    <TD>{new Date(s.createdAt).toLocaleString()}</TD>
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
        </Card>

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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p>
                Are you sure you want to forcibly revoke this active Break-Glass session?
                The clinician will immediately lose emergency access to this patient's records.
              </p>
              {revokeError && (
                <AlertBanner severity="critical" title="Revocation failed" dismissible onDismiss={() => setRevokeError(null)}>
                  {revokeError}
                </AlertBanner>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="revoke-reason" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Revocation Reason</label>
                <input
                  id="revoke-reason"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder="e.g. Unauthorized access, emergency concluded"
                  style={{
                    padding: '0.625rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    width: '100%',
                  }}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {reviewLoading ? (
                <Skeleton variant="text" />
              ) : reviewError ? (
                <AlertBanner severity="warning" title="Could not load justification">{reviewError}</AlertBanner>
              ) : reviewData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>CLINICAL JUSTIFICATION</h4>
                    <div style={{ padding: '1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-md)', fontStyle: 'italic' }}>
                      "{reviewData.justification}"
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Actor ID</h4>
                      <div>{reviewData.actorId}</div>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Patient ID</h4>
                      <div>{reviewData.patientId}</div>
                    </div>
                  </div>
                  {reviewData.revokedAt && (
                    <div>
                      <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Revocation</h4>
                      <div style={{ color: 'var(--danger-dark)' }}>
                        Revoked by {reviewData.revokedBy} at {new Date(reviewData.revokedAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </ConfirmDialog>
        )}
      </div>
    </AppShell>
  );
}
