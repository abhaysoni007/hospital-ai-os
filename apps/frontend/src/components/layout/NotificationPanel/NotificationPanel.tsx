'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bell,
  RefreshCw,
  AlertOctagon,
  AlertTriangle,
  Info,
  Clock,
  X,
  ChevronRight,
} from 'lucide-react';
import type { NotificationItem } from 'shared';
import styles from './NotificationPanel.module.css';

export interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  items: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  onAcknowledge: (id: string) => Promise<boolean>;
  onReload: () => void;
}

/**
 * M12.2 — REAL notification inbox (critical-result loop), refined in M13.
 * Data comes exclusively from GET /api/v1/notifications (server-derived
 * recipient scope). No fabricated content anywhere.
 */

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function NotificationPanel({
  isOpen,
  onClose,
  items,
  unreadCount,
  isLoading,
  error,
  onAcknowledge,
  onReload,
}: NotificationPanelProps) {
  const [ackedErrorId, setAckedErrorId] = React.useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape closes and focus returns to the invoking bell button.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAcknowledge = async (id: string) => {
    setAckedErrorId(null);
    const ok = await onAcknowledge(id);
    if (!ok) {
      // Truthful failure feedback (e.g., 409 already acknowledged elsewhere).
      setAckedErrorId(id);
    }
  };

  const getSeverityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertOctagon size={16} className={styles.criticalIcon} aria-hidden="true" />;
      case 'urgent':
        return <AlertTriangle size={16} className={styles.urgentIcon} aria-hidden="true" />;
      default:
        return <Info size={16} className={styles.infoIcon} aria-hidden="true" />;
    }
  };

  return (
    <div ref={panelRef} className={styles.panel} role="dialog" aria-label="Notifications">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>Notifications</h2>
          {unreadCount > 0 && (
            <span className={styles.unreadBadge} aria-live="polite">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.markAllButton}
            onClick={onReload}
            aria-label="Refresh notifications"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close notifications"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className={styles.list} aria-live="polite">
        {isLoading ? (
          <div className={styles.emptyState} role="status">
            <Bell size={28} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>Loading notifications…</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState} role="alert">
            <AlertOctagon size={28} className={styles.criticalIcon} />
            <p className={styles.emptyTitle}>{error}</p>
            <button type="button" className={styles.markAllButton} onClick={onReload}>
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>
            <Bell size={28} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No notifications</p>
            <span className={styles.emptyDesc}>
              You are caught up — no alerts require attention.
            </span>
          </div>
        ) : (
          items.map((item) => {
            const isUnread = item.status !== 'acknowledged';
            const reviewHref =
              item.notificationType === 'critical_lab_alert' && item.relatedOrderId
                ? `/diagnostics/${item.relatedOrderId}`
                : null;
            return (
              <article
                key={item.id}
                className={`${styles.item} ${isUnread ? styles.unreadItem : ''} ${styles[item.priority === 'normal' ? 'info' : item.priority]}`}
              >
                <div className={styles.itemHeader}>
                  <div className={styles.itemHeaderLeft}>
                    {getSeverityIcon(item.priority)}
                    <span className={styles.itemTitle}>{item.title}</span>
                  </div>
                  {isUnread && <span className={styles.unreadDot} role="img" aria-label="Unread" />}
                </div>
                <p className={styles.itemMessage}>{item.body}</p>
                <div className={styles.itemFooter}>
                  <Clock size={12} aria-hidden="true" />
                  <span>{formatTime(item.createdAt)}</span>
                  <span className={styles.metaDot} aria-hidden="true" />
                  <span>{isUnread ? 'Requires attention' : `Acknowledged`}</span>
                  {reviewHref && (
                    <Link
                      href={reviewHref}
                      className={styles.markAllButton}
                      aria-label={`Review diagnostic result for ${item.title}`}
                    >
                      Review <ChevronRight size={12} />
                    </Link>
                  )}
                  {isUnread && item.status === 'dispatched' && (
                    <button
                      type="button"
                      className={styles.markAllButton}
                      onClick={() => handleAcknowledge(item.id)}
                      aria-label={`Acknowledge ${item.title}`}
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
                {ackedErrorId === item.id && (
                  <p role="alert" className={styles.emptyDesc}>
                    Could not acknowledge — it may already be acknowledged. Refresh and try again.
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
