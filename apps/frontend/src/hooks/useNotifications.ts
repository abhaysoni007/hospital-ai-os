'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationItem } from 'shared';
import { notificationService } from '../services/notification-service';

/**
 * M12.2 — shared notification state for the header badge, notification panel
 * and dashboard work queue. Single fetch, no polling loops; consumers call
 * reload() after mutations.
 */

export interface NotificationsState {
  items: NotificationItem[];
  total: number;
  unreadCount: number;
  criticalCount: number;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  acknowledge: (id: string) => Promise<boolean>;
}

export function useNotifications(pageSize = 20): NotificationsState {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await notificationService.list({ page: 1, pageSize });
      if (!mounted.current) return;
      setItems(response.data);
      setTotal(response.meta.total);
    } catch {
      if (!mounted.current) return;
      // Truthful error surface — never fabricated fallback data.
      setError('Notifications are unavailable right now.');
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [pageSize]);

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
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const unreadCount = items.filter((n) => n.status !== 'acknowledged').length;
  const criticalCount = items.filter(
    (n) => n.priority === 'critical' && n.status !== 'acknowledged',
  ).length;

  return { items, total, unreadCount, criticalCount, isLoading, error, reload, acknowledge };
}
