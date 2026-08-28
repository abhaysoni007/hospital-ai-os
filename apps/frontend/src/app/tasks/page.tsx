'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckSquare, AlertCircle } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Select } from '../../components/ui/Input/Select';
import { PageHeader } from '../../components/ui/PageHeader/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState/ErrorState';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog/ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
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

// DEMO_STAFF removed; we now fetch live department staff

export default function TasksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
  const [status, setStatus] = useState('');
  const [scope, setScope] = useState<'me' | 'department' | 'hospital'>('me');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reassign Modal State
  const [reassignTask, setReassignTask] = useState<TaskResponse | null>(null);
  const [newAssignee, setNewAssignee] = useState<string>('');
  const [departmentStaff, setDepartmentStaff] = useState<{ value: string; label: string }[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});

  // Escalate Modal State
  const [escalateTask, setEscalateTask] = useState<TaskResponse | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pass the selected scope to the API.
      const response = await taskService.listTasks({
        page: 1,
        pageSize: 100,
        status: (status || undefined) as TaskStatusEnum | undefined,
        scope,
      });
      setTasks(response.data);

      // Fetch identities for all assignees
      const assignees = response.data
        .map((t) => t.assignedTo)
        .filter((id): id is string => !!id);
      
      const uniqueAssignees = [...new Set(assignees)];
      if (uniqueAssignees.length > 0) {
        const { apiClient } = await import('../../services/api-client');
        try {
          const idResponse = await apiClient<{ data: { id: string; displayName: string }[] }>(`/staff/identity?ids=${uniqueAssignees.slice(0, 50).join(',')}`);
          setStaffMap(prev => {
            const next = { ...prev };
            idResponse.data.forEach((staff: { id: string; displayName: string }) => {
              next[staff.id] = staff.displayName;
            });
            return next;
          });
        } catch (e) {
          console.error('Failed to fetch staff identities', e);
        }
      }
    } catch {
      setError('The task service did not respond. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [status, scope]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (user && ['physician', 'nurse', 'lab_technician', 'pharmacist', 'receptionist'].includes(user.role)) {
      import('../../services/api-client').then(({ apiClient }) => {
        apiClient<{ data: { id: string; displayName: string; role: string }[] }>('/staff/department').then(res => {
          const opts = res.data.map((s: { id: string; displayName: string; role: string }) => ({
            value: s.id,
            label: `${s.displayName} (${s.role.replace('_', ' ')})`
          }));
          setDepartmentStaff(opts);
          if (opts.length > 0) setNewAssignee(opts[0].value);
        }).catch(() => {});
      });
    }
  }, [user]);

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

  const submitReassign = async () => {
    if (!reassignTask) return;
    setActionError(null);
    setActionLoading(reassignTask.id);
    try {
      const { apiClient } = await import('../../services/api-client');
      await apiClient(`/tasks/${reassignTask.id}/reassign`, {
        method: 'POST',
        body: { newAssigneeId: newAssignee },
      });
      setReassignTask(null);
      await fetchTasks();
    } catch {
      setActionError('Failed to reassign task. Please try again.');
    } finally {
      setActionLoading(null);
      setReassignTask(null);
    }
  };

  const submitEscalate = async () => {
    if (!escalateTask) return;
    setActionError(null);
    setActionLoading(escalateTask.id);
    try {
      const { apiClient } = await import('../../services/api-client');
      await apiClient(`/tasks/${escalateTask.id}/escalate`, {
        method: 'POST',
      });
      setEscalateTask(null);
      await fetchTasks();
    } catch {
      setActionError('Failed to escalate task.');
    } finally {
      setActionLoading(null);
      setEscalateTask(null);
    }
  };

  const navigateToTask = (task: TaskResponse) => {
    if (task.referenceType === 'DiagnosticOrder' && task.referenceId) {
      router.push(`/diagnostics/${task.referenceId}?taskId=${task.id}`);
    } else if (task.encounterId) {
      router.push(`/encounters/${task.encounterId}`);
    }
  };

  const isOverdue = (task: TaskResponse) => {
    if (!task.dueAt) return false;
    return new Date(task.dueAt) < new Date() && task.status !== 'completed' && task.status !== 'cancelled';
  };

  const getPageTitle = () => {
    if (scope === 'me') return 'My Work';
    if (scope === 'department') return 'Department Queue';
    if (scope === 'hospital') return 'Hospital Queue';
    return 'My Work';
  };

  const showDepartmentTab = user && ['physician', 'nurse', 'lab_technician', 'pharmacist', 'receptionist'].includes(user.role);
  const showHospitalTab = user?.role === 'hospital_admin';

  return (
    <AppShell breadcrumbs={['Workspace', getPageTitle()]} requiredPermission="task:read">
      <div className={styles.container}>
        <PageHeader
          title={getPageTitle()}
          description={
            scope === 'me'
              ? 'Tasks assigned to you that require your attention.'
              : 'Operational view of clinical tasks.'
          }
          meta={
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div className={styles.tabs} style={{ display: 'flex', gap: '0.5rem', marginBottom: '4px' }}>
                <Button variant={scope === 'me' ? 'primary' : 'secondary'} size="sm" onClick={() => setScope('me')}>My Work</Button>
                {showDepartmentTab && (
                  <Button variant={scope === 'department' ? 'primary' : 'secondary'} size="sm" onClick={() => setScope('department')}>Department Queue</Button>
                )}
                {showHospitalTab && (
                  <Button variant={scope === 'hospital' ? 'primary' : 'secondary'} size="sm" onClick={() => setScope('hospital')}>Hospital Queue</Button>
                )}
              </div>
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
            </div>
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
            title={status ? `No ${status.replace('_', ' ')} tasks` : 'No tasks found'}
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
                <TH width="160px">Assignee</TH>
                <TH width="140px">Created</TH>
                <TH width="140px">Due At</TH>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong>{task.title}</strong>
                      {isOverdue(task) && (
                        <span style={{ color: 'var(--color-danger-600)', display: 'flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: 600, gap: '2px' }}>
                          <AlertCircle size={12} /> OVERDUE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {task.description}
                    </div>
                  </TD>
                  <TD className={styles.capitalize}>
                    {task.priority === 'critical' ? (
                      <span style={{ color: 'var(--color-danger-600)', fontWeight: 600 }}>Critical</span>
                    ) : (
                      task.priority
                    )}
                  </TD>
                  <TD>
                    {task.assignedTo ? staffMap[task.assignedTo] || 'Loading...' : 'Unassigned'}
                  </TD>
                  <TD>
                    {new Date(task.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TD>
                  <TD>
                    {task.dueAt ? new Date(task.dueAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }) : '-'}
                  </TD>
                  <TD className={styles.capitalize}>{task.status.replace('_', ' ')}</TD>
                  <TD align="right">
                    <div className={styles.actions} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      {task.assignedTo === user?.id && task.status === 'created' && (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={actionLoading === task.id}
                          onClick={(e) => handleAcknowledge(e, task.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {task.assignedTo === user?.id && task.status === 'in_progress' && (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={actionLoading === task.id}
                          onClick={(e) => handleComplete(e, task.id)}
                        >
                          Complete
                        </Button>
                      )}
                      {task.assignedTo === user?.id && !['completed', 'cancelled'].includes(task.status) && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setReassignTask(task); }}
                          >
                            Reassign
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setEscalateTask(task); }}
                            disabled={task.priority === 'critical'}
                          >
                            Escalate
                          </Button>
                        </>
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

        <ConfirmDialog
          isOpen={!!reassignTask}
          title={`Reassign Task: ${reassignTask?.title}`}
          confirmLabel="Reassign"
          onConfirm={submitReassign}
          onCancel={() => setReassignTask(null)}
          isLoading={actionLoading === reassignTask?.id}
        >
          <div style={{ marginBottom: '1rem' }}>
            <p>Select a staff member within your department to reassign this task to.</p>
            <div style={{ marginTop: '1rem' }}>
              <Select
                id="newAssignee"
                label="New Assignee"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                options={departmentStaff}
              />
            </div>
          </div>
        </ConfirmDialog>

        <ConfirmDialog
          isOpen={!!escalateTask}
          title={`Escalate Task: ${escalateTask?.title}`}
          confirmLabel="Escalate to Critical"
          variant="danger"
          onConfirm={submitEscalate}
          onCancel={() => setEscalateTask(null)}
          isLoading={actionLoading === escalateTask?.id}
        >
          <p>
            Are you sure you want to escalate this task? This will set the priority to <strong>critical</strong> and notify the supervisor or assigner.
          </p>
        </ConfirmDialog>
      </div>
    </AppShell>
  );
}
