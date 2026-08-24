/**
 * Hospital AI OS — Frontend Authentication Service
 * Wraps M4 backend endpoints directly.
 */

import { apiClient, setAccessToken } from './api-client';
import { AuthUser, StaffRole } from '../types/auth';
import { LoginRequest } from 'shared';

export interface LoginResponseData {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: StaffRole;
    departmentId: string;
  };
}

export interface ProfileResponseData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  departmentId: string;
  status: string;
}

export const AuthService = {
  /**
   * Log in with credentials, store access token in memory
   */
  async login(credentials: LoginRequest): Promise<AuthUser> {
    const response = await apiClient<{ data: LoginResponseData }>('/auth/login', {
      method: 'POST',
      body: credentials,
      skipAuth: true,
    });

    const { accessToken, user } = response.data;
    setAccessToken(accessToken);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    };
  },

  /**
   * Refresh session via HTTP-only cookie
   */
  async refreshSession(): Promise<AuthUser> {
    const response = await apiClient<{ data: LoginResponseData }>('/auth/refresh', {
      method: 'POST',
      skipAuth: true,
    });

    const { accessToken, user } = response.data;
    setAccessToken(accessToken);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
    };
  },

  /**
   * Fetch current staff profile details (first name, last name, department, status)
   */
  async getProfile(): Promise<ProfileResponseData> {
    const response = await apiClient<{ data: ProfileResponseData }>('/auth/me', {
      method: 'GET',
    });
    return response.data;
  },

  /**
   * Log out, clear in-memory token and revoke session
   */
  async logout(): Promise<void> {
    try {
      await apiClient<{ data: { success: boolean } }>('/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Ignore network errors during logout to allow local cleanup
    } finally {
      setAccessToken(null);
    }
  },
};
