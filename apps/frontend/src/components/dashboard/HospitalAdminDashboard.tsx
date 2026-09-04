'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, Stethoscope, Users, FlaskConical, RefreshCw, ArrowUpRight } from 'lucide-react';
import type { EncounterListItem, BookingOptionsResponse } from 'shared';
import { ROLE_DISPLAY_NAMES } from '../../utils/rbac';
import { encounterService } from '../../services/encounter-service';
import { appointmentService } from '../../services/appointment-service';
import { diagnosticsService } from '../../services/diagnostics-service';
import { bucketEncountersByDay, computeEncounterStatusDistribution, weekdayShortLabel } from '../../utils/dashboard';
import { Card, CardContent } from '../ui/Card/Card';
import { Badge } from '../ui/Badge/Badge';
import { AlertBanner } from '../ui/Alert/AlertBanner';
import { MetricCard } from '../ui/MetricCard/MetricCard';
import { LineChart, LineChartTone } from '../ui/LineChart/LineChart';
import { DonutChart, DonutTone } from '../ui/DonutChart/DonutChart';
import { Table, THead, TH, TBody, TR, TD, RowLink, TableSkeleton } from '../ui/Table/Table';
import styles from './DashboardShell.module.css';

const DONUT_TONE_BY_STATUS: Record<string, DonutTone> = {
  active: 'primary',
  completed: 'success',
  cancelled: 'neutral',
};

export function HospitalAdminDashboard() {
  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [bookingOptions, setBookingOptions] = useState<BookingOptionsResponse | null>(null);
  const [labTotal, setLabTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const mounted = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [encRes, optRes, labRes] = await Promise.all([
        encounterService.getEncounters({ page: 1, pageSize: 100 }),
        appointmentService.getBookingOptions(),
        diagnosticsService.getLabQueue({ page: 1, pageSize: 1 }),
      ]);
      if (!mounted.current) return;
      setEncounters(encRes.data);
      setBookingOptions(optRes.data);
      setLabTotal(labRes.meta.total);
      setNow(new Date());
    } catch {
      if (!mounted.current) return;
      setError('Could not load hospital administrative telemetry.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadData();
    return () => {
      mounted.current = false;
    };
  }, [loadData]);

  const buckets = useMemo(() => bucketEncountersByDay(encounters, 7, now), [encounters, now]);
  const statusDist = useMemo(() => computeEncounterStatusDistribution(encounters), [encounters]);
  const seriesTotal = buckets.map((b) => b.count);
  const xLabels = buckets.map((b) => weekdayShortLabel(b.date));
  const yMax = Math.max(1, ...seriesTotal);

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.greetingBanner}>
        <div>
          <h1 className={styles.greetingTitle}>
            <span className={styles.greetingIcon} aria-hidden="true">🏢</span>
            Hospital Operations & Capacity Administration
          </h1>
          <p className={styles.greetingSubtitle}>
            {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            {ROLE_DISPLAY_NAMES.hospital_admin} Console
          </p>
        </div>
        <div className={styles.greetingMeta}>
          <span className={styles.livePill}><span className={styles.liveDot} aria-hidden="true" />Facility Live</span>
          <button type="button" className={styles.refreshButton} onClick={() => void loadData()}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {/* Metrics */}
      <section aria-label="Administrative metrics" className={styles.metricRow}>
        <MetricCard
          label="Active Encounters"
          icon={<Stethoscope size={16} aria-hidden="true" />}
          tone="primary"
          href="/encounters"
          value={loading ? '—' : encounters.filter((e) => e.status === 'active').length}
          hint="Currently in consult across facility"
        />
        <MetricCard
          label="Active Departments"
          icon={<Building2 size={16} aria-hidden="true" />}
          tone="neutral"
          href="/admin/departments"
          value={loading || !bookingOptions ? '—' : bookingOptions.departments.length}
          hint="Operating clinical units"
        />
        <MetricCard
          label="Rostered Attending Staff"
          icon={<Users size={16} aria-hidden="true" />}
          tone="info"
          href="/admin/staff"
          value={loading || !bookingOptions ? '—' : bookingOptions.physicians.length}
          hint="Credentialed clinical practitioners"
        />
        <MetricCard
          label="Diagnostic Orders Volume"
          icon={<FlaskConical size={16} aria-hidden="true" />}
          tone="warning"
          href="/diagnostics"
          value={loading ? '—' : labTotal}
          hint="Total diagnostic workflow entries"
        />
      </section>

      {/* Analytics */}
      <section aria-label="Facility analytics" className={styles.analyticsGrid}>
        <Card elevation="xs" padding="md">
          <div className={styles.chartHeader}>
            <div>
              <h2 className={styles.chartTitle}>Facility Encounter Volume</h2>
              <p className={styles.chartSubtitle}>Last 7 days · all departments</p>
            </div>
          </div>
          {loading ? (
            <div className={styles.chartSkeleton} />
          ) : error ? (
            <CardContent>
              <AlertBanner severity="warning" title="Could not load volume">{error}</AlertBanner>
            </CardContent>
          ) : (
            <LineChart
              series={[{ label: 'Encounters', tone: 'primary' as LineChartTone, data: seriesTotal }]}
              xLabels={xLabels}
              yMax={yMax}
              height={230}
            />
          )}
        </Card>

        <Card elevation="xs" padding="md">
          <div className={styles.chartHeader}>
            <div>
              <h2 className={styles.chartTitle}>Consultation Status Breakdown</h2>
              <p className={styles.chartSubtitle}>Patient flow distribution</p>
            </div>
          </div>
          {loading ? (
            <div className={styles.chartSkeleton} />
          ) : statusDist.length === 0 ? (
            <CardContent><p className={styles.quietEmpty}>No encounters to summarise.</p></CardContent>
          ) : (
            <DonutChart
              size={150}
              centerLabel={String(statusDist.reduce((a, b) => a + b.count, 0))}
              centerSublabel="Total"
              segments={statusDist.map((s) => ({
                label: s.status,
                value: s.count,
                tone: DONUT_TONE_BY_STATUS[s.status] ?? 'neutral',
              }))}
            />
          )}
        </Card>

        {/* Department Overview */}
        <aside className={styles.sideRail} aria-label="Department Directory">
          <Card elevation="xs" padding="md">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Clinical Departments</h3>
            {loading || !bookingOptions ? (
              <p className={styles.quietEmpty}>Loading departments…</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {bookingOptions.departments.map((d) => (
                  <li key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-neutral-100)' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{d.name}</span>
                    <Badge variant="neutral" size="sm">Active</Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/departments" className={styles.viewAllFooter} style={{ marginTop: 'var(--space-3)' }}>
              Manage departments <ArrowUpRight size={12} aria-hidden="true" />
            </Link>
          </Card>
        </aside>

        {/* Recent Encounters */}
        <Card elevation="xs" padding="none" className={styles.tableCard}>
          <div className={styles.sectionCardHeader}>
            <div className={styles.sectionHeaderTitle}>
              <h3>Recent Consultations</h3>
              <p>Facility-wide clinical encounters</p>
            </div>
            <Link href="/encounters" className={styles.viewAllLink}>
              View all <ArrowUpRight size={12} aria-hidden="true" />
            </Link>
          </div>
          {loading ? (
            <TableSkeleton rows={5} />
          ) : (
            <Table ariaLabel="Recent Consultations">
              <THead>
                <tr>
                  <TH>Patient MRN</TH>
                  <TH>Type</TH>
                  <TH>Status</TH>
                  <TH>Started</TH>
                  <TH align="right">Action</TH>
                </tr>
              </THead>
              <TBody>
                {encounters.slice(0, 10).map((e) => (
                  <TR key={e.id}>
                    <TD>
                      <code style={{ fontSize: '0.8125rem' }}>{e.patient?.mrn ?? '—'}</code>
                    </TD>
                    <TD>
                      <Badge variant="neutral" size="sm">{e.encounterType.toUpperCase()}</Badge>
                    </TD>
                    <TD>
                      <Badge variant={e.status === 'active' ? 'primary' : 'stable'} size="sm">{e.status}</Badge>
                    </TD>
                    <TD>{e.startedAt ? new Date(e.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</TD>
                    <TD align="right">
                      <RowLink href={`/encounters/${e.id}`} aria-label="View encounter">View</RowLink>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </section>
    </div>
  );
}
