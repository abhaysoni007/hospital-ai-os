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
import { AlertBanner } from '../../components/ui/Alert/AlertBanner';
import { Badge } from '../../components/ui/Badge/Badge';
import { Tabs, Tab } from '../../components/ui/Tabs/Tabs';
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
import {
  TaskPriorityBadge,
  TaskStatusBadge,
} from '../../components/ui/SemanticBadges/SemanticBadges';
import { taskService } from '../../services/task-service';
import { getStaffIdentities } from '../../services/staff-service';
import type { TaskResponse, TaskStatusEnum } from 'shared';
import { parseApiError, ParsedError } from '../../utils/error-parser';
import { hasPermission } from '../../utils/rbac';
import styles from './tasks.module.css';

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'created', label: 'Created' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function TasksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ParsedError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [status, setStatus] = useState('');
  const [scope, setScope] = useState<'me' | 'department' | 'hospital'>('me');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reassign modal state
  const [reassignTask, setReassignTask] = useState<TaskResponse | null>(null);
  const [newAssignee, setNewAssignee] = useState<string>('');
  const [departmentStaff, setDepartmentStaff] = useState<{ value: string; label: string }[]>([]);
  const [departmentStaffError, setDepartmentStaffError] = useState(false);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});

  // Escalate modal state
  const [escalateTask, setEscalateTask] = useState<TaskResponse | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await taskService.listTasks({
        page: 1,
        pageSize: 100,
        status: (status || undefined) as TaskStatusEnum | undefined,
        scope,
      });
      setTasks(response.data);

      // Resolve assignee identities through the cached M12.2 projection.
      // Names that cannot be resolved render as "—", never "Loading...".
      const assignees = [
        ...new Set(response.data.map((t) => t.assignedTo).filter((id): id is string => !!id)),
      ].slice(0, 50);
      if (assignees.length > 0) {
        try {
          const identities = await getStaffIdentities(assignees);
          setStaffMap((prev) => {
            const next = { ...prev };
            identities.forEach((identity, id) => {
              next[id] = identity.displayName;
            });
            return next;
          });
        } catch {
          // Cells fall back to "—"; the queue itself stays usable.
        }
      }
    } catch (err: unknown) {
      setError(parseApiError(err));
    } finally {
      setLoading(false);
    }
  }, [status, scope]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (
      user &&
      ['physician', 'nurse', 'lab_technician', 'pharmacist', 'receptionist'].includes(user.role)
    ) {
      import('../../services/api-client').then(({ apiClient }) => {
        apiClient<{ data: { id: string; displayName: string; role: string }[] }>(
          '/staff/department',
        )
          .then((res) => {
            const opts = res.data.map((s: { id: string; displayName: string; role: string }) => ({
              value: s.id,
              label: `${s.displayName} (${s.role.replace('_', ' ')})`,
            }));
            setDepartmentStaff(opts);
            setDepartmentStaffError(false);
            if (opts.length > 0) setNewAssignee((current) => current || opts[0].value);
          })
          .catch(() => setDepartmentStaffError(true));
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
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setActionError(
        parsed.requestId
          ? `${parsed.message} (Incident ID: ${parsed.requestId})`
          : parsed.message,
      );
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
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setActionError(
        parsed.requestId
          ? `${parsed.message} (Incident ID: ${parsed.requestId})`
          : parsed.message,
      );
    } finally {
      setActionLoading(null);
    }
  };

  const submitReassign = async () => {
    if (!reassignTask) return;
    setActionError(null);
    setActionLoading(reassignTask.id);
    try {
      await taskService.reassignTask(reassignTask.id, newAssignee);
      setReassignTask(null);
      await fetchTasks();
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setActionError(
        parsed.requestId
          ? `${parsed.message} (Incident ID: ${parsed.requestId})`
          : parsed.message,
      );
      setReassignTask(null);
    } finally {
      setActionLoading(null);
    }
  };

  const submitEscalate = async () => {
    if (!escalateTask) return;
    setActionError(null);
    setActionLoading(escalateTask.id);
    try {
      await taskService.escalateTask(escalateTask.id);
      setEscalateTask(null);
      await fetchTasks();
    } catch (err: unknown) {
      const parsed = parseApiError(err);
      setActionError(
        parsed.requestId
          ? `${parsed.message} (Incident ID: ${parsed.requestId})`
          : parsed.message,
      );
      setEscalateTask(null);
    } finally {
      setActionLoading(null);
    }
  };

  const canReadDx =
    hasPermission(user?.role, 'diagnostic_order:read') ||
    hasPermission(user?.role, 'diagnostic_result:read');
  const canReadEncounter = hasPermission(user?.role, 'encounter:read');

  /** Navigation target for a task's clinical context, if one exists and user has permission. */
  const taskContextHref = (task: TaskResponse): string | null => {
    if (task.referenceType === 'DiagnosticOrder' && task.referenceId && canReadDx) {
      return `/diagnostics/${task.referenceId}?taskId=${task.id}`;
    }
    if (task.encounterId && canReadEncounter) return `/encounters/${task.encounterId}`;
    return null;
  };

  const isOverdue = (task: TaskResponse) => {
    if (!task.dueAt) return false;
    return (
      new Date(task.dueAt) < new Date() &&
      task.status !== 'completed' &&
      task.status !== 'cancelled'
    );
  };

  const getPageTitle = () => {
    if (scope === 'me') return 'My Work';
    if (scope === 'department') return 'Department Queue';
    return 'Hospital Queue';
  };

  const showDepartmentTab =
    user &&
    ['physician', 'nurse', 'lab_technician', 'pharmacist', 'receptionist'].includes(user.role);
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
            <div className={styles.headerControls}>
              <Tabs
                value={scope}
                onValueChange={(v) => setScope(v as typeof scope)}
                variant="pills"
                ariaLabel="Task queue scope"
                className={styles.scopeTabs}
              >
                <Tab value="me">My Work</Tab>
                {showDepartmentTab && <Tab value="department">Department Queue</Tab>}
                {showHospitalTab && <Tab value="hospital">Hospital Queue</Tab>}
              </Tabs>
              <Select
                id="status"
                label="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={STATUS_FILTERS.filter((o) => o.value !== '')}
                placeholder="All statuses"
                className={styles.statusSelect}
              />
            </div>
          }
        />

        {/* Tactical Task Metric Grid */}
        <div className={styles.statGrid}>
          <div className={`${styles.statCard} ${tasks.filter(isOverdue).length > 0 ? styles.statCardCritical : ''}`}>
            <div className={styles.statLabel}>
              <span className="tacticalDot danger" />
              Overdue Escalations
            </div>
            <div className={`${styles.statVal} ${styles.statValRose}`}>
              {tasks.filter(isOverdue).length}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <span className="tacticalDot warning" />
              In Progress
            </div>
            <div className={`${styles.statVal} ${styles.statValAmber}`}>
              {tasks.filter((t) => t.status === 'in_progress' || t.status === 'assigned').length}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <span className="tacticalDot cyan" />
              Awaiting Action
            </div>
            <div className={`${styles.statVal} ${styles.statValCyan}`}>
              {tasks.filter((t) => t.status === 'created' || t.status === 'awaiting_approval').length}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>
              <span className="tacticalDot success" />
              Resolved &amp; Closed
            </div>
            <div className={`${styles.statVal} ${styles.statValEmerald}`}>
              {tasks.filter((t) => t.status === 'completed').length}
            </div>
          </div>
        </div>

        {actionError && (
          <AlertBanner
            severity="critical"
            title="Action failed"
            dismissible
            onDismiss={() => setActionError(null)}
          >
            {actionError}
          </AlertBanner>
        )}

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState
            title={error.title}
            message={error.message}
            correlationId={error.requestId}
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
                <TH width="140px">Due</TH>
                <TH width="150px">Status</TH>
                <TH aria-label="Actions" />
              </tr>
            </THead>
            <TBody>
              {tasks.map((task) => {
                const contextHref = taskContextHref(task);
                return (
                  <TR
                    key={task.id}
                    interactive={!!contextHref}
                    onClick={contextHref ? () => router.push(contextHref) : undefined}
                    aria-label={contextHref ? `Open task context: ${task.title}` : undefined}
                  >
                    <TD>
                      <div className={styles.titleCell}>
                        <strong>{task.title}</strong>
                        {isOverdue(task) && (
                          <Badge variant="critical" size="sm" icon={<AlertCircle size={11} />}>
                            Overdue
                          </Badge>
                        )}
                      </div>
                      {task.description && (
                        <div className={styles.titleDescription}>{task.description}</div>
                      )}
                    </TD>
                    <TD>
                      <TaskPriorityBadge priority={task.priority} size="sm" />
                    </TD>
                    <TD>{task.assignedTo ? (staffMap[task.assignedTo] ?? '—') : 'Unassigned'}</TD>
                    <TD>
                      {new Date(task.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TD>
                    <TD>
                      {task.dueAt
                        ? new Date(task.dueAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </TD>
                    <TD>
                      <TaskStatusBadge status={task.status} size="sm" />
                    </TD>
                    <TD align="right">
                      <div className={styles.rowActions}>
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
                        {task.assignedTo === user?.id &&
                          !['completed', 'cancelled'].includes(task.status) && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReassignTask(task);
                                }}
                              >
                                Reassign
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEscalateTask(task);
                                }}
                                disabled={task.priority === 'critical'}
                              >
                                Escalate
                              </Button>
                            </>
                          )}
                        {['completed', 'cancelled'].includes(task.status) && contextHref && (
                          <RowLink href={contextHref} aria-label="View task context">
                            View context
                          </RowLink>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}

        <ConfirmDialog
          isOpen={!!reassignTask}
          title={`Reassign task: ${reassignTask?.title ?? ''}`}
          confirmLabel="Reassign"
          onConfirm={submitReassign}
          onCancel={() => setReassignTask(null)}
          isLoading={actionLoading === reassignTask?.id}
        >
          <div className={styles.dialogBody}>
            <p>Select a staff member within your department to reassign this task to.</p>
            {departmentStaff.length > 0 ? (
              <Select
                id="newAssignee"
                label="New assignee"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                options={departmentStaff}
              />
            ) : (
              <p className={styles.dialogNote} role="status">
                {departmentStaffError
                  ? 'The department staff list could not be loaded. Close this dialog and try again.'
                  : 'No department staff are available for reassignment.'}
              </p>
            )}
          </div>
        </ConfirmDialog>

        <ConfirmDialog
          isOpen={!!escalateTask}
          title={`Escalate task: ${escalateTask?.title ?? ''}`}
          confirmLabel="Escalate to critical"
          variant="danger"
          onConfirm={submitEscalate}
          onCancel={() => setEscalateTask(null)}
          isLoading={actionLoading === escalateTask?.id}
        >
          <p>
            Are you sure you want to escalate this task? This will set the priority to{' '}
            <strong>critical</strong> and notify the supervisor or assigner.
          </p>
        </ConfirmDialog>
      </div>
    </AppShell>
  );
}
