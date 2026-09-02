import React from 'react';
import Link from 'next/link';
import { Sparkline, SparklineTone } from '../Sparkline/Sparkline';
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
  /**
   * Optional sparkline series. When present, a small trend visualisation
   * is rendered next to the icon. Only rendered when the array has 2+
   * points — single-point trends are not meaningful.
   */
  trend?: number[];
  /**
   * Optional day-over-day delta chip (e.g., "↑ 12% vs yesterday"). Only
   * shown when the caller has computed a real delta. Falsy hides the chip.
   */
  delta?: {
    direction: 'up' | 'down' | 'flat';
    label: string;
  };
}

const TONE_CLASS: Record<NonNullable<MetricCardProps['tone']>, string> = {
  neutral: styles.neutral,
  primary: styles.primary,
  info: styles.info,
  warning: styles.warning,
  critical: styles.critical,
  success: styles.success,
};

/**
 * Card-level accent classes: border-left colour only. The card must NOT
 * reuse TONE_CLASS — those also set a light tinted background (meant for
 * the icon chip) which would override the card's themed surface and make
 * the value text unreadable in dark mode.
 */
const TONE_ACCENT: Record<NonNullable<MetricCardProps['tone']>, string> = {
  neutral: styles.accentNeutral,
  primary: styles.accentPrimary,
  info: styles.accentInfo,
  warning: styles.accentWarning,
  critical: styles.accentCritical,
  success: styles.accentSuccess,
};

const TONE_SPARKLINE: Record<NonNullable<MetricCardProps['tone']>, SparklineTone> = {
  neutral: 'primary',
  primary: 'primary',
  info: 'info',
  warning: 'warning',
  critical: 'critical',
  success: 'success',
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
  trend,
  delta,
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
      {(hint || action || delta || (trend && trend.length >= 2)) && (
        <div className={styles.footer}>
          {hint && <span className={styles.hint}>{hint}</span>}
          {action}
          {(delta || (trend && trend.length >= 2)) && (
            <span className={styles.trendRow} aria-hidden={trend ? 'true' : undefined}>
              {delta && (
                <span
                  className={`${styles.delta} ${styles[`delta_${delta.direction}`]}`}
                  aria-label={delta.label}
                  title={delta.label}
                >
                  {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→'}{' '}
                  {/* Compact chip: arrow + percent only; the full
                      "… vs yesterday" context is in the tooltip. */}
                  {delta.label.split(' ')[0]}
                </span>
              )}
              {trend && trend.length >= 2 && (
                <span className={styles.trendWrap}>
                  <Sparkline data={trend} tone={TONE_SPARKLINE[tone]} />
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={`${href}`} className={`${styles.cardAsLink} ${TONE_ACCENT[tone]}`}>
        {body}
      </Link>
    );
  }
  return <div className={`${styles.card} ${TONE_ACCENT[tone]}`}>{body}</div>;
}

export function MetricRetry({ onRetry, label }: { onRetry: () => void; label: string }) {
  return (
    <button type="button" className={styles.retry} onClick={onRetry}>
      {label}
    </button>
  );
}
