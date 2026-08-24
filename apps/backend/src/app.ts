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
// M5 Authorization test probe — infrastructure/testing ONLY, no business logic
import { authorizationProbeRoutes } from './modules/authorization-probe/probe.routes';

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
// M5 test infrastructure only — no business logic, no patient data
app.use('/api/v1/_test/authz-probe', authorizationProbeRoutes);

// 6. global error handler
app.use(errorHandlerMiddleware);
