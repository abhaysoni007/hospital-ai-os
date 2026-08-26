import express from 'express';
import cookieParser from 'cookie-parser';
import { correlationIdMiddleware } from './middleware/correlation-id.middleware';
import {
  securityHeadersMiddleware,
  corsMiddleware,
  rateLimitMiddleware,
} from './middleware/security.middleware';
import { requestLogMiddleware } from './middleware/request-log.middleware';
import { errorHandlerMiddleware } from './middleware/error-handler.middleware';
import { healthRoutes } from './modules/health/health.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { auditRoutes } from './modules/audit/audit.routes';
import { patientRoutes } from './modules/patient/patient.routes';
import { appointmentRoutes } from './modules/appointment/appointment.routes';
import { encounterRoutes } from './modules/encounter/encounter.routes';
import { clinicalRoutes } from './modules/clinical/clinical.routes';
import { aiRoutes } from './modules/ai/ai.routes';
import {
  diagnosticEncounterRoutes,
  diagnosticOrderRoutes,
} from './modules/diagnostics/diagnostics.routes';
// M5 Authorization test probe — infrastructure/testing ONLY, no business logic
import { authorizationProbeRoutes } from './modules/authorization-probe/probe.routes';
import { config } from './config';

export const app = express();

// 1. request ID
app.use(correlationIdMiddleware);

// 2. logging (before rate limit per architecture)
app.use(requestLogMiddleware);

// 3. security
app.use(securityHeadersMiddleware);
app.use(corsMiddleware);

// 4. body parsing / limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(rateLimitMiddleware);

// 5. routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/encounters', encounterRoutes);
app.use('/api/v1/encounters/:encounterId/clinical-records', clinicalRoutes);
app.use('/api/v1/encounters/:encounterId/diagnostic-orders', diagnosticEncounterRoutes);
app.use('/api/v1/diagnostic-orders', diagnosticOrderRoutes);
app.use('/api/v1/ai', aiRoutes);
// M5 test infrastructure only — no business logic, no patient data.
// M12.1: mounted ONLY outside production (test/development environments).
if (config.NODE_ENV !== 'production') {
  app.use('/api/v1/_test/authz-probe', authorizationProbeRoutes);
}

// 6. global error handler
app.use(errorHandlerMiddleware);
