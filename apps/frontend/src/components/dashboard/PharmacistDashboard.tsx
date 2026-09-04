'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import type { TaskResponse } from 'shared';
import { useAuth } from '../../hooks/useAuth';
import { taskService } from '../../services/task-service';
import { Button } from '../ui/Button/Button';
import { TableSkeleton } from '../ui/Table/Table';
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

export function PharmacistDashboard() {
  const { user } = useAuth();
  const { range, setRange } = useDateRange('7d');
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const mounted = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const taskRes = await taskService.listTasks({ page: 1, pageSize: 50 });
      if (!mounted.current) return;
      setTasks(taskRes.data);
    } catch {
      if (!mounted.current) return;
      setError('Could not load pharmacy tasks.');
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
      setError('Failed to update task.');
    } finally {
      setCompletingTaskId(null);
    }
  };

  const openTasks = tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
  const criticalTasks = openTasks.filter((t) => t.priority === 'critical' || t.priority === 'high');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const pharmacistName = user?.firstName ? `${user.firstName} ${user.lastName ?? ''}` : 'Pharmacist';

  return (
    <div className="space-y-4">
      <RoleIntro
        title="Medication review workspace"
        subtitle={`${pharmacistName}, PharmD · reviews assigned to clinical pharmacy, in clinical priority order.`}
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
          label="Assigned tasks"
          value={loading ? '—' : tasks.length}
          hint="All work routed to pharmacy today"
          href="/tasks"
        />
        <RoleMetricCard
          label="Review queue"
          value={loading ? '—' : openTasks.length}
          hint="Not yet completed"
          href="/tasks"
          tone={openTasks.length > 5 ? 'warning' : 'default'}
        />
        <RoleMetricCard
          label="Critical reviews"
          value={loading ? '—' : criticalTasks.length}
          hint="Renal or allergy risk flagged"
          tone={criticalTasks.length > 0 ? 'critical' : 'default'}
          href="/tasks"
        />
        <RoleMetricCard
          label="Completed today"
          value={loading ? '—' : completedTasks.length}
          hint="Resolved during shift"
          tone="success"
          href="/tasks"
        />
      </MetricGrid>

      {/* Analytical Dashboard Grid */}
      <DashboardGrid columns={2}>
        <ChartCard
          title="Review queue by priority"
          decision="What must I clear before anything else today?"
          action={{ label: 'Task centre', href: '/tasks' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Breakdown of {openTasks.length} active medication reviews by acuity.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-danger-bg)', color: 'var(--color-danger-text)', fontSize: '0.75rem', fontWeight: 600 }}>
                {criticalTasks.length} Critical
              </span>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-warning-bg)', color: 'var(--color-warning-text)', fontSize: '0.75rem', fontWeight: 600 }}>
                {openTasks.filter((t) => t.priority === 'high').length} High/Urgent
              </span>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--bg-subtle)', fontSize: '0.75rem' }}>
                {openTasks.filter((t) => t.priority === 'low' || t.priority === 'medium').length} Routine
              </span>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Reviews completed per day"
          decision="Is the pharmacy queue clearing at a sustainable rate?"
          action={{ label: 'Tasks', href: '/tasks' }}
        >
          <div style={{ padding: 'var(--space-3)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
              Completed reviews: {completedTasks.length} total across the service.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className="num" style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--color-success-bg)', color: 'var(--color-success-text)', fontSize: '0.75rem', fontWeight: 600 }}>
                {completedTasks.length} Verified & Dispensed
              </span>
            </div>
          </div>
        </ChartCard>
      </DashboardGrid>

      {/* Review Queue */}
      <section className="clinical-panel p-4" aria-label="Pharmacy review queue">
        <header style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Your Review Queue
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Prescriptions and medication orders awaiting clinical pharmacist sign-off.
            </p>
          </div>
          <Link href="/tasks" style={{ fontSize: '0.75rem', color: 'var(--color-primary-600)', textDecoration: 'none', fontWeight: 500 }}>
            View all tasks →
          </Link>
        </header>

        {loading ? (
          <TableSkeleton rows={4} />
        ) : openTasks.length === 0 ? (
          <div className={styles.quietEmpty}>No outstanding pharmacy review tasks.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {openTasks.slice(0, 6).map((task) => (
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
                    Acuity: {task.priority.toUpperCase()} · Status: {task.status}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={completingTaskId === task.id}
                  onClick={() => void handleCompleteTask(task.id)}
                  iconLeft={<Check size={12} />}
                >
                  Verify
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
