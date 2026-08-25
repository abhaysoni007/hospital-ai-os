import { Request, Response, NextFunction } from 'express';
import {
  aiInteractionActionRequestSchema,
  noteDraftRequestPrimitiveSchema,
  uuidSchema,
  AuthenticationError,
  NotFoundError,
  ValidationError,
} from 'shared';

import { aiOrchestrator } from './ai.container';
import { AiNoteDraftService } from './capabilities/note-draft.service';
import { aiInteractionRepository } from './ai.persistence';
import { AI_AUDIT_EVENTS, buildAiInteractionAuditEvent } from './ai.audit';
import { auditService } from '../audit/audit.service';

const noteDraftService = new AiNoteDraftService(aiOrchestrator);

function requireUser(req: Request) {
  const user = req.user;
  if (!user) throw new AuthenticationError('Unauthorized');
  return user;
}

function correlation(req: Request): string {
  return (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
}

export class AiController {
  /** POST /api/v1/ai/note-draft — M12 hero (ADR-018 gates inside the service). */
  async createNoteDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const request = noteDraftRequestPrimitiveSchema.parse(req.body);
      const result = await noteDraftService.draft(
        { staffId: user.staffId, role: user.role, departmentId: user.departmentId },
        {
          encounterId: request.encounterId,
          recordType: request.recordType,
          instructions: request.instructions || undefined,
        },
        correlation(req),
      );
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/ai/interactions/:id/action — reject / edit-flag ONLY.
   * Accept is atomic binding at clinical-record creation (ADR-019).
   */
  async interactionAction(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const id = uuidSchema.safeParse(req.params.id);
      if (!id.success)
        throw new ValidationError('Invalid interaction id.', { code: 'VALIDATION_ERROR' });
      const action = aiInteractionActionRequestSchema.parse(req.body);

      // B2-style ownership: foreign interactions are indistinguishable (404).
      const row = await aiInteractionRepository.findById(id.data);
      if (!row || row.initiatedBy !== user.staffId) {
        throw new NotFoundError('AI interaction not found', { code: 'INTERACTION_NOT_FOUND' });
      }

      if (action.action === 'edited') {
        await aiInteractionRepository.transitionGuarded(id.data, 'pending', 'edited');
        return res.status(200).json({ data: { id: id.data, userAction: 'edited' } });
      }

      const updated = await aiInteractionRepository.transitionGuarded(
        id.data,
        'pending',
        'rejected',
        {
          rejectionReasonCategory: `${action.reasonCategory}${action.reasonNote ? `: ${action.reasonNote}` : ''}`,
        },
      );
      if (updated === 0) {
        throw new ValidationError('Interaction is not in a pending state.', {
          code: 'INVALID_TRANSITION',
        });
      }
      await auditService.logEvent(
        buildAiInteractionAuditEvent({
          eventType: AI_AUDIT_EVENTS.DRAFT_REJECTED,
          actor: { staffId: user.staffId, role: user.role, departmentId: user.departmentId },
          interactionId: id.data,
          patientId: row.patientId,
          detail: {
            capability: row.interactionType,
            promptTemplateId: row.promptTemplateId ?? 'unknown',
            modelProvider: row.modelProvider,
            modelName: row.modelName,
            inputTokens: row.inputTokens,
            outputTokens: row.outputTokens,
            latencyMs: row.latencyMs,
            groundingStatus: row.groundingStatus,
          },
        }),
        correlation(req),
      );
      res.status(200).json({ data: { id: id.data, userAction: 'rejected' } });
    } catch (err) {
      next(err);
    }
  }
}

export const aiController = new AiController();
