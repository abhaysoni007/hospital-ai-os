import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { app } from '../../app';

const ALLOWED_ORIGIN = 'http://localhost:3000';

describe('CORS policy (credentials enabled — security regression)', () => {
  it('allows requests from the configured trusted origin with credentials', async () => {
    const res = await supertest(app).get('/api/v1/health').set('Origin', ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.status).toBe(200);
  });

  it('does not emit allow-origin headers for unknown origins', async () => {
    const res = await supertest(app).get('/api/v1/health').set('Origin', 'http://evil.example.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('never reflects a wildcard origin while credentials are enabled', async () => {
    const res = await supertest(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');
    const aco = res.headers['access-control-allow-origin'];
    expect(aco).not.toBe('*');
  });

  it('answers preflight for the trusted origin with allowed headers', async () => {
    const res = await supertest(app)
      .options('/api/v1/patients')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization,x-correlation-id');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
