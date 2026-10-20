'use client';

import React, { createContext, useContext, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { NotificationItem } from 'shared';
import { notificationService } from '../services/notification-service';
import { useAuth } from './AuthContext';

export interface NotificationsState {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
  criticalCount: number;
  isLoading: boolean;
  error: string | null;
  reload: (opts?: { silent?: boolean }) => Promise<void>;
  acknowledge: (id: string) => Promise<boolean>;
}

export const NotificationContext = createContext<NotificationsState | null>(null);

const DEFAULT_PAGE_SIZE = 50;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!isAuthenticated) {
        setItems([]);
        setTotal(0);
        setIsLoading(false);
        return;
      }

      if (!opts?.silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const response = await notificationService.list({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
        if (!mounted.current) return;
        setItems(response.data);
        setTotal(response.meta.total);
        setError(null);
      } catch {
        if (!mounted.current) return;
        if (!opts?.silent) {
          setError('Notifications are unavailable right now.');
        }
      } finally {
        if (mounted.current) {
          if (!opts?.silent) setIsLoading(false);
        }
      }
    },
    [isAuthenticated],
  );

  const acknowledge = useCallback(async (id: string): Promise<boolean> => {
    try {
      await notificationService.acknowledge(id);
      setItems((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, status: 'acknowledged', acknowledgedAt: new Date().toISOString() }
            : n,
        ),
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (isAuthenticated) {
      void reload();
    } else {
      setItems([]);
      setTotal(0);
      setIsLoading(false);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        void reload({ silent: true });
      }
    };
    const handleFocus = () => {
      if (isAuthenticated) {
        void reload({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, reload]);

  const unreadCount = useMemo(
    () => items.filter((n) => n.status !== 'acknowledged').length,
    [items],
  );

  const criticalCount = useMemo(
    () => items.filter((n) => n.priority === 'critical' && n.status !== 'acknowledged').length,
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      total,
      unreadCount,
      criticalCount,
      isLoading,
      error,
      reload,
      acknowledge,
    }),
    [items, total, unreadCount, criticalCount, isLoading, error, reload, acknowledge],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationContext(): NotificationsState | null {
  return useContext(NotificationContext);
}
