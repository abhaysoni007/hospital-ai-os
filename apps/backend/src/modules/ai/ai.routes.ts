import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { aiController } from './ai.controller';

/**
 * M12 AI capability routes (ADR-017/018/019).
 * Chain: authentication → ai_interaction:invoke → ADR-018 capability gate
 * (inside the capability service) → authorized context assembly → orchestrator.
 * Request bodies are parsed in the controller via shared Zod contracts
 * (established module pattern).
 */
export const aiRoutes = Router();

aiRoutes.use(authMiddleware);

aiRoutes.post(
  '/note-draft',
  requirePermission('ai_interaction:invoke'),
  aiController.createNoteDraft.bind(aiController),
);

aiRoutes.patch(
  '/interactions/:id/action',
  requirePermission('ai_interaction:invoke'),
  aiController.interactionAction.bind(aiController),
);
