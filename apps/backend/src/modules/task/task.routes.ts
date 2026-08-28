import { Router } from 'express';
import { taskController } from './task.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { rateLimitMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(authMiddleware);
router.use(rateLimitMiddleware);

// All authenticated roles with task:read can list and read their own tasks
router.get('/', requirePermission('task:read'), taskController.listTasks.bind(taskController));
router.get('/:id', requirePermission('task:read'), taskController.getTask.bind(taskController));

// Mutations require task:update (physician, nurse, pharmacist, lab_technician — see M5)
router.post(
  '/:id/acknowledge',
  requirePermission('task:update'),
  taskController.acknowledgeTask.bind(taskController),
);
router.post(
  '/:id/complete',
  requirePermission('task:update'),
  taskController.completeTask.bind(taskController),
);
router.post(
  '/:id/reassign',
  requirePermission('task:update'),
  taskController.reassignTask.bind(taskController),
);
router.post(
  '/:id/escalate',
  requirePermission('task:update'),
  taskController.escalateTask.bind(taskController),
);

export const taskRoutes = router;
