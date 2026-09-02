import React from 'react';
import styles from './LineChart.module.css';

export type LineChartTone = 'primary' | 'info' | 'warning' | 'critical' | 'success';

export interface LineChartSeries {
  label: string;
  tone: LineChartTone;
  data: number[];
}

export interface LineChartProps {
  series: LineChartSeries[];
  /** X-axis labels in order matching each data point. */
  xLabels: string[];
  /** Y-axis maximum. Gridlines are drawn at 0, 0.25·yMax, 0.5·yMax, 0.75·yMax, yMax. */
  yMax: number;
  /** Optional accessible summary for the figure. */
  ariaLabel?: string;
  /** Pixel dimensions for the SVG canvas. */
  width?: number;
  height?: number;
}

const TONE_STROKE: Record<LineChartTone, string> = {
  primary: 'var(--color-primary-500)',
  info: 'var(--color-info-main)',
  warning: 'var(--color-warning-main)',
  critical: 'var(--color-danger-main)',
  success: 'var(--color-success-main)',
};

/**
 * Minimal multi-series SVG line chart for clinical analytics surfaces.
 *
 * Owns its own axes and gridlines so the dashboard can drop it into a
 * card without bringing in a chart library. Y-axis is computed from the
 * caller-supplied `yMax` so the chart scales sensibly when the underlying
 * data is sparse (e.g., early in a deployment).
 *
 * Designed for predictability:
 *   - No animation; the chart paints its full state on first render.
 *   - All colours come from existing semantic tokens.
 *   - `role="img"` with a generated aria-label describing each series's
 *     min and max.
 */
export function LineChart({
  series,
  xLabels,
  yMax,
  ariaLabel,
  width = 720,
  height = 260,
}: LineChartProps) {
  const padTop = 16;
  const padRight = 16;
  const padBottom = 32;
  const padLeft = 36;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const pointsPerSeries = series[0]?.data.length ?? 0;
  const safeYMax = Math.max(1, yMax);

  const xStep = pointsPerSeries > 1 ? innerW / (pointsPerSeries - 1) : 0;

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((f) => padTop + innerH * (1 - f));

  const summary = series
    .map(
      (s) =>
        `${s.label}: min ${Math.min(...s.data)}, max ${Math.max(...s.data)}`,
    )
    .join('; ');
  const label = ariaLabel ?? `Line chart. ${summary}.`;

  return (
    <figure className={styles.figure}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
      >
        {/* Gridlines */}
        {gridYs.map((y, i) => (
          <line
            key={`grid-${i}`}
            x1={padLeft}
            x2={width - padRight}
            y1={y}
            y2={y}
            className={styles.grid}
          />
        ))}
        {/* Y-axis labels (right-aligned) */}
        {gridYs.map((y, i) => {
          const v = Math.round(safeYMax * [0, 0.25, 0.5, 0.75, 1][i]);
          return (
            <text
              key={`y-${i}`}
              x={padLeft - 8}
              y={y + 4}
              className={styles.axisLabel}
              textAnchor="end"
            >
              {v}
            </text>
          );
        })}
        {/* X-axis labels (centered under each point) */}
        {xLabels.map((label, i) => (
          <text
            key={`x-${i}`}
            x={padLeft + i * xStep}
            y={height - padBottom + 18}
            className={styles.axisLabel}
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
        {/* Series lines */}
        {series.map((s, sIdx) => {
          const d = s.data
            .map((value, i) => {
              const x = padLeft + i * xStep;
              const y = padTop + innerH - (value / safeYMax) * innerH;
              return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
            })
            .join(' ');
          return (
            <path
              key={`s-${sIdx}`}
              d={d}
              fill="none"
              stroke={TONE_STROKE[s.tone]}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={styles.seriesPath}
            />
          );
        })}
      </svg>
      <figcaption className={styles.legend}>
        {series.map((s, i) => (
          <span key={`leg-${i}`} className={styles.legendItem}>
            <span
              className={styles.legendDot}
              style={{ backgroundColor: TONE_STROKE[s.tone] }}
              aria-hidden="true"
            />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}