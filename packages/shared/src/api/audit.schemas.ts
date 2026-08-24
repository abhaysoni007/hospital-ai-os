import { z } from 'zod';
import { offsetPaginationSchema } from './pagination';

export const createAuditEventSchema = z.object({
  eventType: z.string().max(100),
  actorId: z.string().uuid(),
  actorRole: z.string().max(50),
  actorDepartment: z.string().max(100),
  targetType: z.string().max(50).optional(),
  targetId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  actionDetail: z.record(z.string(), z.unknown()).optional(),
  justification: z.string().optional(),
  ipAddress: z.string().optional(),
});

export type CreateAuditEventRequest = z.infer<typeof createAuditEventSchema>;

export const auditEventResponseSchema = z.object({
  id: z.string().uuid(),
  sequenceNumber: z.number(),
  eventType: z.string(),
  actorId: z.string().uuid(),
  actorRole: z.string(),
  actorDepartment: z.string(),
  targetType: z.string().nullable().optional(),
  targetId: z.string().uuid().nullable().optional(),
  patientId: z.string().uuid().nullable().optional(),
  actionDetail: z.record(z.string(), z.unknown()).nullable().optional(),
  justification: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  correlationId: z.string().uuid(),
  previousHash: z.string(),
  recordHash: z.string(),
  createdAt: z.string(),
});

export type AuditEventResponse = z.infer<typeof auditEventResponseSchema>;

export const getAuditEventsQuerySchema = offsetPaginationSchema.extend({
  actorId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type GetAuditEventsQuery = z.infer<typeof getAuditEventsQuerySchema>;
