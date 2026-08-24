import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { auditEvents } from '../../db/schema/audit';
import { desc, and, eq, gte, lte } from 'drizzle-orm';
import { getAuditEventsQuerySchema } from 'shared';

export class AuditController {
  async getEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const query = getAuditEventsQuerySchema.parse(req.query);
      const page = query.page || 1;
      const limit = query.pageSize || 50;
      const offset = (page - 1) * limit;

      const conditions = [];

      if (query.actorId) conditions.push(eq(auditEvents.actorId, query.actorId));
      if (query.patientId) conditions.push(eq(auditEvents.patientId, query.patientId));
      if (query.eventType) conditions.push(eq(auditEvents.eventType, query.eventType));
      if (query.startDate) conditions.push(gte(auditEvents.createdAt, new Date(query.startDate)));
      if (query.endDate) conditions.push(lte(auditEvents.createdAt, new Date(query.endDate)));

      const results = await db.query.auditEvents.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(auditEvents.createdAt)],
        limit,
        offset,
      });

      const totalResult = await db.$count(
        auditEvents,
        conditions.length > 0 ? and(...conditions) : undefined
      );

      res.status(200).json({
        data: results,
        meta: {
          total: totalResult,
          page,
          limit,
          totalPages: Math.ceil(totalResult / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const auditController = new AuditController();
