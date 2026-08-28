import { z } from 'zod';
import { offsetPaginationSchema } from './pagination';

// Enums matching DB
export const TaskType = z.enum(['lab_review', 'discharge_draft', 'critical_alert', 'general']);
export type TaskTypeEnum = z.infer<typeof TaskType>;

export const TaskPriority = z.enum(['low', 'medium', 'high', 'critical']);
export type TaskPriorityEnum = z.infer<typeof TaskPriority>;

export const TaskStatus = z.enum([
  'created',
  'assigned',
  'in_progress',
  'awaiting_approval',
  'completed',
  'cancelled',
]);
export type TaskStatusEnum = z.infer<typeof TaskStatus>;

export const taskResponseSchema = z.object({
  id: z.string().uuid(),
  taskType: TaskType,
  title: z.string(),
  description: z.string().nullable().optional(),
  priority: TaskPriority,
  status: TaskStatus,
  patientId: z.string().uuid().nullable(),
  encounterId: z.string().uuid().nullable(),
  referenceType: z.string().nullable(),
  referenceId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskResponse = z.infer<typeof taskResponseSchema>;

export const getTasksQuerySchema = offsetPaginationSchema.extend({
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  taskType: TaskType.optional(),
});
export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>;

export const taskListResponseSchema = z.object({
  data: z.array(taskResponseSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;
