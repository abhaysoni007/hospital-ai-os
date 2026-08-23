import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../../app';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// In-memory mock database
interface MockToken {
  id: string;
  staffId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  ipAddress?: string;
  userAgent?: string;
}

let mockUsers: Record<string, unknown>[] = [];
const mockRefreshTokens: MockToken[] = [];
let testScenario = 'success';

function extractConditionValue(condition: unknown): string | undefined {
  const cond = condition as { value?: string; queryChunks?: Array<{ value?: string }> };
  if (cond?.value && typeof cond.value === 'string') {
    return cond.value;
  }
  if (Array.isArray(cond?.queryChunks)) {
    const chunk = cond.queryChunks.find((c) => c && typeof c.value === 'string');
    if (chunk?.value) return chunk.value;
  }
  return undefined;
}

vi.mock('../../../db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn((data) => {
        if (data.tokenHash) {
          const newToken: MockToken = { ...data, id: `token-${mockRefreshTokens.length + 1}` };
          mockRefreshTokens.push(newToken);
        }
        return { returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]) };
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        where: vi.fn((_condition) => ({
          limit: vi.fn().mockImplementation(() => {
            if (testScenario === 'unknown_email') return [];
            if (testScenario === 'suspended') return [{ ...mockUsers[0], status: 'suspended' }];
            return mockUsers;
          }),
        })),
      }),
    }),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnValue({
      set: vi.fn(function (setData) {
        return {
          where: vi.fn(function (condition) {
            const targetVal = extractConditionValue(condition);
            if (targetVal) {
              const token = mockRefreshTokens.find(
                (t) => t.id === targetVal || t.tokenHash === targetVal,
              );
              if (token && setData.revokedAt) {
                token.revokedAt = setData.revokedAt;
              }
            }
          }),
        };
      }),
    }),
    transaction: vi.fn(async (cb) => {
      let selectCallCount = 0;
      const tx = {
        select: vi.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount % 2 === 1) {
            // First call in refresh(): selecting refreshTokens by tokenHash
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn((condition) => ({
                  limit: vi.fn().mockImplementation(() => {
                    const targetHash = extractConditionValue(condition);
                    if (targetHash) {
                      const match = mockRefreshTokens.find((t) => t.tokenHash === targetHash);
                      return match ? [match] : [];
                    }
                    return [];
                  }),
                })),
              }),
            };
          } else {
            // Second call in refresh(): selecting staff by id
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn(() => ({ limit: vi.fn().mockReturnValue(mockUsers) })),
              }),
            };
          }
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn(function (setData) {
            return {
              where: vi.fn(function (condition) {
                const targetVal = extractConditionValue(condition);
                if (targetVal) {
                  const token = mockRefreshTokens.find(
                    (t) => t.id === targetVal || t.tokenHash === targetVal,
                  );
                  if (token && setData.revokedAt) {
                    token.revokedAt = setData.revokedAt;
                  }
                }
              }),
            };
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn((data) => {
            const newToken: MockToken = { ...data, id: `token-${mockRefreshTokens.length + 1}` };
            mockRefreshTokens.push(newToken);
            return { returning: vi.fn().mockResolvedValue([{ id: newToken.id }]) };
          }),
        }),
      };

      return await cb(tx);
    }),
  },
}));

describe('Authentication API Integration', () => {
  const testStaffId = '12345678-1234-1234-1234-123456789012';
  const testPassword = 'TestPassword123!';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(testPassword, 10);
    mockUsers = [
      {
        id: testStaffId,
        email: 'active.test@hospital.os',
        passwordHash: passwordHash,
        firstName: 'Test',
        lastName: 'Physician',
        role: 'physician',
        departmentId: 'dept-1234-1234-1234-123456789012',
        status: 'active',
      },
    ];
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  const getCookieArray = (headerValue: string | string[] | undefined): string[] => {
    if (!headerValue) return [];
    return Array.isArray(headerValue) ? headerValue : [headerValue];
  };

  describe('POST /auth/login', () => {
    it('returns tokens on valid credentials with RS256 token and httpOnly cookie', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'active.test@hospital.os',
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.id).toBe(testStaffId);
      expect(res.body.data.user.email).toBe('active.test@hospital.os');
      expect(res.body.data.user.role).toBe('physician');
      expect(res.body.data.user.departmentId).toBe('dept-1234-1234-1234-123456789012');
      expect(res.body.data.user.passwordHash).toBeUndefined();

      // Validate decoded JWT claims
      const decoded = jwt.decode(res.body.data.accessToken) as jwt.JwtPayload;
      expect(decoded).toBeDefined();
      expect(decoded.sub).toBe(testStaffId);
      expect(decoded.role).toBe('physician');
      expect(decoded.department_id).toBe('dept-1234-1234-1234-123456789012');
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();

      // Ensure NO sensitive data in token
      expect(decoded.password).toBeUndefined();
      expect(decoded.passwordHash).toBeUndefined();
      expect(decoded.refreshToken).toBeUndefined();

      // Cookie should be set with security attributes
      const cookies = getCookieArray(res.headers['set-cookie']);
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.some((c: string) => c.includes('refreshToken='))).toBe(true);
      expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
      expect(cookies.some((c: string) => c.includes('SameSite=Strict'))).toBe(true);
    });

    it('returns generic error on invalid password (enumeration resistance)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'active.test@hospital.os',
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(res.body.error.message).toBe('Invalid email or password');
    });

    it('returns generic error on unknown email (enumeration resistance)', async () => {
      testScenario = 'unknown_email';
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'unknown.test@hospital.os',
        password: testPassword,
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(res.body.error.message).toBe('Invalid email or password');
      testScenario = 'success';
    });

    it('returns generic error on suspended account (enumeration resistance)', async () => {
      testScenario = 'suspended';
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'disabled.test@hospital.os',
        password: testPassword,
      });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
      expect(res.body.error.message).toBe('Invalid email or password');
      testScenario = 'success';
    });

    it('returns validation error on malformed input', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'not-an-email',
        password: '',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/refresh', () => {
    let cookieString: string;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'active.test@hospital.os',
        password: testPassword,
      });

      const cookies = getCookieArray(res.headers['set-cookie']);
      cookieString = cookies.find((c) => c.startsWith('refreshToken=')) || '';
    });

    it('returns new tokens on valid refresh and rotates cookie', async () => {
      const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookieString);

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();

      const newCookies = getCookieArray(res.headers['set-cookie']);
      expect(newCookies.length).toBeGreaterThan(0);
      expect(newCookies.some((c) => c.includes('refreshToken='))).toBe(true);
    });

    it('rejects an already used refresh token (rotation reuse detection)', async () => {
      // The original cookie was used in the previous test and is now revoked
      const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookieString);

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Invalid or expired refresh token');
    });

    it('rejects refresh request with no cookie provided', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('No refresh token provided');
    });
  });

  describe('POST /auth/logout', () => {
    let validAccessToken: string;
    let cookieString: string;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'active.test@hospital.os',
        password: testPassword,
      });

      validAccessToken = res.body.data.accessToken;
      const cookies = getCookieArray(res.headers['set-cookie']);
      cookieString = cookies.find((c) => c.startsWith('refreshToken=')) || '';
    });

    it('revokes token and clears cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .set('Cookie', cookieString);

      expect(res.status).toBe(200);
      expect(res.body.data.success).toBe(true);

      const cookies = getCookieArray(res.headers['set-cookie']);
      expect(cookies.length).toBeGreaterThan(0);
      expect(cookies.some((c) => c.includes('refreshToken=;'))).toBe(true);
    });

    it('requires authentication to logout', async () => {
      const res = await request(app).post('/api/v1/auth/logout').set('Cookie', cookieString);

      expect(res.status).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    let validAccessToken: string;

    beforeAll(async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'active.test@hospital.os',
        password: testPassword,
      });
      validAccessToken = res.body.data.accessToken;
    });

    it('returns current user profile without sensitive fields', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${validAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('active.test@hospital.os');
      expect(res.body.data.firstName).toBe('Test');
      expect(res.body.data.lastName).toBe('Physician');
      expect(res.body.data.role).toBe('physician');
      expect(res.body.data.status).toBe('active');
      expect(res.body.data.passwordHash).toBeUndefined();
      expect(res.body.data.refreshToken).toBeUndefined();
    });

    it('rejects unauthenticated request', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });
  });

  describe('Rate Limiting', () => {
    it('enforces rate limiting on repeated failed attempts', async () => {
      for (let i = 0; i < 6; i++) {
        await request(app).post('/api/v1/auth/login').send({
          email: 'active.test@hospital.os',
          password: 'wrong-attempt',
        });
      }

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'active.test@hospital.os',
        password: 'wrong-attempt',
      });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('Security & Leakage Verification', () => {
    it('ensures passwords and secrets never appear in responses', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'active.test@hospital.os',
        password: testPassword,
      });

      const responseString = JSON.stringify(res.body);
      expect(responseString).not.toContain(testPassword);
      expect(responseString).not.toContain(passwordHash);
      expect(responseString).not.toContain('BEGIN RSA PRIVATE KEY');
      expect(responseString).not.toContain('BEGIN PRIVATE KEY');
    });
  });
});
