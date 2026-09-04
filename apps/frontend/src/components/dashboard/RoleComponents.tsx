'use client';

import React, { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import styles from './RoleComponents.module.css';

export type DateRangeKey = 'today' | '7d' | '30d' | '90d' | 'custom';

export const DATE_RANGES: { key: DateRangeKey; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
];

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRangeKey;
  onChange: (v: DateRangeKey) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className={styles.dateRangeFilter}
    >
      {DATE_RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          aria-pressed={value === r.key}
          onClick={() => onChange(r.key)}
          className={`${styles.dateRangeBtn} ${value === r.key ? styles.dateRangeBtnActive : ''}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function useDateRange(initial: DateRangeKey = '7d') {
  const [range, setRange] = useState<DateRangeKey>(initial);
  const days = DATE_RANGES.find((r) => r.key === range)?.days ?? 7;
  const clip = <T,>(series: T[]) => series.slice(Math.max(0, series.length - days));
  return { range, setRange, days, clip };
}

export function RoleIntro({
  title,
  subtitle,
  aside,
}: {
  title: string;
  subtitle: string;
  aside?: ReactNode;
}) {
  return (
    <div className={styles.roleIntro}>
      <div>
        <h1 className={styles.introTitle}>{title}</h1>
        <p className={styles.introSubtitle}>{subtitle}</p>
      </div>
      {aside}
    </div>
  );
}

export function MetricGrid({
  children,
  columns = 4,
}: {
  children: ReactNode;
  columns?: 4 | 6;
}) {
  return (
    <div className={columns === 6 ? styles.metricGrid6 : styles.metricGrid}>
      {children}
    </div>
  );
}

export function TrendIndicator({
  delta,
  invert = false,
}: {
  delta: number;
  invert?: boolean;
}) {
  const flat = Math.abs(delta) < 0.5;
  const good = invert ? delta < 0 : delta > 0;
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`${styles.trendBadge} ${
        flat ? styles.trendFlat : good ? styles.trendUp : styles.trendDown
      }`}
    >
      <Icon size={12} aria-hidden="true" />
      {flat ? '0%' : `${delta > 0 ? '+' : ''}${delta}%`}
    </span>
  );
}

export interface RoleMetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: number;
  invertDelta?: boolean;
  tone?: 'default' | 'critical' | 'warning' | 'success';
  href?: string;
}

export function RoleMetricCard({
  label,
  value,
  hint,
  delta,
  invertDelta,
  tone = 'default',
  href,
}: RoleMetricCardProps) {
  const toneClass =
    tone === 'critical'
      ? styles.metricCardCritical
      : tone === 'warning'
        ? styles.metricCardWarning
        : tone === 'success'
          ? styles.metricCardSuccess
          : '';

  const body = (
    <div className={`clinical-panel ${styles.metricCard} ${toneClass}`}>
      <p className={styles.metricLabel}>{label}</p>
      <div className={styles.metricValueRow}>
        <span
          className={`num ${styles.metricValue} ${
            tone === 'critical' ? styles.metricValueCritical : ''
          }`}
        >
          {value}
        </span>
        {delta !== undefined ? (
          <TrendIndicator delta={delta} invert={invertDelta} />
        ) : null}
      </div>
      {hint ? <p className={styles.metricHint}>{hint}</p> : null}
    </div>
  );

  return href ? (
    <Link href={href} className={styles.metricCardLink}>
      {body}
    </Link>
  ) : (
    body
  );
}

export function DashboardGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <div
      className={`${styles.dashboardGrid} ${
        columns === 3 ? styles.dashboardGrid3 : styles.dashboardGrid2
      }`}
    >
      {children}
    </div>
  );
}

export interface ChartCardProps {
  title: string;
  decision: string;
  children: ReactNode;
  action?: { label: string; href: string };
  summary?: string;
  aside?: ReactNode;
}

export function ChartCard({
  title,
  decision,
  children,
  action,
  summary,
  aside,
}: ChartCardProps) {
  return (
    <section className={`clinical-panel ${styles.chartCard}`} aria-label={title}>
      <header className={styles.chartCardHeader}>
        <div>
          <h3 className={styles.chartCardTitle}>{title}</h3>
          <p className={styles.chartCardDecision}>{decision}</p>
        </div>
        {aside}
        {action ? (
          <Link href={action.href} className={styles.chartCardAction}>
            {action.label}
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        ) : null}
      </header>
      <div className={styles.chartCardBody}>{children}</div>
      {summary ? <p className="sr-only">{summary}</p> : null}
    </section>
  );
}
