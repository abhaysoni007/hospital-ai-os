'use client';

/**
 * Security Admin Audit Log Ledger Viewer
 * Consumes existing GET /api/v1/audit endpoint with SHA-256 tamper-evident verification.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Shield,
  ShieldAlert,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Copy,
  Check,
  X,
  Lock,
  Database,
  Calendar,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import type { AuditEventResponse } from 'shared';
import { AppShell } from '../../../components/layout/AppShell/AppShell';
import { Table, THead, TH, TBody, TR, TD, TableSkeleton } from '../../../components/ui/Table/Table';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
import { EmptyState } from '../../../components/ui/EmptyState/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState/ErrorState';
import { MetricCard } from '../../../components/ui/MetricCard/MetricCard';
import { auditService } from '../../../services/audit-service';
import {
  formatEventType,
  getEventCategory,
  getEventSeverity,
  getSeverityBadgeVariant,
  isGenesisHash,
  truncateHash,
  sanitizeActionDetail,
  type AuditCategory,
} from '../../../utils/audit-helpers';
import styles from './audit.module.css';

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEventResponse[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuditEventResponse | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'all' | 'today' | '24h' | '7d' | '30d'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Compute server startDate from dateRange filter
  const serverStartDate = useMemo(() => {
    const now = new Date();
    if (dateRange === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return todayStart.toISOString();
    }
    if (dateRange === '24h') {
      return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    }
    if (dateRange === '7d') {
      return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    if (dateRange === '30d') {
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
    return undefined;
  }, [dateRange]);

  // Fetch real audit events from GET /api/v1/audit
  const fetchAuditEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await auditService.getEvents({
        page,
        pageSize,
        startDate: serverStartDate,
      });

      setEvents(Array.isArray(response?.data) ? response.data : []);
      if (response?.meta) {
        setMeta(response.meta);
      } else {
        const count = Array.isArray(response?.data) ? response.data.length : 0;
        setMeta({ total: count, page, limit: pageSize, totalPages: Math.ceil(count / pageSize) || 1 });
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load audit events from security ledger.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, serverStartDate]);

  useEffect(() => {
    void fetchAuditEvents();
  }, [fetchAuditEvents]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedEvent(null);
      }
    };
    if (selectedEvent) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedEvent]);

  // Derived Metrics: calculated strictly from returned records and meta.total
  const derivedMetrics = useMemo(() => {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let todayCount = 0;
    let criticalCount = 0;
    let breakGlassCount = 0;

    for (const evt of events) {
      const evtTime = new Date(evt.createdAt).getTime();
      if (!Number.isNaN(evtTime) && evtTime >= todayMidnight) {
        todayCount++;
      }

      const severity = getEventSeverity(evt);
      if (severity === 'critical') {
        criticalCount++;
      }

      const isBreakGlass =
        (evt.eventType && evt.eventType.toUpperCase().includes('BREAK_GLASS')) ||
        evt.targetType === 'BREAK_GLASS_SESSION';
      if (isBreakGlass) {
        breakGlassCount++;
      }
    }

    return {
      total: meta.total,
      today: todayCount,
      critical: criticalCount,
      breakGlass: breakGlassCount,
    };
  }, [events, meta.total]);

  // Derivable unique roles from current dataset for the role filter
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    for (const evt of events) {
      if (evt.actorRole) roles.add(evt.actorRole);
    }
    return Array.from(roles).sort();
  }, [events]);

  // Client-side filtering across currently loaded records
  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return events.filter((evt) => {
      // 1. Text Search across actor, eventType, patient, correlation, target, dept
      if (query) {
        const matchesQuery =
          (evt.actorId && evt.actorId.toLowerCase().includes(query)) ||
          (evt.eventType && evt.eventType.toLowerCase().includes(query)) ||
          (evt.actorRole && evt.actorRole.toLowerCase().includes(query)) ||
          (evt.actorDepartment && evt.actorDepartment.toLowerCase().includes(query)) ||
          (evt.patientId && evt.patientId.toLowerCase().includes(query)) ||
          (evt.targetType && evt.targetType.toLowerCase().includes(query)) ||
          (evt.targetId && evt.targetId.toLowerCase().includes(query)) ||
          (evt.correlationId && evt.correlationId.toLowerCase().includes(query)) ||
          String(evt.sequenceNumber).includes(query);

        if (!matchesQuery) return false;
      }

      // 2. Category Filter
      if (selectedCategory !== 'all') {
        const cat = getEventCategory(evt.eventType);
        if (cat !== selectedCategory) return false;
      }

      // 3. Severity Filter
      if (selectedSeverity !== 'all') {
        const sev = getEventSeverity(evt);
        if (sev !== selectedSeverity) return false;
      }

      // 4. Role Filter
      if (selectedRole !== 'all') {
        if (evt.actorRole !== selectedRole) return false;
      }

      return true;
    });
  }, [events, searchQuery, selectedCategory, selectedSeverity, selectedRole]);

  // Copy to clipboard helper
  const handleCopy = (text: string, fieldName: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const categories: { id: AuditCategory; label: string }[] = [
    { id: 'all', label: 'All Events' },
    { id: 'break_glass', label: 'Break-Glass' },
    { id: 'clinical', label: 'Clinical' },
    { id: 'diagnostics', label: 'Diagnostics' },
    { id: 'patient', label: 'Patients' },
    { id: 'intelligence', label: 'AI Intel' },
    { id: 'system', label: 'System' },
  ];

  return (
    <AppShell
      breadcrumbs={['Administration', 'Audit']}
      requiredPermission="audit_event:read"
      variant="wide"
    >
      <div className={styles.container}>
        {/* Tactical Header Card */}
        <div className={styles.headerCard}>
          <div className={styles.headerLeft}>
            <span className={styles.headerIcon} aria-hidden="true">
              <Shield size={22} />
            </span>
            <div className={styles.headerContent}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>Audit Log</h1>
                <span className={styles.chainTag} title="Continuous SHA-256 cryptographic chain">
                  <span className={styles.chainDot} aria-hidden="true" />
                  SHA-256 Hash Chain
                </span>
              </div>
              <p className={styles.subtitle}>
                Tamper-evident clinical and security activity ledger
              </p>
            </div>
          </div>

          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={<RefreshCw size={14} className={loading ? 'spin-icon' : ''} />}
              onClick={() => void fetchAuditEvents()}
              disabled={loading}
              aria-label="Refresh audit log"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Derived Summary Metric Cards */}
        <div className={styles.statsGrid}>
          <MetricCard
            label="Total Events"
            value={loading ? '—' : derivedMetrics.total}
            icon={<Database size={20} />}
            tone="primary"
            hint="Total records in ledger"
          />
          <MetricCard
            label="Today"
            value={loading ? '—' : derivedMetrics.today}
            icon={<Calendar size={20} />}
            tone="info"
            hint="In loaded page window"
          />
          <MetricCard
            label="Critical / High Risk"
            value={loading ? '—' : derivedMetrics.critical}
            icon={<AlertTriangle size={20} />}
            tone={derivedMetrics.critical > 0 ? 'critical' : 'warning'}
            hint="In loaded page window"
          />
          <MetricCard
            label="Break-Glass Events"
            value={loading ? '—' : derivedMetrics.breakGlass}
            icon={<ShieldAlert size={20} />}
            tone={derivedMetrics.breakGlass > 0 ? 'critical' : 'success'}
            hint="In loaded page window"
          />
        </div>

        {/* Filter Toolbar */}
        <div className={styles.filterCard}>
          <div className={styles.filterTopRow}>
            <div className={styles.searchWrap}>
              <Input
                id="audit-search-input"
                label="Search audit events"
                hideLabel
                placeholder="Search actor, event, patient, correlation, sequence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                iconLeft={<Search size={16} aria-hidden="true" />}
                type="search"
              />
            </div>

            <div className={styles.controlsWrap}>
              {/* Date Range Server Filter */}
              <select
                id="audit-date-range"
                className={styles.selectInput}
                value={dateRange}
                onChange={(e) => {
                  setDateRange(e.target.value as 'all' | 'today' | '24h' | '7d' | '30d');
                  setPage(1);
                }}
                aria-label="Filter by date range"
              >
                <option value="all">Date: All Time</option>
                <option value="today">Date: Today</option>
                <option value="24h">Date: Past 24 Hours</option>
                <option value="7d">Date: Past 7 Days</option>
                <option value="30d">Date: Past 30 Days</option>
              </select>

              {/* Severity Filter */}
              <select
                id="audit-severity-filter"
                className={styles.selectInput}
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                aria-label="Filter by severity"
              >
                <option value="all">Severity: All</option>
                <option value="critical">Critical / High</option>
                <option value="warning">Warning</option>
                <option value="stable">Stable / Verified</option>
                <option value="info">Informational</option>
              </select>

              {/* Derivable Role Filter */}
              <select
                id="audit-role-filter"
                className={styles.selectInput}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                aria-label="Filter by actor role"
              >
                <option value="all">Role: All</option>
                {availableRoles.map((role) => (
                  <option key={role} value={role}>
                    Role: {role.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>

              {(searchQuery || selectedCategory !== 'all' || selectedSeverity !== 'all' || selectedRole !== 'all' || dateRange !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedSeverity('all');
                    setSelectedRole('all');
                    setDateRange('all');
                    setPage(1);
                  }}
                  iconLeft={<X size={14} />}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Event Category Pills */}
          <div
            role="group"
            aria-label="Filter by event category"
            className={styles.categoryGroup}
          >
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`${styles.categoryButton} ${
                  selectedCategory === cat.id ? styles.categoryButtonActive : ''
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Data Table Card */}
        <div className={styles.tableCard}>
          <div className={styles.cardBar}>
            <h2 className={styles.cardTitle}>
              <Activity size={18} aria-hidden="true" />
              Activity Ledger Records
            </h2>
            <span className={styles.liveCount}>
              {loading
                ? 'Loading...'
                : `${filteredEvents.length} shown of ${events.length} loaded (${meta.total} total)`}
            </span>
          </div>

          {loading ? (
            <div style={{ padding: '1.25rem' }}>
              <TableSkeleton rows={8} />
            </div>
          ) : error ? (
            <div style={{ padding: '1.5rem' }}>
              <ErrorState
                title="Error Loading Audit Ledger"
                message={error}
                onRetry={() => void fetchAuditEvents()}
              />
            </div>
          ) : events.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState
                icon={<Shield size={36} />}
                title="No Audit Records Found"
                description={
                  dateRange !== 'all'
                    ? 'No audit events recorded for the selected date range.'
                    : 'The tamper-evident audit ledger is currently empty.'
                }
              />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div style={{ padding: '2rem' }}>
              <EmptyState
                icon={<Filter size={36} />}
                title="No Events Match Filters"
                description="Try clearing or adjusting search keywords, categories, or severity filters."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                      setSelectedSeverity('all');
                      setSelectedRole('all');
                    }}
                  >
                    Reset Active Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <Table ariaLabel="Tamper-evident audit event ledger">
              <THead>
                <tr>
                  <TH width="170px">Timestamp &amp; Seq</TH>
                  <TH width="170px">Actor</TH>
                  <TH width="130px">Role</TH>
                  <TH>Event / Action</TH>
                  <TH width="150px">Resource</TH>
                  <TH width="120px">Patient</TH>
                  <TH width="110px">Severity</TH>
                  <TH width="100px">Status</TH>
                  <TH width="120px">Hash Chain</TH>
                </tr>
              </THead>
              <TBody>
                {filteredEvents.map((evt) => {
                  const severity = getEventSeverity(evt);
                  const isBreakGlass =
                    (evt.eventType && evt.eventType.toUpperCase().includes('BREAK_GLASS')) ||
                    evt.targetType === 'BREAK_GLASS_SESSION';
                  const isGenesis = isGenesisHash(evt.previousHash);
                  const detail = evt.actionDetail as Record<string, unknown> | null | undefined;
                  const statusText =
                    typeof detail?.status === 'string'
                      ? detail.status.toUpperCase()
                      : evt.eventType.includes('FAILED')
                      ? 'FAILED'
                      : 'RECORDED';

                  return (
                    <TR
                      key={evt.id}
                      interactive
                      onClick={() => setSelectedEvent(evt)}
                      className={isBreakGlass ? styles.breakGlassRow : ''}
                      title="Click or press Enter to inspect full cryptographic event details"
                    >
                      {/* Timestamp & Sequence */}
                      <TD>
                        <div>
                          <span className={styles.seqTag}>#{evt.sequenceNumber}</span>
                          <span className={styles.monoText}>
                            {new Date(evt.createdAt).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </TD>

                      {/* Actor & Department */}
                      <TD>
                        <div className={styles.actorWrap}>
                          <span
                            className={styles.monoText}
                            title={evt.actorId}
                          >
                            {evt.actorId.slice(0, 8)}…
                          </span>
                          <span className={styles.deptText} title={evt.actorDepartment}>
                            {evt.actorDepartment || 'General'}
                          </span>
                        </div>
                      </TD>

                      {/* Role */}
                      <TD>
                        <Badge
                          variant={
                            evt.actorRole === 'security_admin'
                              ? 'primary'
                              : evt.actorRole === 'physician'
                              ? 'ai-assist'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {evt.actorRole}
                        </Badge>
                      </TD>

                      {/* Event / Action */}
                      <TD>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {isBreakGlass && (
                            <ShieldAlert
                              size={15}
                              style={{ color: 'var(--hud-rose)', flexShrink: 0 }}
                              aria-label="Break Glass Event"
                            />
                          )}
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {formatEventType(evt.eventType)}
                          </span>
                        </div>
                      </TD>

                      {/* Resource / Target */}
                      <TD>
                        {evt.targetType ? (
                          <div className={styles.actorWrap}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                              {evt.targetType}
                            </span>
                            {evt.targetId && (
                              <span
                                className={styles.monoText}
                                style={{ color: 'var(--text-tertiary)', fontSize: '0.6875rem' }}
                                title={evt.targetId}
                              >
                                {evt.targetId.slice(0, 8)}…
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </TD>

                      {/* Patient */}
                      <TD>
                        {evt.patientId ? (
                          <span
                            className={styles.monoText}
                            style={{ color: 'var(--hud-cyan)', fontWeight: 600 }}
                            title={evt.patientId}
                          >
                            {evt.patientId.slice(0, 8)}…
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                        )}
                      </TD>

                      {/* Severity */}
                      <TD>
                        <Badge variant={getSeverityBadgeVariant(severity)} size="sm">
                          {severity.toUpperCase()}
                        </Badge>
                      </TD>

                      {/* Status / Result */}
                      <TD>
                        <span
                          className={styles.monoText}
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color:
                              statusText === 'FAILED'
                                ? 'var(--hud-rose)'
                                : 'var(--text-secondary)',
                          }}
                        >
                          {statusText}
                        </span>
                      </TD>

                      {/* Hash Chain */}
                      <TD>
                        {isGenesis ? (
                          <span className={styles.genesisBadge} title="Genesis event in chain">
                            GENESIS
                          </span>
                        ) : (
                          <span
                            className={styles.hashBadge}
                            title={`SHA-256: ${evt.recordHash}`}
                          >
                            <Lock size={10} aria-hidden="true" />
                            {truncateHash(evt.recordHash, 4, 4)}
                          </span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}

          {/* Pagination Controls */}
          {!loading && meta.totalPages > 0 && (
            <div className={styles.paginationBar}>
              <div className={styles.paginationInfo}>
                Showing {(meta.page - 1) * meta.limit + 1}–
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} records (Page{' '}
                {meta.page} of {meta.totalPages})
              </div>

              <div className={styles.paginationControls}>
                <label htmlFor="audit-page-size" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Per page:
                </label>
                <select
                  id="audit-page-size"
                  className={styles.selectInput}
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  aria-label="Events per page"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>

                <button
                  type="button"
                  className={styles.pageButton}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={styles.pageButton}
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Row Detail Modal / Drawer */}
        {selectedEvent && (
          <div
            className={styles.modalOverlay}
            onClick={() => setSelectedEvent(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
          >
            <div
              className={styles.modalDialog}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className={styles.modalHeader}>
                <h3 id="audit-modal-title" className={styles.modalTitle}>
                  <Shield size={20} style={{ color: 'var(--hud-cyan)' }} aria-hidden="true" />
                  <span>{formatEventType(selectedEvent.eventType)}</span>
                  <span className={styles.seqTag}>#{selectedEvent.sequenceNumber}</span>
                </h3>
                <button
                  type="button"
                  className={styles.copyButton}
                  onClick={() => setSelectedEvent(null)}
                  aria-label="Close audit detail modal"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div className={styles.modalBody}>
                {/* Cryptographic Hash Verification Block */}
                <div className={styles.cryptoCard}>
                  <div className={styles.cryptoTitle}>
                    <CheckCircle2 size={16} style={{ color: 'var(--hud-emerald)' }} />
                    Cryptographic Ledger Verification (SHA-256)
                  </div>

                  <div className={styles.hashRow}>
                    <span className={styles.hashLabel}>Current Record Hash</span>
                    <div className={styles.hashValue}>
                      <span>{selectedEvent.recordHash}</span>
                      <button
                        type="button"
                        className={styles.copyButton}
                        onClick={() => handleCopy(selectedEvent.recordHash, 'recordHash')}
                        title="Copy SHA-256 hash"
                        aria-label="Copy record hash"
                      >
                        {copiedField === 'recordHash' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.hashRow}>
                    <span className={styles.hashLabel}>
                      Previous Hash ({isGenesisHash(selectedEvent.previousHash) ? 'Genesis Block' : 'Chained Parent'})
                    </span>
                    <div className={styles.hashValue}>
                      <span>{selectedEvent.previousHash}</span>
                      <button
                        type="button"
                        className={styles.copyButton}
                        onClick={() => handleCopy(selectedEvent.previousHash, 'previousHash')}
                        title="Copy parent hash"
                        aria-label="Copy previous hash"
                      >
                        {copiedField === 'previousHash' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Event Metadata Grid */}
                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Timestamp</span>
                    <span className={`${styles.metaValue} ${styles.monoText}`}>
                      {new Date(selectedEvent.createdAt).toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
                      {new Date(selectedEvent.createdAt).toISOString()}
                    </span>
                  </div>

                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Correlation / Request ID</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span className={`${styles.metaValue} ${styles.monoText}`}>
                        {selectedEvent.correlationId}
                      </span>
                      <button
                        type="button"
                        className={styles.copyButton}
                        onClick={() => handleCopy(selectedEvent.correlationId, 'correlationId')}
                        aria-label="Copy correlation ID"
                      >
                        {copiedField === 'correlationId' ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>Actor ID &amp; Role</span>
                    <span className={`${styles.metaValue} ${styles.monoText}`}>
                      {selectedEvent.actorId}
                    </span>
                    <div style={{ marginTop: '0.25rem' }}>
                      <Badge variant="neutral" size="sm">
                        {selectedEvent.actorRole}
                      </Badge>{' '}
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        ({selectedEvent.actorDepartment || 'General'})
                      </span>
                    </div>
                  </div>

                  <div className={styles.metaItem}>
                    <span className={styles.metaLabel}>IP Address</span>
                    <span className={`${styles.metaValue} ${styles.monoText}`}>
                      {selectedEvent.ipAddress || 'Internal Network / Direct'}
                    </span>
                  </div>

                  {selectedEvent.patientId && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Patient ID</span>
                      <span className={`${styles.metaValue} ${styles.monoText}`} style={{ color: 'var(--hud-cyan)' }}>
                        {selectedEvent.patientId}
                      </span>
                    </div>
                  )}

                  {selectedEvent.targetType && (
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>Target Resource</span>
                      <span className={styles.metaValue}>
                        <strong>{selectedEvent.targetType}</strong>
                        {selectedEvent.targetId && (
                          <span className={`${styles.monoText} block`} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            ID: {selectedEvent.targetId}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Clinical Justification (especially for Break-Glass) */}
                {selectedEvent.justification && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <span className={styles.metaLabel}>Emergency / Clinical Justification</span>
                    <div className={styles.justificationBlock}>
                      &quot;{selectedEvent.justification}&quot;
                    </div>
                  </div>
                )}

                {/* Sanitized Action Details (Confidential credentials stripped) */}
                {selectedEvent.actionDetail && Object.keys(selectedEvent.actionDetail).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <span className={styles.metaLabel}>
                      Event Metadata Payload (Sanitized)
                    </span>
                    <pre className={styles.jsonBlock}>
                      {JSON.stringify(sanitizeActionDetail(selectedEvent.actionDetail), null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className={styles.modalFooter}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedEvent(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
