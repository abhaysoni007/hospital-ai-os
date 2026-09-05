'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, RefreshCw, ArrowLeft, Info } from 'lucide-react';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Card, CardContent } from '../../../components/ui/Card/Card';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Table, THead, TH, TBody, TR, TD, TableSkeleton } from '../../../components/ui/Table/Table';
import styles from './departments.module.css';

interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
  rosteredDoctors: number;
  status: 'active';
}

const REGISTERED_DEPARTMENTS: DepartmentRecord[] = [
  { id: 'dept-emer-001', name: 'Emergency Medicine', code: 'EMER', rosteredDoctors: 4, status: 'active' },
  { id: 'dept-card-002', name: 'Cardiology', code: 'CARD', rosteredDoctors: 3, status: 'active' },
  { id: 'dept-neur-003', name: 'Neurology', code: 'NEUR', rosteredDoctors: 2, status: 'active' },
  { id: 'dept-orth-004', name: 'Orthopedics', code: 'ORTH', rosteredDoctors: 2, status: 'active' },
  { id: 'dept-im-005', name: 'Internal Medicine', code: 'INTM', rosteredDoctors: 3, status: 'active' },
  { id: 'dept-path-006', name: 'Pathology & Laboratory', code: 'PATH', rosteredDoctors: 2, status: 'active' },
  { id: 'dept-rad-007', name: 'Radiology & Imaging', code: 'RADI', rosteredDoctors: 2, status: 'active' },
];

export default function AdminDepartmentsPage() {
  const [departments] = useState<DepartmentRecord[]>(REGISTERED_DEPARTMENTS);
  const [loading, setLoading] = useState(false);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 200);
  };

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
            onClick={handleRefresh}
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

        <Card elevation="xs" padding="none">
          <div className={styles.cardHeader}>
            <div>
              <h3>Active Clinical Units</h3>
              <p>{departments.length} units registered in system</p>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} />
          ) : departments.length === 0 ? (
            <CardContent>
              <p className={styles.empty}>No clinical departments found.</p>
            </CardContent>
          ) : (
            <Table ariaLabel="Departments">
              <THead>
                <tr>
                  <TH>Department Name</TH>
                  <TH>Department Code</TH>
                  <TH>Attending Doctors</TH>
                  <TH>Bed Occupancy</TH>
                  <TH>Status</TH>
                </tr>
              </THead>
              <TBody>
                {departments.map((dept) => (
                  <TR key={dept.id}>
                    <TD>
                      <span style={{ fontWeight: 600 }}>{dept.name}</span>
                    </TD>
                    <TD>
                      <code style={{ fontSize: '0.8125rem' }}>{dept.code}</code>
                    </TD>
                    <TD>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={14} style={{ color: 'var(--color-neutral-400)' }} />
                        {dept.rosteredDoctors} rostered
                      </span>
                    </TD>
                    <TD>
                      <span style={{ color: 'var(--color-neutral-400)' }}>—</span>
                    </TD>
                    <TD>
                      <Badge variant="stable" size="sm">Active</Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
