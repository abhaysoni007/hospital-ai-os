import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../auth.middleware';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { resolveKeyPath } from '../../modules/auth/auth.service';
import fs from 'fs';

describe('Auth Middleware', () => {
  const getPrivateKey = () => {
    const keyPath = resolveKeyPath(config.JWT_PRIVATE_KEY_PATH);
    return fs.readFileSync(keyPath, 'utf-8');
  };

  it('rejects missing authorization header', () => {
    const req = { headers: {} } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid authorization header format', () => {
    const req = { headers: { authorization: 'Basic token' } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('verifies valid RS256 token and sets req.user', () => {
    const privateKey = getPrivateKey();
    const validToken = jwt.sign(
      { sub: 'staff-id', role: 'nurse', department_id: 'dept-id' },
      privateKey,
      { algorithm: 'RS256' },
    );

    const req = { headers: { authorization: `Bearer ${validToken}` } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user?.staffId).toBe('staff-id');
    expect(req.user?.role).toBe('nurse');
    expect(req.user?.departmentId).toBe('dept-id');
  });

  it('rejects HS256 symmetric token (algorithm mismatch enforcement)', () => {
    const hs256Token = jwt.sign(
      { sub: 'staff-id', role: 'physician', department_id: 'dept-id' },
      'symmetric-secret-key-that-is-not-rs256',
      { algorithm: 'HS256' },
    );

    const req = { headers: { authorization: `Bearer ${hs256Token}` } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects none algorithm token', () => {
    // Construct unsecure 'none' algorithm token
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: 'staff-id', role: 'physician', department_id: 'dept-id' }),
    ).toString('base64url');
    const unsignedToken = `${header}.${payload}.`;

    const req = { headers: { authorization: `Bearer ${unsignedToken}` } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects expired token', () => {
    const privateKey = getPrivateKey();
    const expiredToken = jwt.sign(
      { sub: 'staff-id', role: 'physician', department_id: 'dept-id' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '-10s' },
    );

    const req = { headers: { authorization: `Bearer ${expiredToken}` } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects malformed signature', () => {
    const privateKey = getPrivateKey();
    const validToken = jwt.sign(
      { sub: 'staff-id', role: 'nurse', department_id: 'dept-id' },
      privateKey,
      { algorithm: 'RS256' },
    );
    const tamperedToken = validToken.slice(0, -5) + 'xxxxx';

    const req = { headers: { authorization: `Bearer ${tamperedToken}` } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects token missing required claims', () => {
    const privateKey = getPrivateKey();
    const invalidToken = jwt.sign(
      { sub: 'staff-id' }, // missing role and department_id
      privateKey,
      { algorithm: 'RS256' },
    );

    const req = { headers: { authorization: `Bearer ${invalidToken}` } } as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
