'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { EncounterListItem, TaskResponse } from 'shared';
import { useAuth } from '../../hooks/useAuth';
import { encounterService } from '../../services/encounter-service';
import { taskService } from '../../services/task-service';
import { diagnosticsService } from '../../services/diagnostics-service';
import { Badge } from '../ui/Badge/Badge';
import { Button } from '../ui/Button/Button';
import { TableSkeleton } from '../ui/Table/Table';
import { PatientAlerts } from '../clinical/LovableClinical';
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

export function NursingDashboard() {
  const { user } = useAuth();
  const { range, setRange } = useDateRange('7d');
  const [encounters, setEncounters] = useState<EncounterListItem[]>([]);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [pendingSpecimens, setPendingSpecimens] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const mounted = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [encRes, taskRes, labRes] = await Promise.all([
        encounterService.getEncounters({ page: 1, status: 'active', pageSize: 20 }),
        taskService.listTasks({ page: 1, pageSize: 20 }),
        diagnosticsService.getLabQueue({ page: 1, status: 'ordered', pageSize: 1 }),
      ]);
      if (!mounted.current) return;
      setEncounters(encRes.data);
      setTasks(taskRes.data);
      setPendingSpecimens(labRes.meta.total);
    } catch {
      if (!mounted.current) return;
      setError('Could not load nursing ward data.');
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

  const handleCompleteTask = async (taskId: string) => {
    setCompletingTaskId(taskId);
    try {
      await taskService.completeTask(taskId);
      await loadData();
    } catch {
      setError('Failed to complete task.');
    } finally {
      setCompletingTaskId(null);
    }
  };

  const openTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const nurseName = user?.firstName ? `${user.firstName} ${user.lastName ?? ''}` : 'Nurse';

  return (
    <div className="space-y-4">
      <RoleIntro
        title="Ward workspace"
        subtitle={`${nurseName} · Ward 3B · your patients, observations and outstanding work.`}
        aside={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {error && (
        <div role="alert" className={styles.quietEmpty} style={{ color: 'var(--color-danger-main)' }}>
          {error}
        </div>
      )}

      {/* 4-Card Metric Grid */}
      <MetricGrid columns={4}>
        <RoleMetricCard
          label="Assigned patients"
          value={loading ? '—' : encounters.length}
          hint="Ward beds under your care"
          href="/patients"
        />
        <RoleMetricCard
          label="Active workload"
          value={loading ? '—' : `${tasks.length > 0 ? Math.round((openTasks.length / tasks.length) * 100) : 0}%`}
          hint="Share of assigned tasks open"
        />
        <RoleMetricCard
          label="Pending tasks"
          value={loading ? '—' : openTasks.length}
          hint="Assigned to you today"
          href="/tasks"
          tone={openTasks.length > 5 ? 'warning' : 'default'}
        />
        <RoleMetricCard
          label="Pending specimens"
          value={loading ? '—' : pendingSpecimens}
          hint="Awaiting bedside collection"
          tone={pendingSpecimens > 0 ? 'warning' : 'default'}
          href="/diagnostics"
        />
      </MetricGrid>

      {/* Analytical Dashboard Grid */}
      <DashboardGrid columns={2}>
        <ChartCard
          title="Patient flow through the ward"
          decision="Should I expect more admissions or discharges on this shift?"
          action={{ label: 'Patients', href: '/patients' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Currently managing {encounters.length} admitted patients across Ward 3B.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-subtle)', fontSize: '0.75rem' }}>
                {encounters.filter((e) => e.encounterType === 'inpatient').length} Inpatient
              </span>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-subtle)', fontSize: '0.75rem' }}>
                {encounters.filter((e) => e.encounterType === 'emergency').length} Emergency
              </span>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-subtle)', fontSize: '0.75rem' }}>
                {encounters.filter((e) => e.encounterType === 'opd').length} Ambulatory
              </span>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Bedside tasks overview"
          decision="Am I keeping pace with scheduled medications and observations?"
          action={{ label: 'Task centre', href: '/tasks' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              {openTasks.length} pending clinical tasks assigned to nursing.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', fontSize: '0.75rem', fontWeight: 600 }}>
                {openTasks.filter((t) => t.priority === 'critical' || t.priority === 'high').length} Urgent/Critical
              </span>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-subtle)', fontSize: '0.75rem' }}>
                {openTasks.filter((t) => t.priority === 'low' || t.priority === 'medium').length} Routine
              </span>
            </div>
          </div>
        </ChartCard>
      </DashboardGrid>

      {/* Ward Task Queue & Safety Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
        <section className="clinical-panel p-4" aria-label="Nursing task queue">
          <header style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Nursing Care & Medication Tasks
            </h2>
            <Link href="/tasks" style={{ fontSize: '0.75rem', color: 'var(--color-primary-600)', textDecoration: 'none', fontWeight: 500 }}>
              All tasks →
            </Link>
          </header>

          {loading ? (
            <TableSkeleton rows={3} />
          ) : openTasks.length === 0 ? (
            <div className={styles.quietEmpty}>All ward tasks completed.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {openTasks.slice(0, 5).map((task) => (
                <li
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 500, margin: 0, color: 'var(--text-primary)' }}>
                      {task.title}
                    </p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Priority: {task.priority.toUpperCase()} · Status: {task.status}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={completingTaskId === task.id}
                    onClick={() => void handleCompleteTask(task.id)}
                    iconLeft={<Check size={12} />}
                  >
                    Done
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="clinical-panel p-4" aria-label="Ward patients and safety alerts">
          <header style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Ward Patients & Safety Alerts
            </h2>
            <Link href="/patients" style={{ fontSize: '0.75rem', color: 'var(--color-primary-600)', textDecoration: 'none', fontWeight: 500 }}>
              All patients →
            </Link>
          </header>

          {loading ? (
            <TableSkeleton rows={3} />
          ) : encounters.length === 0 ? (
            <div className={styles.quietEmpty}>No active patients on this ward.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {encounters.slice(0, 5).map((e) => (
                <li
                  key={e.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link
                      href={`/encounters/${e.id}`}
                      style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-primary-600)', textDecoration: 'none' }}
                    >
                      {e.patient ? `${e.patient.firstName} ${e.patient.lastName}` : 'Unregistered'}{' '}
                      <span className="num" style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
                        {e.patient?.mrn ?? 'MRN-—'}
                      </span>
                    </Link>
                    <Badge variant="primary" size="sm">
                      {e.encounterType.toUpperCase()}
                    </Badge>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <PatientAlerts alerts={[{ level: 'info', label: 'Ward 3B · Bed Assigned' }]} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
