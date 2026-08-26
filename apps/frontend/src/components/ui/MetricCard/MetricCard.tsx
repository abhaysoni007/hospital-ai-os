import React from 'react';
import Link from 'next/link';
import styles from './MetricCard.module.css';

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'info' | 'warning' | 'critical' | 'success';
  hint?: React.ReactNode;
  /** Optional destination — makes every metric a navigation affordance. */
  href?: string;
  action?: React.ReactNode;
  /** Accessible live-region politeness for values that update in place. */
  liveValue?: boolean;
}

const TONE_CLASS: Record<NonNullable<MetricCardProps['tone']>, string> = {
  neutral: styles.neutral,
  primary: styles.primary,
  info: styles.info,
  warning: styles.warning,
  critical: styles.critical,
  success: styles.success,
};

export function MetricCard({
  label,
  value,
  icon,
  tone = 'neutral',
  hint,
  href,
  action,
  liveValue = false,
}: MetricCardProps) {
  const body = (
    <>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <span className={`${styles.iconWrap} ${TONE_CLASS[tone]}`}>{icon}</span>
      </div>
      <div className={styles.value} {...(liveValue ? { 'aria-live': 'polite' as const } : {})}>
        {value}
      </div>
      {(hint || action) && (
        <div className={styles.footer}>
          {hint && <span className={styles.hint}>{hint}</span>}
          {action}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={styles.cardAsLink}>
        {body}
      </Link>
    );
  }
  return <div className={styles.card}>{body}</div>;
}

export function MetricRetry({ onRetry, label }: { onRetry: () => void; label: string }) {
  return (
    <button type="button" className={styles.retry} onClick={onRetry}>
      {label}
    </button>
  );
}
