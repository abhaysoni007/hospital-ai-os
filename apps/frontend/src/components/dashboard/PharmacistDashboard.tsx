'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Pill, CheckSquare, AlertOctagon, RefreshCw, ArrowUpRight, Check } from 'lucide-react';
import type { TaskResponse } from 'shared';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { ROLE_DISPLAY_NAMES } from '../../utils/rbac';
import { taskService } from '../../services/task-service';
import { Card, CardContent } from '../ui/Card/Card';
import { Badge } from '../ui/Badge/Badge';
import { AlertBanner } from '../ui/Alert/AlertBanner';
import { MetricCard } from '../ui/MetricCard/MetricCard';
import { Table, THead, TH, TBody, TR, TD, TableSkeleton } from '../ui/Table/Table';
import styles from './DashboardShell.module.css';

export function PharmacistDashboard() {
  const { user } = useAuth();
  const notifications = useNotifications(40);
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const mounted = useRef(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const taskRes = await taskService.listTasks({ page: 1, pageSize: 25 });
      if (!mounted.current) return;
      setTasks(taskRes.data);
      setNow(new Date());
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

  const criticalItems = notifications.items.filter(
    (n) => n.priority === 'critical' && n.status !== 'acknowledged',
  );

  return (
    <div className={styles.dashboardContainer}>
      <header className={styles.greetingBanner}>
        <div>
          <h1 className={styles.greetingTitle}>
            <span className={styles.greetingIcon} aria-hidden="true">💊</span>
            Clinical Pharmacy — {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}` : 'Pharmacist'}
          </h1>
          <p className={styles.greetingSubtitle}>
            {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {' · '}
            {ROLE_DISPLAY_NAMES.pharmacist} Workspace
          </p>
        </div>
        <div className={styles.greetingMeta}>
          <span className={styles.livePill}><span className={styles.liveDot} aria-hidden="true" />Active</span>
          <button type="button" className={styles.refreshButton} onClick={() => void loadData()}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {/* Metrics */}
      <section aria-label="Pharmacy metrics" className={styles.metricRow}>
        <MetricCard
          label="Pending Pharmacy Tasks"
          icon={<CheckSquare size={16} aria-hidden="true" />}
          tone="info"
          href="/tasks"
          value={loading ? '—' : tasks.filter((t) => t.status !== 'completed').length}
          hint="Verification and medication preparation"
        />
        <MetricCard
          label="Critical Clinical Alerts"
          icon={<AlertOctagon size={16} aria-hidden="true" />}
          tone={criticalItems.length > 0 ? 'critical' : 'success'}
          href="/notifications"
          value={notifications.isLoading ? '—' : criticalItems.length}
          hint={criticalItems.length === 0 ? 'No critical drug alerts' : 'Immediate review required'}
        />
        <MetricCard
          label="Total Tasks Managed"
          icon={<Pill size={16} aria-hidden="true" />}
          tone="primary"
          href="/tasks"
          value={loading ? '—' : tasks.length}
          hint="Assigned in this window"
        />
      </section>

      {/* Pharmacy Tasks Queue */}
      <Card elevation="xs" padding="none" className={styles.tableCard}>
        <div className={styles.sectionCardHeader}>
          <div className={styles.sectionHeaderTitle}>
            <h3>Pharmacy Task Inbox</h3>
            <p>Direct pharmacy orders and medication verification</p>
          </div>
          <Link href="/tasks" className={styles.viewAllLink}>
            Open task manager <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <TableSkeleton rows={5} />
        ) : error ? (
          <CardContent>
            <AlertBanner severity="warning" title="Could not load tasks">
              {error}
            </AlertBanner>
          </CardContent>
        ) : tasks.length === 0 ? (
          <CardContent>
            <p className={styles.quietEmpty}>No active tasks in your pharmacy inbox.</p>
          </CardContent>
        ) : (
          <Table ariaLabel="Pharmacy Tasks">
            <THead>
              <tr>
                <TH>Task Title</TH>
                <TH>Type</TH>
                <TH>Priority</TH>
                <TH>Status</TH>
                <TH align="right">Action</TH>
              </tr>
            </THead>
            <TBody>
              {tasks.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <span style={{ fontWeight: 600 }}>{t.title}</span>
                    {t.description && (
                      <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-neutral-500)' }}>
                        {t.description}
                      </span>
                    )}
                  </TD>
                  <TD>
                    <Badge variant="neutral" size="sm">
                      {t.taskType}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge variant={t.priority === 'critical' ? 'critical' : t.priority === 'high' ? 'urgent' : 'neutral'} size="sm">
                      {t.priority.toUpperCase()}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge variant={t.status === 'completed' ? 'stable' : t.status === 'in_progress' ? 'info' : 'neutral'} size="sm">
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </TD>
                  <TD align="right">
                    {t.status !== 'completed' ? (
                      <button
                        type="button"
                        className={styles.refreshButton}
                        disabled={completingTaskId === t.id}
                        onClick={() => void handleCompleteTask(t.id)}
                        style={{ padding: '4px 10px', fontSize: '0.8125rem' }}
                      >
                        <Check size={12} aria-hidden="true" />
                        {completingTaskId === t.id ? 'Saving…' : 'Complete'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-success-main)' }}>Done</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
