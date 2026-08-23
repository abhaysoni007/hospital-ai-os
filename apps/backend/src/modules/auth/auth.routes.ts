import { Router } from 'express';
import { loginHandler, refreshHandler, logoutHandler, meHandler } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';

export const authRoutes = Router();

// Login limit: 5 failures / 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many failed login attempts, please try again later',
    },
  },
});

authRoutes.post('/login', loginLimiter, loginHandler);
authRoutes.post('/refresh', refreshHandler);
authRoutes.post('/logout', authMiddleware, logoutHandler);
authRoutes.get('/me', authMiddleware, meHandler);
