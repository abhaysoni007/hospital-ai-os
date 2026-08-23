import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import { db } from '../../../db';

vi.mock('../../../db', () => ({
  db: {
    execute: vi.fn(),
  },
}));

describe('Health & Readiness', () => {
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
});
