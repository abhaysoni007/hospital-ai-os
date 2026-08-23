import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { correlationIdMiddleware, CORRELATION_ID_HEADER } from '../correlation-id.middleware';
import { errorHandlerMiddleware } from '../error-handler.middleware';
import { validate } from '../validation.middleware';
import { NotFoundError } from 'shared';
import { z } from 'zod';

describe('Middleware Stack', () => {
  it('correlationIdMiddleware: generates ID if missing', async () => {
    const app = express();
    app.use(correlationIdMiddleware);
    app.get('/', (req: express.Request, res) =>
      res.json({ id: (req as express.Request & { correlationId?: string }).correlationId }),
    );

    const res = await request(app).get('/');
    expect(res.headers[CORRELATION_ID_HEADER]).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((res.body as any).id).toBeDefined();
  });

  it('correlationIdMiddleware: accepts valid ID', async () => {
    const app = express();
    app.use(correlationIdMiddleware);
    app.get('/', (req: express.Request, res) =>
      res.json({ id: (req as express.Request & { correlationId?: string }).correlationId }),
    );

    const validId = '550e8400-e29b-41d4-a716-446655440000';
    const res = await request(app).get('/').set(CORRELATION_ID_HEADER, validId);
    expect(res.headers[CORRELATION_ID_HEADER]).toBe(validId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((res.body as any).id).toBe(validId);
  });

  it('correlationIdMiddleware: replaces invalid ID', async () => {
    const app = express();
    app.use(correlationIdMiddleware);
    app.get('/', (req: express.Request, res) =>
      res.json({ id: (req as express.Request & { correlationId?: string }).correlationId }),
    );

    const invalidId = 'not-a-uuid';
    const res = await request(app).get('/').set(CORRELATION_ID_HEADER, invalidId);
    expect(res.headers[CORRELATION_ID_HEADER]).toBeDefined();
    expect(res.headers[CORRELATION_ID_HEADER]).not.toBe(invalidId);
  });

  it('validationMiddleware: passes valid body', async () => {
    const app = express();
    app.use(express.json());

    const schema = z.object({ body: z.object({ name: z.string() }) });
    app.post('/', validate(schema), (req, res) => res.json({ success: true }));

    const res = await request(app).post('/').send({ name: 'John' });
    expect(res.status).toBe(200);
  });

  it('validationMiddleware: throws ValidationError on invalid body', async () => {
    const app = express();
    app.use(express.json());

    const schema = z.object({ body: z.object({ name: z.string() }) });
    app.post('/', validate(schema), (req, res) => res.json({ success: true }));
    app.use(errorHandlerMiddleware);

    const res = await request(app).post('/').send({ name: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('body.name');
  });

  it('errorHandlerMiddleware: safely formats internal errors', async () => {
    const app = express();
    app.get('/', () => {
      throw new Error('Secret DB crash');
    });
    app.use(errorHandlerMiddleware);

    const res = await request(app).get('/');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('An unexpected error occurred');
    expect(res.body.error.message).not.toContain('Secret DB crash'); // no info leak
  });

  it('errorHandlerMiddleware: passes operational AppError to client', async () => {
    const app = express();
    app.get('/', () => {
      throw new NotFoundError('User not found');
    });
    app.use(errorHandlerMiddleware);

    const res = await request(app).get('/');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND_ERROR');
    expect(res.body.error.message).toBe('User not found');
  });
});
