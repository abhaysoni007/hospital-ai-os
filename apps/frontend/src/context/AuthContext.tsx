'use client';

/**
 * Hospital AI OS — Central Authentication Context & Session Manager
 *
 * Implements:
 * - In-memory access token management
 * - Automatic session hydration on app load via HTTP-only refresh cookies
 * - Login / Logout lifecycle
 * - Error & loading state handling
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthUser } from '../types/auth';
import { AuthService } from '../services/auth-service';
import { LoginRequest } from 'shared';
import { ApiError, onSessionExpired } from '../services/api-client';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const refreshSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const basicUser = await AuthService.refreshSession();
      try {
        const profile = await AuthService.getProfile();
        setUser({
          ...basicUser,
          firstName: profile.firstName,
          lastName: profile.lastName,
          status: profile.status,
        });
      } catch {
        setUser(basicUser);
      }
      setError(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Hydrate session on initial app mount
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // M12.2 Part C: apiClient signals a failed refresh — reset auth state so
  // AuthGuard routes the user to /login. The refresh cookie is already
  // invalidated server-side (rotation) or unusable; no further calls needed.
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null);
        setError('Your session expired. Please sign in again.');
      }),
    [],
  );

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      const basicUser = await AuthService.login(credentials);
      try {
        const profile = await AuthService.getProfile();
        setUser({
          ...basicUser,
          firstName: profile.firstName,
          lastName: profile.lastName,
          status: profile.status,
        });
      } catch {
        setUser(basicUser);
      }
    } catch (err: unknown) {
      setUser(null);
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setError('Sign-in failed. Please verify your credentials and try again.');
        } else if (err.statusCode === 403) {
          setError(
            'Account is disabled or access is restricted. Contact your system administrator.',
          );
        } else if (err.statusCode === 429) {
          setError('Too many failed attempts. Please wait 15 minutes before trying again.');
        } else {
          setError(err.message || 'An error occurred during authentication.');
        }
      } else {
        setError('Unable to connect to authentication service. Please check your network.');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      await AuthService.logout();
    } finally {
      setUser(null);
      setError(null);
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
        refreshSession,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
