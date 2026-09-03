import { Request, Response, NextFunction } from 'express';
import {
  analyzeHospitalIntelligenceRequestSchema,
  approveRecommendationRequestSchema,
  rejectRecommendationRequestSchema,
} from 'shared';
import { hospitalIntelligenceService } from './hospital-intelligence.service';

/**
 * M19.1 — Hospital Intelligence Controller
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §15
 */
export class HospitalIntelligenceController {
  async analyze(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = analyzeHospitalIntelligenceRequestSchema.parse(req.body ?? {});
      const actor = {
        staffId: req.user!.staffId,
        role: req.user!.role,
        departmentId: req.user!.departmentId,
      };
      const correlationId = (req as unknown as { correlationId?: string }).correlationId ?? crypto.randomUUID();

      const result = await hospitalIntelligenceService.analyzeHospitalOperations(
        parsedBody,
        actor,
        correlationId,
      );

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getSignals(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = {
        staffId: req.user!.staffId,
        role: req.user!.role,
        departmentId: req.user!.departmentId,
      };
      const scope = req.query.scope as string | undefined;

      const signals = await hospitalIntelligenceService.getSignals(actor, scope);
      res.status(200).json({ data: signals });
    } catch (err) {
      next(err);
    }
  }

  async getSignalById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actor = {
        staffId: req.user!.staffId,
        role: req.user!.role,
        departmentId: req.user!.departmentId,
      };
      const signalId = req.params.id;

      const signal = await hospitalIntelligenceService.getSignalById(signalId, actor);
      if (!signal) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: `Signal ${signalId} not found` },
        });
        return;
      }

      res.status(200).json({ data: signal });
    } catch (err) {
      next(err);
    }
  }

  async approveRecommendation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = approveRecommendationRequestSchema.parse(req.body ?? {});
      const actor = {
        staffId: req.user!.staffId,
        role: req.user!.role,
        departmentId: req.user!.departmentId,
      };
      const recommendationId = req.params.id;
      const correlationId = (req as unknown as { correlationId?: string }).correlationId ?? crypto.randomUUID();

      const result = await hospitalIntelligenceService.approveRecommendation(
        recommendationId,
        parsedBody.idempotencyKey,
        actor,
        correlationId,
      );

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async rejectRecommendation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsedBody = rejectRecommendationRequestSchema.parse(req.body ?? {});
      const actor = {
        staffId: req.user!.staffId,
        role: req.user!.role,
        departmentId: req.user!.departmentId,
      };
      const recommendationId = req.params.id;
      const correlationId = (req as unknown as { correlationId?: string }).correlationId ?? crypto.randomUUID();

      const result = await hospitalIntelligenceService.rejectRecommendation(
        recommendationId,
        parsedBody.rejectionReason,
        actor,
        correlationId,
      );

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const hospitalIntelligenceController = new HospitalIntelligenceController();
