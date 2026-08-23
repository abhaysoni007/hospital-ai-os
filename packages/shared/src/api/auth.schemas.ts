import { z } from 'zod';

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const authResponseSchema = z.object({
  data: z.object({
    accessToken: z.string(),
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      role: z.string(),
      departmentId: z.string().uuid(),
    }),
  }),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

export const authProfileResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    role: z.string(),
    departmentId: z.string().uuid(),
    status: z.string(),
  }),
});

export type AuthProfileResponse = z.infer<typeof authProfileResponseSchema>;
