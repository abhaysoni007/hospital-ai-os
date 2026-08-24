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
  patientController.registerPatient.bind(patientController),
);

// Search/View requires 'patient:read'
patientRoutes.get(
  '/',
  requirePermission('patient:read'),
  patientController.searchPatients.bind(patientController),
);

patientRoutes.get(
  '/:id',
  requirePermission('patient:read'),
  patientController.getPatientById.bind(patientController),
);

// Demographics update requires 'patient:update'
patientRoutes.patch(
  '/:id',
  requirePermission('patient:update'),
  patientController.updatePatient.bind(patientController),
);

// Identity document registration requires 'patient:create' (per API contract)
patientRoutes.post(
  '/:id/identities',
  requirePermission('patient:create'),
  patientController.addIdentity.bind(patientController),
);

// Identity verification requires 'patient:verify_identity'
patientRoutes.patch(
  '/:id/identities/:identityId',
  requirePermission('patient:verify_identity'),
  patientController.verifyIdentity.bind(patientController),
);
