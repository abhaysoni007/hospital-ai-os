import { Router } from 'express';
import { taskController } from './task.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { rateLimitMiddleware } from '../../middleware/security.middleware';

const router = Router();

router.use(authMiddleware);
router.use(rateLimitMiddleware);

// ALL roles can read tasks (server-scoped in service)
router.get('/', taskController.listTasks.bind(taskController));
router.get('/:id', taskController.getTask.bind(taskController));

// ONLY clinical roles can update tasks
router.post('/:id/acknowledge', taskController.acknowledgeTask.bind(taskController));

router.post('/:id/complete', taskController.completeTask.bind(taskController));

export const taskRoutes = router;
