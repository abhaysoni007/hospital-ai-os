import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { app } from '../../../app';
import { resolveKeyPath } from '../../auth/auth.service';
import { config } from '../../../config';
import type { StaffRole } from '../../../middleware/rbac/permissions';
import { auditService } from '../../audit/audit.service';
import { aiOrchestrator } from '../../ai/ai.container';
import { hospitalIntelligenceService } from '../hospital-intelligence.service';

// Mock audit logEvent to isolate route testing from DB locks
vi.spyOn(auditService, 'logEvent').mockResolvedValue();

// Mock AI orchestrator to prevent network timeouts during integration tests
vi.spyOn(aiOrchestrator, 'invokeStructured').mockResolvedValue({
  status: 'grounded',
  parsed: {
    summary: 'Operational bottleneck detected in hospital workflow.',
    clinicalImpact: 'May delay care delivery.',
    citations: [],
    disclaimers: ['Clinical governance review required.'],
    informationGaps: [],
    recommendation: {
      actionType: 'NOTIFY_ATTENDING_PHYSICIAN',
      rationale: 'Alert attending physician of operational delay.',
    },
  },
  failures: [],
  interactionId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
} as any);

function makeToken(role: StaffRole | string): string {
  const keyPath = resolveKeyPath(config.JWT_PRIVATE_KEY_PATH);
  const privateKey = fs.readFileSync(keyPath, 'utf-8');
  return jwt.sign(
    { sub: `synth-m19-${role}`, role, department_id: '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00' },
    privateKey,
    { algorithm: 'RS256', expiresIn: '15m' },
  );
}

const physicianToken = makeToken('physician');
const nurseToken = makeToken('nurse');
const receptionistToken = makeToken('receptionist');
const adminToken = makeToken('hospital_admin');

describe('M19 Hospital Intelligence Route Authorization', () => {
  describe('POST /api/v1/hospital-intelligence/analyze', () => {
    it('returns 401 when no Authorization header is present', async () => {
      const res = await request(app)
        .post('/api/v1/hospital-intelligence/analyze')
        .send({});
      expect(res.status).toBe(401);
    });

    it('returns 403 when nurse attempts to analyze (lacks intelligence:analyze)', async () => {
      const res = await request(app)
        .post('/api/v1/hospital-intelligence/analyze')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('returns 403 when receptionist attempts to analyze', async () => {
      const res = await request(app)
        .post('/api/v1/hospital-intelligence/analyze')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('returns 200 when physician triggers analysis', async () => {
      const res = await request(app)
        .post('/api/v1/hospital-intelligence/analyze')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({ scope: 'department' });
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.analysisId).toBeDefined();
      expect(res.body.data.aiStatus).toBe('grounded');
    });

    it('returns 200 when hospital_admin triggers analysis', async () => {
      const res = await request(app)
        .post('/api/v1/hospital-intelligence/analyze')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ scope: 'hospital_admin' });
      expect(res.status).toBe(200);
      expect(res.body.data.analysisId).toBeDefined();
    });
  });

  describe('GET /api/v1/hospital-intelligence/signals', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/v1/hospital-intelligence/signals');
      expect(res.status).toBe(401);
    });

    it('returns 403 when receptionist calls (lacks intelligence:read)', async () => {
      const res = await request(app)
        .get('/api/v1/hospital-intelligence/signals')
        .set('Authorization', `Bearer ${receptionistToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 when nurse calls (holds intelligence:read)', async () => {
      const res = await request(app)
        .get('/api/v1/hospital-intelligence/signals')
        .set('Authorization', `Bearer ${nurseToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns 200 when physician calls', async () => {
      const res = await request(app)
        .get('/api/v1/hospital-intelligence/signals')
        .set('Authorization', `Bearer ${physicianToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/v1/hospital-intelligence/recommendations/:id/approve', () => {
    it('returns 403 when nurse calls approve (lacks intelligence:approve)', async () => {
      const res = await request(app)
        .post('/api/v1/hospital-intelligence/recommendations/3f2504e0-4f89-11d3-9a0c-0305e82c3301/approve')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ idempotencyKey: 'idem-test-1' });
      expect(res.status).toBe(403);
    });

    it('returns 200 when physician approves with valid idempotencyKey', async () => {
      vi.spyOn(hospitalIntelligenceService, 'approveRecommendation').mockResolvedValueOnce({
        recommendationId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
        signalId: '3f2504e0-4f89-11d3-9a0c-0305e82c3302',
        actionType: 'NOTIFY_ATTENDING_PHYSICIAN',
        policyStatus: 'executed',
        executableStatus: 'executed',
        executedBy: '3f2504e0-4f89-11d3-9a0c-0305e82c3303',
        executedAt: new Date().toISOString(),
        idempotent: false,
        serviceInvoked: 'NotificationService',
        details: {},
      });

      const res = await request(app)
        .post('/api/v1/hospital-intelligence/recommendations/3f2504e0-4f89-11d3-9a0c-0305e82c3301/approve')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({ idempotencyKey: 'idem-test-1' });
      expect(res.status).toBe(200);
      expect(res.body.data.policyStatus).toBe('executed');
    });
  });

  describe('POST /api/v1/hospital-intelligence/recommendations/:id/execute', () => {
    it('returns 403 when nurse calls execute (lacks intelligence:approve)', async () => {
      const res = await request(app)
        .post('/api/v1/hospital-intelligence/recommendations/3f2504e0-4f89-11d3-9a0c-0305e82c3301/execute')
        .set('Authorization', `Bearer ${nurseToken}`)
        .send({ idempotencyKey: 'idem-test-exec-1' });
      expect(res.status).toBe(403);
    });

    it('returns 200 when physician calls execute', async () => {
      vi.spyOn(hospitalIntelligenceService, 'executeRecommendation').mockResolvedValueOnce({
        recommendationId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
        signalId: '3f2504e0-4f89-11d3-9a0c-0305e82c3302',
        actionType: 'NOTIFY_ATTENDING_PHYSICIAN',
        policyStatus: 'executed',
        executableStatus: 'executed',
        executedBy: '3f2504e0-4f89-11d3-9a0c-0305e82c3303',
        executedAt: new Date().toISOString(),
        idempotent: false,
        serviceInvoked: 'NotificationService',
        details: {},
      });

      const res = await request(app)
        .post('/api/v1/hospital-intelligence/recommendations/3f2504e0-4f89-11d3-9a0c-0305e82c3301/execute')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({ idempotencyKey: 'idem-test-exec-1' });
      expect(res.status).toBe(200);
      expect(res.body.data.policyStatus).toBe('executed');
    });
  });

  describe('POST /api/v1/hospital-intelligence/recommendations/:id/reject', () => {
    it('returns 403 when receptionist calls reject', async () => {
      const res = await request(app)
        .post('/api/v1/hospital-intelligence/recommendations/3f2504e0-4f89-11d3-9a0c-0305e82c3301/reject')
        .set('Authorization', `Bearer ${receptionistToken}`)
        .send({ rejectionReason: 'Irrelevant' });
      expect(res.status).toBe(403);
    });

    it('returns 200 when physician rejects', async () => {
      vi.spyOn(hospitalIntelligenceService, 'rejectRecommendation').mockResolvedValueOnce({
        status: 'rejected',
        recommendationId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      });

      const res = await request(app)
        .post('/api/v1/hospital-intelligence/recommendations/3f2504e0-4f89-11d3-9a0c-0305e82c3301/reject')
        .set('Authorization', `Bearer ${physicianToken}`)
        .send({ rejectionReason: 'Irrelevant' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rejected');
    });
  });
});
