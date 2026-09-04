'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, RefreshCw, ArrowLeft, Info } from 'lucide-react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Card, CardContent } from '../../../components/ui/Card/Card';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Table, THead, TH, TBody, TR, TD, TableSkeleton } from '../../../components/ui/Table/Table';
import { AlertBanner } from '../../../components/ui/Alert/AlertBanner';
import { appointmentService } from '../../../services/appointment-service';
import type { BookingOptionsResponse } from 'shared';
import styles from './departments.module.css';

export default function AdminDepartmentsPage() {
  const [data, setData] = useState<BookingOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDepartments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await appointmentService.getBookingOptions();
      setData(res.data);
    } catch {
      setError('Could not load department directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDepartments();
  }, []);

  return (
    <AppShell breadcrumbs={['Administration', 'Departments']} requiredPermission="staff:manage">
      <div className={styles.container}>
        <div className={styles.navRow}>
          <Link href="/dashboard" className={styles.backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Dashboard
          </Link>
        </div>

        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Clinical Departments &amp; Units</h1>
            <p className={styles.subtitle}>
              Active clinical services, operating specialties, and assigned medical staff
            </p>
          </div>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void loadDepartments()}
            aria-label="Refresh departments"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        </header>

        <div className={styles.infoBanner}>
          <Info size={16} className={styles.infoIcon} />
          <span>
            Department directory is loaded directly from real hospital configuration. Real-time bed occupancy and ward telemetry are scheduled for the M20 milestone; metrics are displayed truthfully as &ldquo;—&rdquo; where uninstrumented.
          </span>
        </div>

        {error && (
          <AlertBanner severity="warning" title="Directory unavailable">
            {error}
          </AlertBanner>
        )}

        <Card elevation="xs" padding="none">
          <div className={styles.cardHeader}>
            <div>
              <h3>Active Clinical Units</h3>
              <p>{data?.departments.length ?? 0} units registered in system</p>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} />
          ) : !data || data.departments.length === 0 ? (
            <CardContent>
              <p className={styles.empty}>No clinical departments found.</p>
            </CardContent>
          ) : (
            <Table ariaLabel="Departments">
              <THead>
                <tr>
                  <TH>Department Name</TH>
                  <TH>Department ID</TH>
                  <TH>Attending Doctors</TH>
                  <TH>Bed Occupancy</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {data.departments.map((dept) => {
                  const doctorsInDept = data.physicians.filter((d) => d.departmentId === dept.id);
                  return (
                    <TR key={dept.id}>
                      <TD>
                        <span style={{ fontWeight: 600 }}>{dept.name}</span>
                      </TD>
                      <TD>
                        <code style={{ fontSize: '0.8125rem' }}>{dept.id.slice(0, 8)}…</code>
                      </TD>
                      <TD>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Users size={14} style={{ color: 'var(--color-neutral-400)' }} />
                          {doctorsInDept.length} rostered
                        </span>
                      </TD>
                      <TD>
                        <span style={{ color: 'var(--color-neutral-400)' }}>—</span>
                      </TD>
                      <TD>
                        <Badge variant="stable" size="sm">Active</Badge>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
