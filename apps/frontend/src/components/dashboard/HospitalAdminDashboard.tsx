'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { EncounterListItem, AppointmentListItem } from 'shared';
import { encounterService } from '../../services/encounter-service';
import { appointmentService } from '../../services/appointment-service';
import { bucketEncountersByDay, weekdayShortLabel } from '../../utils/dashboard';
import { LineChart, LineChartTone } from '../ui/LineChart/LineChart';
import {
  RoleIntro,
  DateRangeFilter,
  useDateRange,
  MetricGrid,
  RoleMetricCard,
  DashboardGrid,
  ChartCard,
} from './RoleComponents';
import styles from './DashboardShell.module.css';

const CLINICAL_DEPARTMENTS = [
  { id: 'dep-emer', name: 'Emergency Medicine' },
  { id: 'dep-card', name: 'Cardiology' },
  { id: 'dep-neur', name: 'Neurology' },
  { id: 'dep-orth', name: 'Orthopedics' },
  { id: 'dep-im', name: 'Internal Medicine' },
  { id: 'dep-ped', name: 'Pediatrics' },
  { id: 'dep-lab', name: 'Pathology & Laboratory' },
];

export function HospitalAdminDashboard() {
  const { range, setRange } = useDateRange('30d');
  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const mounted = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [encRes, apptRes] = await Promise.all([
        encounterService.getEncounters({ page: 1, pageSize: 100 }),
        appointmentService.getAppointments({ page: 1, pageSize: 100 }),
      ]);
      if (!mounted.current) return;
      setEncounters(Array.isArray(encRes?.data) ? encRes.data : []);
      setAppointments(Array.isArray(apptRes?.data) ? apptRes.data : []);
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
  const seriesTotal = buckets.map((b) => b.count);

  const activeEncounters = encounters.filter((e) => e.status === 'active').length;
  const dischargedEncounters = encounters.filter((e) => e.status === 'discharged').length;

  return (
    <div className="space-y-4">
      <RoleIntro
        title="Hospital operations"
        subtitle="Operational telemetry · clinical throughput, capacity and hospital resources."
        aside={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {error && (
        <div role="alert" className={styles.quietEmpty} style={{ color: 'var(--color-danger-main)' }}>
          {error}
        </div>
      )}

      {/* 6-Card Metric Grid */}
      <MetricGrid columns={6}>
        <RoleMetricCard
          label="Encounters"
          value={loading ? '—' : encounters.length}
          hint="Total opened today"
          href="/encounters"
        />
        <RoleMetricCard
          label="In consultation"
          value={loading ? '—' : activeEncounters}
          hint="Currently active"
          href="/encounters"
        />
        <RoleMetricCard
          label="Scheduled"
          value={loading ? '—' : appointments.length}
          hint="Booked appointments"
          href="/appointments"
        />
        <RoleMetricCard
          label="Departments"
          value={loading ? '—' : CLINICAL_DEPARTMENTS.length}
          hint="Clinical units active"
          href="/admin/departments"
        />
        <RoleMetricCard
          label="Staff roster"
          value={loading ? '—' : 'Active'}
          hint="Medical & operations"
          href="/admin/staff"
        />
        <RoleMetricCard
          label="Discharged"
          value={loading ? '—' : dischargedEncounters}
          hint="Completed care"
          tone="success"
          href="/encounters"
        />
      </MetricGrid>

      {/* Patient Flow Stages */}
      <section className="clinical-panel p-4" aria-label="Patient flow today">
        <header style={{ marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Patient Flow Stages Today
          </h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Real-time tracking of patients moving between intake, active clinical consult, care delivery, and discharge.
          </p>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
          {[
            { stage: 'Scheduled', value: appointments.length },
            { stage: 'Check-In', value: encounters.filter((e) => e.status === 'registered').length },
            { stage: 'Consultation', value: activeEncounters },
            { stage: 'Discharge Prep', value: encounters.filter((e) => e.status === 'discharge_initiated').length },
            { stage: 'Discharged', value: dischargedEncounters },
          ].map((s, idx, arr) => (
            <div
              key={s.stage}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                }}
              >
                <p style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                  {s.stage}
                </p>
                <p className="num" style={{ fontSize: '1.25rem', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                  {s.value}
                </p>
              </div>
              {idx < arr.length - 1 && (
                <ArrowRight size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Analytical Dashboard Grid */}
      <DashboardGrid columns={2}>
        <ChartCard
          title="Hospital activity"
          decision="Is total clinical activity trending up or down across departments?"
          action={{ label: 'Departments', href: '/admin/departments' }}
        >
          {buckets.length === 0 ? (
            <p className={styles.quietEmpty}>No encounter activity recorded.</p>
          ) : (
            <div style={{ height: 220 }}>
              <LineChart
                series={[
                  {
                    label: 'Hospital Activity',
                    tone: 'primary' as LineChartTone,
                    data: seriesTotal,
                  },
                ]}
                xLabels={buckets.map((b) => weekdayShortLabel(b.date))}
                yMax={Math.max(1, ...seriesTotal)}
                ariaLabel="Hospital activity trend over time"
              />
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Department capacity & roster"
          decision="Which clinical units are active and staffed?"
          action={{ label: 'Staff directory', href: '/admin/staff' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Active clinical units in Hospital AI OS:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {CLINICAL_DEPARTMENTS.map((d) => (
                <li
                  key={d.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    background: 'var(--bg-subtle)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{d.name}</span>
                  <span className="num" style={{ color: 'var(--text-secondary)' }}>
                    Active
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      </DashboardGrid>
    </div>
  );
}
