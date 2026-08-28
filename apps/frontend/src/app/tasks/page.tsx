'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Select } from '../../components/ui/Input/Select';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState/ErrorState';
import {
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
  RowLink,
  TableSkeleton,
} from '../../components/ui/Table/Table';
import { Button } from '../../components/ui/Button/Button';
import { taskService } from '../../services/task-service';
import type { TaskResponse, TaskStatusEnum } from 'shared';
import styles from './tasks.module.css';

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await taskService.listTasks({
        page: 1,
        pageSize: 100,
        status: (status || undefined) as TaskStatusEnum | undefined,
      });
      setTasks(response.data);
    } catch {
      setError('The task service did not respond. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const handleAcknowledge = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionError(null);
    setActionLoading(id);
    try {
      await taskService.acknowledgeTask(id);
      await fetchTasks();
    } catch {
      setActionError('Failed to acknowledge task. It may have already been updated.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionError(null);
    setActionLoading(id);
    try {
      await taskService.completeTask(id);
      await fetchTasks();
    } catch {
      setActionError('Failed to complete task. It may have already been updated.');
    } finally {
      setActionLoading(null);
    }
  };

  const navigateToTask = (task: TaskResponse) => {
    if (task.referenceType === 'DiagnosticOrder' && task.referenceId) {
      router.push(`/diagnostics/${task.referenceId}`);
    } else if (task.encounterId) {
      router.push(`/encounters/${task.encounterId}`);
    }
  };

  return (
    <AppShell breadcrumbs={['Workspace', 'My Work']} requiredPermission="task:read">
      <div className={styles.container}>
        <PageHeader
          title="My Work"
          description="Tasks assigned to you that require your attention."
          meta={
            <Select
              id="status"
              label="Filter by status"
              placeholder="All statuses"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'created', label: 'Created' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
              ]}
              className={styles.statusSelect}
            />
          }
        />

        {actionError && (
          <div className={styles.actionError} role="alert">
            {actionError}
            <button
              type="button"
              className={styles.actionErrorDismiss}
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState
            title="Could not load tasks"
            message={error}
            onRetry={() => void fetchTasks()}
          />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<CheckSquare size={32} />}
            title={status ? `No ${status.replace('_', ' ')} tasks` : 'No tasks assigned to you'}
            description={
              status
                ? 'Nothing matches this filter right now.'
                : 'You are all caught up! New clinical actions will appear here.'
            }
          />
        ) : (
          <Table ariaLabel="Tasks">
            <THead>
              <tr>
                <TH>Title</TH>
                <TH width="120px">Priority</TH>
                <TH width="140px">Created</TH>
                <TH width="140px">Status</TH>
                <TH aria-label="Actions" />
              </tr>
            </THead>
            <TBody>
              {tasks.map((task) => (
                <TR
                  key={task.id}
                  interactive
                  onClick={() => navigateToTask(task)}
                  aria-label={`Open task: ${task.title}`}
                >
                  <TD>
                    <strong>{task.title}</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {task.description}
                    </div>
                  </TD>
                  <TD className={styles.capitalize}>{task.priority}</TD>
                  <TD>
                    {new Date(task.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TD>
                  <TD className={styles.capitalize}>{task.status.replace('_', ' ')}</TD>
                  <TD align="right">
                    <div className={styles.actions}>
                      {task.status === 'created' && (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={actionLoading === task.id}
                          onClick={(e) => handleAcknowledge(e, task.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {task.status === 'in_progress' && (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={actionLoading === task.id}
                          onClick={(e) => handleComplete(e, task.id)}
                        >
                          Complete
                        </Button>
                      )}
                      {(task.status === 'completed' || task.status === 'cancelled') && (
                        <RowLink href="#" onClick={(e) => { e.preventDefault(); navigateToTask(task); }} aria-label={`View task context`}>
                          View Details
                        </RowLink>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </AppShell>
  );
}
