import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { tasks } from '../../db/schema/tasks';
import { GetTasksQuery, TaskListResponse, TaskResponse } from 'shared';
import { ConflictError, NotFoundError } from 'shared/src/errors/AppError';
import { auditService } from '../audit/audit.service';

type AuthContext = { role: string; departmentId: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTaskResponse(row: any): TaskResponse {
  return {
    id: row.id,
    taskType: row.taskType,
    title: row.title,
    description: row.description ?? null,
    priority: row.priority,
    status: row.status,
    patientId: row.patientId ?? null,
    encounterId: row.encounterId ?? null,
    referenceType: row.referenceType ?? null,
    referenceId: row.referenceId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class TaskService {
  /**
   * Lists tasks scoped to the authenticated user.
   * Scope is purely server-derived (ADR-021).
   */
  async listTasks(
    query: GetTasksQuery,
    actorId: string,
    _authContext: AuthContext,
  ): Promise<TaskListResponse> {
    const page = query.page || 1;
    const limit = query.pageSize || 20;
    const offset = (page - 1) * limit;

    // Strict scope: assignedTo = actorId
    const conditions = [eq(tasks.assignedTo, actorId)];
    if (query.status) conditions.push(eq(tasks.status, query.status));
    if (query.priority) conditions.push(eq(tasks.priority, query.priority));
    if (query.taskType) conditions.push(eq(tasks.taskType, query.taskType));

    const where = and(...conditions);

    const rows = await db.query.tasks.findMany({
      where,
      orderBy: [desc(tasks.createdAt)],
      limit,
      offset,
    });

    const totalRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(where);
    const total = totalRows[0]?.count ?? 0;

    return {
      data: rows.map(toTaskResponse),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Gets a single task, scoped to the assignee. */
  async getTask(id: string, actorId: string): Promise<TaskResponse> {
    const row = await db.query.tasks.findFirst({
      where: and(eq(tasks.id, id), eq(tasks.assignedTo, actorId)),
    });
    if (!row) {
      throw new NotFoundError('Task not found', { code: 'TASK_NOT_FOUND' });
    }
    return toTaskResponse(row);
  }

  /**
   * Acknowledges a task: status created|assigned -> in_progress.
   * Optimistic concurrency via .for('update') row lock and strict transition guard.
   */
  async acknowledgeTask(
    id: string,
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ): Promise<TaskResponse> {
    return await db.transaction(async (tx) => {
      const rows = await tx.select().from(tasks).where(eq(tasks.id, id)).for('update');

      if (rows.length === 0 || rows[0].assignedTo !== actorId) {
        throw new NotFoundError('Task not found', { code: 'TASK_NOT_FOUND' });
      }

      const updated = await tx
        .update(tasks)
        .set({ status: 'in_progress', updatedAt: new Date() })
        .where(and(eq(tasks.id, id), inArray(tasks.status, ['created', 'assigned'])))
        .returning();

      if (updated.length === 0) {
        throw new ConflictError('Task cannot be acknowledged from its current state.', {
          code: 'INVALID_TRANSITION',
        });
      }

      const task = updated[0];

      await auditService.logEvent(
        {
          eventType: 'TASK_ACKNOWLEDGED',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'TASK',
          targetId: id,
          patientId: task.patientId ?? undefined,
          actionDetail: {
            taskType: task.taskType,
            priority: task.priority,
          },
        },
        correlationId,
        tx,
      );

      return toTaskResponse(task);
    });
  }

  /**
   * Completes a task: status in_progress -> completed.
   */
  async completeTask(
    id: string,
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ): Promise<TaskResponse> {
    return await db.transaction(async (tx) => {
      const rows = await tx.select().from(tasks).where(eq(tasks.id, id)).for('update');

      if (rows.length === 0 || rows[0].assignedTo !== actorId) {
        throw new NotFoundError('Task not found', { code: 'TASK_NOT_FOUND' });
      }

      const now = new Date();
      const updated = await tx
        .update(tasks)
        .set({ status: 'completed', completedAt: now, updatedAt: now })
        .where(and(eq(tasks.id, id), eq(tasks.status, 'in_progress')))
        .returning();

      if (updated.length === 0) {
        throw new ConflictError('Only in-progress tasks can be completed.', {
          code: 'INVALID_TRANSITION',
        });
      }

      const task = updated[0];

      await auditService.logEvent(
        {
          eventType: 'TASK_COMPLETED',
          actorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'TASK',
          targetId: id,
          patientId: task.patientId ?? undefined,
          actionDetail: {
            taskType: task.taskType,
          },
        },
        correlationId,
        tx,
      );

      return toTaskResponse(task);
    });
  }
}

export const taskService = new TaskService();
