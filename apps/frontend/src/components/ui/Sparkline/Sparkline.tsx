import React from 'react';
import styles from './Sparkline.module.css';

export type SparklineTone = 'primary' | 'info' | 'warning' | 'critical' | 'success';

export interface SparklineProps {
  /** Series values; will be normalised to the viewBox. Empty array renders nothing. */
  data: number[];
  /** Semantic tone; maps to design-token colours. */
  tone?: SparklineTone;
  /**
   * viewBox width in user units. Defaults to the parent `.trendWrap`
   * box (88) so the viewBox maps 1:1 to rendered pixels — `preserveAspectRatio`
   * then applies no stretch, so strokes and the endpoint dot are never distorted
   * or pushed outside the box. Override only alongside a matching parent size.
   */
  width?: number;
  /**
   * viewBox height in user units. Defaults to the parent `.trendWrap`
   * box (28) — see the `width` note on why 1:1 mapping matters.
   */
  height?: number;
  /** Accessible label describing the trend. */
  ariaLabel?: string;
}

/**
 * Spacing reserved at each edge (user units) so the 1.5-unit stroke cap and the
 * 2.2-unit endpoint dot render fully inside the box instead of bleeding past the
 * parent boundary. 3.5 > 2.75 (dot centre-to-edge including stroke cap), so the
 * marker is never clipped.
 */
const PAD = 3.5;

const TONE_STROKE: Record<SparklineTone, string> = {
  primary: 'var(--color-primary-500)',
  info: 'var(--color-info-main)',
  warning: 'var(--color-warning-main)',
  critical: 'var(--color-danger-main)',
  success: 'var(--color-success-main)',
};

/**
 * Minimal inline-SVG sparkline used inside metric tiles and chart cards.
 *
 * Implementation notes:
 *   - Pure SVG, no chart library, no animation (clinical surfaces must
 *     be predictable and respect prefers-reduced-motion).
 *   - Auto-scales the polyline to its viewBox; the parent controls the
 *     rendered size via `width`/`height` CSS.
 *   - viewBox width/height default to the parent's 88×28 box, so with
 *     `preserveAspectRatio="none"` there is no stretch even if the parent
 *     size changes; `vector-effect: non-scaling-stroke` additionally keeps the
 *     stroke and dot a constant rendered width under any scale.
 *   - When the data has fewer than 2 points, renders nothing — a single
 *     point is meaningless as a trend.
 *   - Stroke colour is the same semantic token the MetricCard uses for
 *     its tone, so the sparkline visually matches the metric's status.
 *   - `role="img"` with a generated label that exposes min→max range
 *     to assistive tech.
 */
export function Sparkline({
  data,
  tone = 'primary',
  width = 88,
  height = 28,
  ariaLabel,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padX = PAD;
  const padY = PAD;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = data.map((value, i) => {
    const x = padX + (innerW * i) / (data.length - 1);
    const y = padY + innerH - ((value - min) / range) * innerH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const path = `M ${points.join(' L ')}`;
  const last = points[points.length - 1].split(',');
  const lastX = Number(last[0]);
  const lastY = Number(last[1]);

  const label =
    ariaLabel ?? `Trend: range ${min} to ${max}, ${data.length} data points`;

  return (
    <svg
      className={styles.svg}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <path
        d={path}
        fill="none"
        stroke={TONE_STROKE[tone]}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={2.2}
        fill={TONE_STROKE[tone]}
        stroke="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
