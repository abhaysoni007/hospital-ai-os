import React from 'react';
import styles from './DonutChart.module.css';

export type DonutTone = 'primary' | 'info' | 'warning' | 'critical' | 'success' | 'neutral';

export interface DonutSegment {
  label: string;
  value: number;
  tone: DonutTone;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  /** Big number rendered in the centre of the donut (typically the total). */
  centerLabel: string;
  /** Small caption rendered under the centre number. */
  centerSublabel?: string;
  /** Diameter in pixels. */
  size?: number;
  /** Optional accessible summary for the figure. */
  ariaLabel?: string;
}

const TONE_STROKE: Record<DonutTone, string> = {
  primary: 'var(--color-primary-500)',
  info: 'var(--color-info-main)',
  warning: 'var(--color-warning-main)',
  critical: 'var(--color-danger-main)',
  success: 'var(--color-success-main)',
  neutral: 'var(--color-neutral-300)',
};

/**
 * Inline-SVG donut chart for clinical status distributions.
 *
 * Built with the classic `stroke-dasharray` pie technique:
 *   - One full circle per segment with `stroke-dasharray` and
 *     `stroke-dashoffset` shifting each slice around the circumference.
 *   - Segments are stacked by accumulating the previous dash offsets so
 *     the donut stays gapless.
 *
 * No chart library. All colours come from existing semantic tokens.
 * Renders a centred total, a legend with counts and percentages, and
 * exposes the breakdown to assistive tech via `aria-label`.
 */
export function DonutChart({
  segments,
  centerLabel,
  centerSublabel,
  size = 180,
  ariaLabel,
}: DonutChartProps) {
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value), 0);
  const safeTotal = total > 0 ? total : 1;

  let cumulative = 0;
  const arcs = segments.map((seg) => {
    const fraction = Math.max(0, seg.value) / safeTotal;
    const dashLength = circumference * fraction;
    const dashGap = circumference - dashLength;
    const offset = circumference - circumference * cumulative;
    cumulative += fraction;
    return {
      ...seg,
      fraction,
      dashArray: `${dashLength} ${dashGap}`,
      dashOffset: offset,
    };
  });

  const summary = segments
    .map((s) => `${s.label} ${s.value} (${Math.round((s.value / safeTotal) * 100)}%)`)
    .join('; ');
  const label = ariaLabel ?? `Distribution. ${summary}. Total ${total}.`;

  return (
    <figure className={styles.figure}>
      <div className={styles.donutWrap}>
        <svg
          className={styles.svg}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={label}
        >
          {/* Background ring — neutral so an empty dataset still reads as a ring. */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border-subtle)"
            strokeWidth={strokeWidth}
          />
          {/* Foreground segments */}
          {arcs.map((seg, i) => (
            <circle
              key={`seg-${i}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={TONE_STROKE[seg.tone]}
              strokeWidth={strokeWidth}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className={styles.center} aria-hidden="true">
          <span className={styles.centerValue}>{centerLabel}</span>
          {centerSublabel && <span className={styles.centerSub}>{centerSublabel}</span>}
        </div>
      </div>
      <ul className={styles.legend} aria-label="Distribution legend">
        {arcs.map((seg, i) => {
          const percentText = `${Math.round(seg.fraction * 100)}%`;
          return (
            <li key={`leg-${i}`} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ backgroundColor: TONE_STROKE[seg.tone] }}
                aria-hidden="true"
              />
              <span className={styles.legendLabel}>{seg.label}</span>
              <span className={styles.legendValue}>{seg.value}</span>
              <span className={styles.legendPercent}>{percentText}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}