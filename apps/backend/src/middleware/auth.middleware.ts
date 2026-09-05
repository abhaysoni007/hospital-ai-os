import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticatedPrincipal, resolveKeyPath, formatAsPem } from '../modules/auth/auth.service';
import fs from 'fs';

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedPrincipal;
      correlationId?: string;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
      return;
    }

    const keyPath = resolveKeyPath(config.JWT_PUBLIC_KEY_PATH);
    if (!fs.existsSync(keyPath)) {
      res
        .status(500)
        .json({ error: { code: 'INTERNAL_ERROR', message: 'JWT configuration error' } });
      return;
    }

    const rawPublicKey = fs.readFileSync(keyPath, 'utf-8');
    const publicKey = formatAsPem(rawPublicKey, 'PUBLIC');

    // Strict RS256 algorithm enforcement
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;

    if (!decoded.sub || !decoded.role || !decoded.department_id) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid token payload' } });
      return;
    }

    req.user = {
      staffId: decoded.sub,
      role: decoded.role as string,
      departmentId: decoded.department_id as string,
    };

    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
};
