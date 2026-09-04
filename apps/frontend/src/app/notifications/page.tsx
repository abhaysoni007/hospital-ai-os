'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Bell, AlertOctagon, CheckCircle2, RefreshCw, ArrowUpRight, Check } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell/AppShell';
import { Card } from '../../components/ui/Card/Card';
import { Badge } from '../../components/ui/Badge/Badge';
import { AlertBanner } from '../../components/ui/Alert/AlertBanner';
import { TableSkeleton } from '../../components/ui/Table/Table';
import { useNotifications } from '../../hooks/useNotifications';
import styles from './notifications.module.css';

export default function NotificationsPage() {
  const { items, unreadCount, isLoading, error, acknowledge, reload } = useNotifications(100);
  const [filter, setFilter] = useState<'all' | 'critical' | 'unread'>('all');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (filter === 'critical') return item.priority === 'critical';
    if (filter === 'unread') return item.status !== 'acknowledged';
    return true;
  });

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingId(id);
    try {
      await acknowledge(id);
    } finally {
      setAcknowledgingId(null);
    }
  };

  return (
    <AppShell breadcrumbs={['Operations', 'Notifications']}>
      <div className={styles.container}>
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.title}>Clinical &amp; System Notifications</h1>
            <p className={styles.subtitle}>
              Deterministic clinical alerts, laboratory panic results, and task assignments
            </p>
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={() => void reload()}
              aria-label="Refresh notifications"
            >
              <RefreshCw size={14} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        {/* Filter bar */}
        <div className={styles.filterBar}>
          <div className={styles.tabGroup}>
            <button
              type="button"
              className={`${styles.tabBtn} ${filter === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => setFilter('all')}
            >
              All Notifications ({items.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${filter === 'unread' ? styles.tabBtnActive : ''}`}
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${filter === 'critical' ? styles.tabBtnActive : ''}`}
              onClick={() => setFilter('critical')}
            >
              Critical Only ({items.filter((i) => i.priority === 'critical').length})
            </button>
          </div>
        </div>

        {error && (
          <AlertBanner severity="warning" title="Notifications unavailable">
            {error}
          </AlertBanner>
        )}

        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : filteredItems.length === 0 ? (
          <Card elevation="xs" padding="md">
            <div className={styles.emptyState}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-success-main)' }} />
              <h3>All clear!</h3>
              <p>No notifications matching this filter.</p>
            </div>
          </Card>
        ) : (
          <div className={styles.list}>
            {filteredItems.map((n) => (
              <Card
                key={n.id}
                elevation="xs"
                padding="md"
                className={n.priority === 'critical' && n.status !== 'acknowledged' ? styles.cardCritical : undefined}
              >
                <div className={styles.notificationRow}>
                  <div className={styles.iconCol}>
                    {n.priority === 'critical' ? (
                      <span className={styles.criticalIconWrap}>
                        <AlertOctagon size={18} />
                      </span>
                    ) : (
                      <span className={styles.bellIconWrap}>
                        <Bell size={18} />
                      </span>
                    )}
                  </div>

                  <div className={styles.contentCol}>
                    <div className={styles.titleRow}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      <div className={styles.badgeGroup}>
                        <Badge
                          variant={
                            n.priority === 'critical'
                              ? 'critical'
                              : n.priority === 'urgent'
                                ? 'urgent'
                                : 'neutral'
                          }
                          size="sm"
                        >
                          {n.priority.toUpperCase()}
                        </Badge>
                        <Badge
                          variant={n.status === 'acknowledged' ? 'stable' : 'primary'}
                          size="sm"
                        >
                          {n.status === 'acknowledged' ? 'Acknowledged' : 'New'}
                        </Badge>
                      </div>
                    </div>

                    <p className={styles.itemBody}>{n.body}</p>

                    <div className={styles.metaRow}>
                      <span className={styles.timestamp}>
                        {new Date(n.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>

                      <div className={styles.actionLinks}>
                        {n.relatedOrderId && (
                          <Link href={`/diagnostics/${n.relatedOrderId}`} className={styles.linkCta}>
                            Review Result <ArrowUpRight size={14} />
                          </Link>
                        )}
                        {n.status !== 'acknowledged' && (
                          <button
                            type="button"
                            className={styles.ackBtn}
                            disabled={acknowledgingId === n.id}
                            onClick={() => void handleAcknowledge(n.id)}
                          >
                            <Check size={12} />
                            {acknowledgingId === n.id ? 'Saving…' : 'Acknowledge'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
