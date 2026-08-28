import { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { encounters } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { AuthorizationError } from 'shared/src/errors/AppError';
import { authorizeBreakGlassResourceAccess } from '../../middleware/rbac/resource-auth';
import { ClinicalIntelligenceService } from './intelligence.service';
import { aiOrchestrator } from '../ai/ai.container';

const intelligenceService = new ClinicalIntelligenceService(aiOrchestrator);

async function checkPatientScope(patientId: string, departmentId: string, role: string) {
  if (role === 'hospital_admin') return true;
  
  // Normal scope: clinician must have at least one encounter with the patient in their department
  const enc = await db.query.encounters.findFirst({
    where: and(
      eq(encounters.patientId, patientId),
      eq(encounters.departmentId, departmentId)
    )
  });

  if (!enc) {
    throw new AuthorizationError('Patient has no records in your department. Break-glass emergency access required.');
  }
  return true;
}

export class ClinicalIntelligenceController {
  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId;
      const actor = req.user!;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      await authorizeBreakGlassResourceAccess(
        { id: actor.staffId, role: actor.role, departmentId: actor.departmentId },
        patientId,
        'read',
        () => checkPatientScope(patientId, actor.departmentId, actor.role)
      );

      const timeline = await intelligenceService.getClinicalTimeline(patientId, limit);
      res.json(timeline);
    } catch (err) {
      next(err);
    }
  }

  async generateChartBrief(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId;
      const question = req.body.question;
      const actor = req.user!;

      await authorizeBreakGlassResourceAccess(
        { id: actor.staffId, role: actor.role, departmentId: actor.departmentId },
        patientId,
        'read',
        () => checkPatientScope(patientId, actor.departmentId, actor.role)
      );

      const brief = await intelligenceService.generateChartBrief(
        patientId,
        { staffId: actor.staffId, role: actor.role, departmentId: actor.departmentId },
        question
      );
      res.json(brief);
    } catch (err) {
      next(err);
    }
  }

  async getDiagnosticTrend(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId;
      const testCode = req.params.testCode;
      const actor = req.user!;

      await authorizeBreakGlassResourceAccess(
        { id: actor.staffId, role: actor.role, departmentId: actor.departmentId },
        patientId,
        'read',
        () => checkPatientScope(patientId, actor.departmentId, actor.role)
      );

      const points = await intelligenceService.getDiagnosticTrend(patientId, testCode);
      res.json({ patientId, testCode, points });
    } catch (err) {
      next(err);
    }
  }
}

export const intelligenceController = new ClinicalIntelligenceController();
