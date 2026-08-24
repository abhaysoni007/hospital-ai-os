'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Users,
  Calendar,
  FileText,
  Activity,
  CheckSquare,
  Sparkles,
  Clock,
  CornerDownLeft,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Permission } from '../../../types/auth';
import { hasPermission } from '../../../utils/rbac';
import styles from './GlobalSearch.module.css';

export interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  category: 'patients' | 'appointments' | 'records' | 'diagnostics' | 'tasks' | 'ai';
  title: string;
  subtitle: string;
  badge?: string;
  permission?: Permission;
}

const DEMO_SEARCH_ITEMS: SearchItem[] = [
  {
    id: 'p1',
    category: 'patients',
    title: 'Eleanor Vance (58F)',
    subtitle: 'MRN: HOS-92841 • Cardiology • Bed 402-B',
    badge: 'Critical Alert',
    permission: 'patient:read',
  },
  {
    id: 'p2',
    category: 'patients',
    title: 'Arthur Pendelton (64M)',
    subtitle: 'MRN: HOS-88319 • OPD Queue #12 • Dr. Chen',
    permission: 'patient:read',
  },
  {
    id: 'a1',
    category: 'appointments',
    title: 'Cardiology Follow-up — Marcus Brody',
    subtitle: 'Today • 10:30 AM • OPD Room 304',
    badge: 'In Progress',
    permission: 'appointment:read',
  },
  {
    id: 'r1',
    category: 'records',
    title: 'Discharge Summary — Post-PCI Care',
    subtitle: 'Patient: Eleanor Vance • Dr. Sarah Chen',
    permission: 'clinical_record:read',
  },
  {
    id: 'd1',
    category: 'diagnostics',
    title: 'Comprehensive Metabolic Panel (STAT)',
    subtitle: 'Order #ORD-77491 • Panic Potassium: 6.2 mEq/L',
    badge: 'Panic Value',
    permission: 'diagnostic_result:read',
  },
  {
    id: 't1',
    category: 'tasks',
    title: 'Sign Pending Discharge Note #402',
    subtitle: 'Due in 45 minutes • High Priority',
    badge: 'STAT',
    permission: 'task:read',
  },
  {
    id: 'ai1',
    category: 'ai',
    title: 'Draft Progress Note for Bed 402',
    subtitle: 'AI Clinical Assistant • Synthesizes lab & telemetry',
    badge: 'AI Draft',
    permission: 'ai_interaction:invoke',
  },
];

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [recentSearches] = useState<string[]>([
    'Eleanor Vance HOS-92841',
    'Post-Op Orders',
    'Potassium Critical Value',
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global keydown for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter items by permission and search query
  const filteredItems = DEMO_SEARCH_ITEMS.filter((item) => {
    if (item.permission && !hasPermission(user?.role, item.permission)) {
      return false;
    }
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'patients':
        return <Users size={16} />;
      case 'appointments':
        return <Calendar size={16} />;
      case 'records':
        return <FileText size={16} />;
      case 'diagnostics':
        return <Activity size={16} />;
      case 'tasks':
        return <CheckSquare size={16} />;
      case 'ai':
        return <Sparkles size={16} />;
      default:
        return <Search size={16} />;
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchHeader}>
          <Search size={20} className={styles.searchIcon} aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search patients, MRN, encounters, orders, or ask AI..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Global search query"
          />
          {query && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => setQuery('')}
              aria-label="Clear search query"
            >
              <X size={16} />
            </button>
          )}
          <kbd className={styles.escKey} onClick={onClose}>
            ESC
          </kbd>
        </div>

        <div className={styles.resultsContainer}>
          {!query.trim() && recentSearches.length > 0 && (
            <div className={styles.recentSection}>
              <div className={styles.sectionHeader}>
                <Clock size={14} />
                <span>Recent Searches</span>
              </div>
              <div className={styles.recentTags}>
                {recentSearches.map((term, i) => (
                  <button
                    key={i}
                    type="button"
                    className={styles.recentTag}
                    onClick={() => setQuery(term)}
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.sectionHeader}>
            <span>{query ? 'Search Results' : 'Suggested Actions & Records'}</span>
            <span className={styles.resultCount}>{filteredItems.length} items</span>
          </div>

          {filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No matching resources found for &ldquo;{query}&rdquo;</p>
              <span className={styles.emptySubtext}>
                Try searching with a patient name or MRN number
              </span>
            </div>
          ) : (
            <div className={styles.resultsList}>
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={styles.resultItem}
                  onClick={() => {
                    onClose();
                  }}
                  tabIndex={0}
                  role="button"
                >
                  <div className={`${styles.itemCategoryIcon} ${styles[item.category]}`}>
                    {getCategoryIcon(item.category)}
                  </div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemTitleRow}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      {item.badge && (
                        <span className={`${styles.itemBadge} ${styles[item.category]}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <span className={styles.itemSubtitle}>{item.subtitle}</span>
                  </div>
                  <CornerDownLeft size={14} className={styles.selectIcon} aria-hidden="true" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.searchFooter}>
          <span className={styles.shortcutHint}>
            <kbd>↑</kbd> <kbd>↓</kbd> to navigate
          </span>
          <span className={styles.shortcutHint}>
            <kbd>↵</kbd> to select
          </span>
          <span className={styles.shortcutHint}>
            <kbd>esc</kbd> to dismiss
          </span>
        </div>
      </div>
    </div>
  );
}
