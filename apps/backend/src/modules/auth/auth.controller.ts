import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { loginRequestSchema } from 'shared';
import { config } from '../../config';
import { db } from '../../db';
import { staff } from '../../db/schema/staff';
import { eq } from 'drizzle-orm';

export const loginHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = loginRequestSchema.parse(req.body);
    const { email, password } = validatedData;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { accessToken, refreshToken, user } = await AuthService.login(
      email,
      password,
      ipAddress,
      userAgent,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: config.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    });

    res.json({
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    if (!rawRefreshToken) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' } });
      return;
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { accessToken, refreshToken, user } = await AuthService.refresh(
      rawRefreshToken,
      ipAddress,
      userAgent,
    );

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: config.JWT_REFRESH_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    });

    res.json({
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logoutHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    await AuthService.logout(rawRefreshToken);

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
};

export const meHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const users = await db.select().from(staff).where(eq(staff.id, user.staffId)).limit(1);
    const staffUser = users[0];

    if (!staffUser) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } });
      return;
    }

    res.json({
      data: {
        id: staffUser.id,
        email: staffUser.email,
        firstName: staffUser.firstName,
        lastName: staffUser.lastName,
        role: staffUser.role,
        departmentId: staffUser.departmentId,
        status: staffUser.status,
      },
    });
  } catch (error) {
    next(error);
  }
};
