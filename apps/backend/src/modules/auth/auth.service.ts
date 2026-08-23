import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { staff, refreshTokens } from '../../db/schema/staff';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AuthenticationError } from 'shared';
import fs from 'fs';
import path from 'path';

export interface AuthenticatedPrincipal {
  staffId: string;
  role: string;
  departmentId: string;
}

export function resolveKeyPath(configuredPath: string): string {
  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }
  const fromCwd = path.resolve(process.cwd(), configuredPath);
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }
  const fromRoot = path.resolve(__dirname, '../../../../', configuredPath);
  if (fs.existsSync(fromRoot)) {
    return fromRoot;
  }
  return fromCwd;
}

export class AuthService {
  private static parsePrivateKey(): string {
    const keyPath = resolveKeyPath(config.JWT_PRIVATE_KEY_PATH);
    if (!fs.existsSync(keyPath)) {
      throw new Error(`JWT private key file not found at: ${config.JWT_PRIVATE_KEY_PATH}`);
    }
    return fs.readFileSync(keyPath, 'utf-8');
  }

  static generateAccessToken(principal: AuthenticatedPrincipal): string {
    const payload = {
      sub: principal.staffId,
      role: principal.role,
      department_id: principal.departmentId,
    };

    return jwt.sign(payload, this.parsePrivateKey(), {
      algorithm: 'RS256',
      expiresIn: config.JWT_ACCESS_EXPIRATION as jwt.SignOptions['expiresIn'],
    });
  }

  static async generateRefreshToken(
    staffId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.JWT_REFRESH_EXPIRATION_DAYS);

    await db.insert(refreshTokens).values({
      staffId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    return rawToken;
  }

  static async login(email: string, passwordPlain: string, ipAddress?: string, userAgent?: string) {
    const users = await db.select().from(staff).where(eq(staff.email, email)).limit(1);
    const user = users[0];

    // Generic auth failure per security architecture (enumeration resistance)
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new AuthenticationError('Invalid email or password'); // Don't leak account state
    }

    const isValid = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    const principal: AuthenticatedPrincipal = {
      staffId: user.id,
      role: user.role,
      departmentId: user.departmentId,
    };

    const accessToken = this.generateAccessToken(principal);
    const refreshToken = await this.generateRefreshToken(user.id, ipAddress, userAgent);

    return { accessToken, refreshToken, user };
  }

  static async refresh(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    // Find the token in a transaction so we can safely rotate
    return await db.transaction(async (tx) => {
      const records = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);
      const record = records[0];

      if (!record) {
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      if (record.revokedAt) {
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      if (record.expiresAt < new Date()) {
        throw new AuthenticationError('Invalid or expired refresh token');
      }

      // Check if user is still active
      const users = await tx.select().from(staff).where(eq(staff.id, record.staffId)).limit(1);
      const user = users[0];

      if (!user || user.status !== 'active') {
        throw new AuthenticationError('Account is disabled');
      }

      // Revoke the old token (rotation)
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, record.id));

      // Issue a new access + refresh token
      const principal: AuthenticatedPrincipal = {
        staffId: user.id,
        role: user.role,
        departmentId: user.departmentId,
      };

      const accessToken = this.generateAccessToken(principal);

      const newRawToken = crypto.randomBytes(32).toString('hex');
      const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
      const newExpiresAt = new Date();
      newExpiresAt.setDate(newExpiresAt.getDate() + config.JWT_REFRESH_EXPIRATION_DAYS);

      await tx.insert(refreshTokens).values({
        staffId: user.id,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        ipAddress,
        userAgent,
      });

      return { accessToken, refreshToken: newRawToken, user };
    });
  }

  static async logout(rawRefreshToken: string) {
    if (!rawRefreshToken) return;

    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));
  }
}
