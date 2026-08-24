import { Router } from 'express';
import { patientController } from './patient.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

export const patientRoutes = Router();

// All patient endpoints require authentication
patientRoutes.use(authMiddleware);

// Registration requires 'patient:create'
patientRoutes.post(
  '/',
  requirePermission('patient:create'),
  patientController.registerPatient.bind(patientController)
);

// Search/View requires 'patient:read'
patientRoutes.get(
  '/',
  requirePermission('patient:read'),
  patientController.searchPatients.bind(patientController)
);

patientRoutes.get(
  '/:id',
  requirePermission('patient:read'),
  patientController.getPatientById.bind(patientController)
);
