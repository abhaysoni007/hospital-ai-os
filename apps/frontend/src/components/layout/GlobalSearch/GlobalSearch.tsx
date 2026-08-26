'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Users, AlertOctagon } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { hasPermission } from '../../../utils/rbac';
import { patientService } from '../../../services/patient-service';
import type { PatientResponse } from 'shared';
import styles from './GlobalSearch.module.css';

export interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * M12.2 — REAL global search over the patient directory.
 * Uses the existing permission-controlled GET /patients endpoint (patient:read).
 * No fabricated records: loading, error and empty states are truthful, and an
 * AbortController prevents stale responses from overwriting newer ones.
 */

const MIN_QUERY_LENGTH = 2;

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PatientResponse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const canSearchPatients = hasPermission(user?.role, 'patient:read');

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    setQuery('');
    setResults([]);
    setSearched(false);
    setSearchError(null);
    return undefined;
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

  // Debounced real search with stale-response protection
  useEffect(() => {
    if (!isOpen || !canSearchPatients) return undefined;
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearched(false);
      setSearchError(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsSearching(true);
      setSearchError(null);
      try {
        const res = await patientService.getPatients({ page: 1, query: trimmed, pageSize: 8 });
        if (controller.signal.aborted) return;
        setResults(res.data as unknown as PatientResponse[]);
        setSearched(true);
      } catch (err) {
        if (controller.signal.aborted) return;
        setResults([]);
        setSearched(true);
        setSearchError(
          err instanceof Error && err.message.includes('403')
            ? 'Your role does not have access to the patient directory.'
            : 'Patient search is unavailable right now.',
        );
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, isOpen, canSearchPatients]);

  if (!isOpen) return null;

  const openPatient = (id: string) => {
    onClose();
    router.push(`/patients/${id}`);
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
            placeholder={
              canSearchPatients
                ? 'Search patients by name or MRN…'
                : 'Patient search requires patient:read access'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Global search query"
            disabled={!canSearchPatients}
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
          {!canSearchPatients ? (
            <div className={styles.emptyState} role="status">
              <p>Your role does not include patient directory access.</p>
              <span className={styles.emptySubtext}>Use the sidebar to reach your workflows.</span>
            </div>
          ) : isSearching ? (
            <div className={styles.emptyState} role="status" aria-live="polite">
              <p>Searching…</p>
            </div>
          ) : searchError ? (
            <div className={styles.emptyState} role="alert">
              <AlertOctagon size={20} />
              <p>{searchError}</p>
            </div>
          ) : !query.trim() || query.trim().length < MIN_QUERY_LENGTH ? (
            <div className={styles.emptyState}>
              <Users size={20} />
              <p>Type at least {MIN_QUERY_LENGTH} characters to search patients</p>
              <span className={styles.emptySubtext}>
                Results come live from the patient directory.
              </span>
            </div>
          ) : searched && results.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No patients found for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <>
              <div className={styles.sectionHeader}>
                <span>Patients</span>
                <span className={styles.resultCount}>{results.length} found</span>
              </div>
              <div className={styles.resultsList}>
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.resultItem}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: 'none',
                      border: 'none',
                    }}
                    onClick={() => openPatient(p.id)}
                  >
                    <div className={`${styles.itemCategoryIcon} ${styles.patients}`}>
                      <Users size={16} />
                    </div>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemTitleRow}>
                        <span className={styles.itemTitle}>
                          {p.firstName} {p.lastName}
                        </span>
                        <span className={`${styles.itemBadge} ${styles.patients}`}>{p.mrn}</span>
                      </div>
                      <span className={styles.itemSubtitle}>
                        {p.gender}, {p.dateOfBirth}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className={styles.searchFooter}>
          <span className={styles.shortcutHint}>
            <kbd>esc</kbd> to dismiss
          </span>
        </div>
      </div>
    </div>
  );
}
