import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { db } from '../../../db';

vi.mock('../../../db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

describe('Health & Readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns healthy status when db is connected', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.execute).mockResolvedValueOnce({} as any);

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.checks.database.status).toBe('up');
  });

  it('returns unhealthy status when db fails', async () => {
    vi.mocked(db.execute).mockRejectedValueOnce(new Error('connection failed'));

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.checks.database.status).toBe('down');
  });

  describe('GET /api/v1/health/live (Liveness probe)', () => {
    it('returns 200 alive without querying database', async () => {
      const res = await request(app).get('/api/v1/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
      // DB execute should not have been called for pure liveness
      expect(db.execute).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/health/ready (Readiness probe)', () => {
    it('returns 200 ready when database is reachable', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(db.execute).mockResolvedValueOnce({} as any);

      const res = await request(app).get('/api/v1/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.checks.database.status).toBe('up');
      expect(typeof res.body.checks.database.latencyMs).toBe('number');
    });

    it('returns 503 unready when database is down', async () => {
      vi.mocked(db.execute).mockRejectedValueOnce(new Error('DB unreachable'));

      const res = await request(app).get('/api/v1/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unready');
      expect(res.body.checks.database.status).toBe('down');
    });
  });
});

