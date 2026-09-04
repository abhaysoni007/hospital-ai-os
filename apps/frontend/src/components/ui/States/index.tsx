import React, { type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CircleSlash,
  Inbox,
  Lock,
  ServerCrash,
  SearchX,
  WifiOff,
  Sparkles,
} from 'lucide-react';
import { Skeleton } from '../Skeleton/Skeleton';
import { Button } from '../Button/Button';
import styles from './States.module.css';

/* ------------------------------------------------------------- Skeletons */

export function MetricSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={styles.metricSkeletonGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`clinical-panel ${styles.panelSkeleton}`}>
          <Skeleton width="96px" height="12px" />
          <Skeleton width="64px" height="32px" />
          <Skeleton width="128px" height="12px" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className={`clinical-panel ${styles.panelSkeleton}`}>
      <Skeleton width="160px" height="14px" />
      <Skeleton width="224px" height="12px" />
      <Skeleton width="100%" height={`${height}px`} />
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className={`clinical-panel ${styles.tableSkeleton}`}>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className={styles.tableSkeletonRow}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width="80%" height="16px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className={styles.dashboardSkeleton}>
      <MetricSkeleton />
      <div className={styles.chartSkeletonGrid}>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className={styles.detailSkeleton}>
      <div className={`clinical-panel ${styles.panelSkeleton}`}>
        <Skeleton width="224px" height="20px" />
        <Skeleton width="288px" height="14px" />
      </div>
      <div className={styles.detailGrid}>
        <ChartSkeleton height={160} />
        <ChartSkeleton height={160} />
        <ChartSkeleton height={160} />
      </div>
      <TableSkeleton rows={4} />
    </div>
  );
}

/* ------------------------------------------------------------- Empty States */

export interface LovableEmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyStateBox({
  title,
  description,
  action,
  icon,
  className,
}: LovableEmptyStateProps) {
  return (
    <div className={`${styles.emptyBox} ${className ?? ''}`}>
      <div className={styles.emptyIcon} aria-hidden="true">
        {icon ?? <Inbox size={24} />}
      </div>
      <p className={styles.emptyTitle}>{title}</p>
      {description ? <p className={styles.emptyDescription}>{description}</p> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------- Error States */

interface ErrorShellProps {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}

function ErrorShell({ icon, title, body, action }: ErrorShellProps) {
  return (
    <div role="alert" className={`clinical-panel ${styles.errorShell}`}>
      <div className={styles.errorIcon} aria-hidden="true">
        {icon}
      </div>
      <p className={styles.errorTitle}>{title}</p>
      <p className={styles.errorBody}>{body}</p>
      {action ? <div className={styles.errorAction}>{action}</div> : null}
    </div>
  );
}

export function NetworkErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorShell
      icon={<WifiOff size={24} />}
      title="Connection lost"
      body="Unable to reach the hospital network. Your unsaved input is retained locally."
      action={
        onRetry ? (
          <Button variant="primary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}

export function ServerErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorShell
      icon={<ServerCrash size={24} />}
      title="This section failed to load"
      body="The service is temporarily unavailable. Clinical records remain safely stored on the server."
      action={
        onRetry ? (
          <Button variant="primary" size="sm" onClick={onRetry}>
            Reload section
          </Button>
        ) : undefined
      }
    />
  );
}

export function PermissionDeniedState({ resource = 'this area' }: { resource?: string }) {
  return (
    <ErrorShell
      icon={<Lock size={24} />}
      title="Access Restricted"
      body={`Your authenticated role does not include permission to access ${resource}. Contact your hospital administrator if you believe this is in error.`}
      action={
        <Link href="/dashboard" className={styles.linkButton}>
          Back to dashboard
        </Link>
      }
    />
  );
}

export function NotFoundState({ what = 'record' }: { what?: string }) {
  return (
    <ErrorShell
      icon={<SearchX size={24} />}
      title={`Unable to locate that ${what}`}
      body="It may have been discharged from the active list, merged, or the identifier is invalid."
      action={
        <Link href="/dashboard" className={styles.linkButton}>
          Back to dashboard
        </Link>
      }
    />
  );
}

export function ValidationErrorState({ issues }: { issues: string[] }) {
  return (
    <div role="alert" className={styles.validationBox}>
      <p className={styles.validationTitle}>
        <AlertTriangle size={16} aria-hidden="true" />
        Please resolve {issues.length} {issues.length === 1 ? 'issue' : 'issues'} before continuing
      </p>
      <ul className={styles.validationList}>
        {issues.map((issue, idx) => (
          <li key={idx}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

export function DegradedModeBanner({ message }: { message: string }) {
  return (
    <div role="status" className={styles.degradedBanner}>
      <CircleSlash size={16} className={styles.degradedIcon} aria-hidden="true" />
      <span>
        <strong>Degraded mode.</strong> {message}
      </span>
    </div>
  );
}

export function SuccessState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`clinical-panel ${styles.successBox}`}>
      <div className={styles.successIcon} aria-hidden="true">
        <Sparkles size={24} />
      </div>
      <p className={styles.successTitle}>{title}</p>
      {description ? <p className={styles.successDesc}>{description}</p> : null}
      {action ? <div className={styles.successAction}>{action}</div> : null}
    </div>
  );
}
