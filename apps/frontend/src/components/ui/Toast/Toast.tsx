'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CheckCircle2, AlertTriangle, Info, AlertOctagon, X } from 'lucide-react';
import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastInput {
  title: string;
  description?: React.ReactNode;
  variant?: ToastVariant;
  /** Duration in ms before auto-dismiss. 0 = sticky. Default 4500. */
  durationMs?: number;
}

interface ToastItem extends Required<Omit<ToastInput, 'description'>> {
  id: string;
  description?: React.ReactNode;
}

interface ToastContextValue {
  show: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={18} aria-hidden="true" />,
  info: <Info size={18} aria-hidden="true" />,
  warning: <AlertTriangle size={18} aria-hidden="true" />,
  error: <AlertOctagon size={18} aria-hidden="true" />,
};

const DEFAULT_DURATION = 4500;

/**
 * ToastProvider — single source of truth for ephemeral toasts.
 *
 *  - Role="status" / role="alert" live regions per variant; screen readers
 *    announce toasts as they appear.
 *  - Toasts are not the same as the in-app NotificationPanel (which mirrors
 *    server-driven notification records); Toast is purely a presentation
 *    primitive for client-side feedback.
 *  - Reduced-motion-safe: enter/exit animation disabled.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const tm = timers.current.get(id);
    if (tm) {
      window.clearTimeout(tm);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (toast: ToastInput): string => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item: ToastItem = {
        id,
        title: toast.title,
        description: toast.description,
        variant: toast.variant ?? 'info',
        durationMs: toast.durationMs ?? DEFAULT_DURATION,
      };
      setItems((prev) => [...prev, item]);
      if (item.durationMs > 0) {
        const handle = window.setTimeout(() => dismiss(id), item.durationMs);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach((h) => window.clearTimeout(h));
      timers.current.clear();
    },
    [],
  );

  const value = useMemo<ToastContextValue>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className={styles.viewport} role="region" aria-label="Notifications">
      {items.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[t.variant]}`}
          role={t.variant === 'error' || t.variant === 'warning' ? 'alert' : 'status'}
          aria-live={t.variant === 'error' || t.variant === 'warning' ? 'assertive' : 'polite'}
        >
          <span className={styles.icon}>{ICONS[t.variant]}</span>
          <div className={styles.body}>
            <div className={styles.title}>{t.title}</div>
            {t.description && <div className={styles.description}>{t.description}</div>}
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className={styles.close}
            aria-label="Dismiss notification"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
