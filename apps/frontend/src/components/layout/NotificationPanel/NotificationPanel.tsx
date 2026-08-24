'use client';

import React, { useState } from 'react';
import { Bell, Check, AlertOctagon, AlertTriangle, Info, Clock, X } from 'lucide-react';
import styles from './NotificationPanel.module.css';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  severity: 'critical' | 'urgent' | 'info' | 'routine';
  isRead: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Panic Lab Value Alert — Potassium 6.2 mEq/L',
    message: 'Patient: Eleanor Vance (MRN: HOS-92841) • Bed 402-B • Stat re-test ordered.',
    time: '4 mins ago',
    severity: 'critical',
    isRead: false,
  },
  {
    id: 'n2',
    title: 'STAT Consultation Request',
    message: 'Emergency Department requested immediate Cardiology review for Room 3.',
    time: '18 mins ago',
    severity: 'urgent',
    isRead: false,
  },
  {
    id: 'n3',
    title: 'AI Progress Note Draft Ready',
    message:
      'Encounter #ENC-1092 AI clinical draft synthesized and waiting for physician sign-off.',
    time: '1 hour ago',
    severity: 'info',
    isRead: true,
  },
  {
    id: 'n4',
    title: 'Department Shift Handover Complete',
    message: 'Morning handover report for Cardiology Inpatient Ward submitted by Nurse Roberts.',
    time: '3 hours ago',
    severity: 'routine',
    isRead: true,
  },
];

export interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markItemAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertOctagon size={16} className={styles.criticalIcon} />;
      case 'urgent':
        return <AlertTriangle size={16} className={styles.urgentIcon} />;
      default:
        return <Info size={16} className={styles.infoIcon} />;
    }
  };

  return (
    <div className={styles.panel} role="dialog" aria-label="Notifications Panel">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>Notifications</h3>
          {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount} new</span>}
        </div>
        <div className={styles.headerActions}>
          {unreadCount > 0 && (
            <button type="button" className={styles.markAllButton} onClick={markAllAsRead}>
              <Check size={14} /> Mark all read
            </button>
          )}
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

      <div className={styles.list}>
        {notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <Bell size={28} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No notifications</p>
            <span className={styles.emptyDesc}>You are caught up on all clinical alerts</span>
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`
                ${styles.item}
                ${!item.isRead ? styles.unreadItem : ''}
                ${styles[item.severity]}
              `}
              onClick={() => markItemAsRead(item.id)}
            >
              <div className={styles.itemHeader}>
                <div className={styles.itemHeaderLeft}>
                  {getSeverityIcon(item.severity)}
                  <span className={styles.itemTitle}>{item.title}</span>
                </div>
                {!item.isRead && <span className={styles.unreadDot} aria-label="Unread" />}
              </div>
              <p className={styles.itemMessage}>{item.message}</p>
              <div className={styles.itemFooter}>
                <Clock size={12} />
                <span>{item.time}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
