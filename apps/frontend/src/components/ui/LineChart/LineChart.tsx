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
    .map((s) => `${s.label}: min ${Math.min(...s.data)}, max ${Math.max(...s.data)}`)
    .join('; ');
  const label = ariaLabel ?? `Line chart. ${summary}.`;

  const xFor = (i: number) => padLeft + i * xStep;
  const yFor = (value: number) => padTop + innerH - (value / safeYMax) * innerH;

  /**
   * Catmull-Rom → cubic Bézier smoothing. Rendered only as the visual
   * path; the area fill and dots use the same control points so line,
   * fill, and markers stay exactly in register. Anchors remain the true
   * data points — smoothing never invents new extremes.
   */
  const smoothPath = (data: number[]) => {
    if (data.length < 3) {
      return data
        .map((value, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(value).toFixed(2)}`)
        .join(' ');
    }
    const pts = data.map((value, i) => ({ x: xFor(i), y: yFor(value) }));
    // Clamp control points to the plot area so smoothing can never
    // overshoot past the top or bottom gridline (and below zero).
    const yMin = padTop;
    const yMaxPx = padTop + innerH;
    const clampY = (y: number) => Math.min(yMaxPx, Math.max(yMin, y));
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
  };

  return (
    <figure className={styles.figure}>
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
      <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <defs>
          {series.map((s, sIdx) => (
            <linearGradient
              key={`grad-${sIdx}`}
              id={`lc-area-${sIdx}-${s.tone}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={TONE_STROKE[s.tone]} stopOpacity="0.18" />
              <stop offset="100%" stopColor={TONE_STROKE[s.tone]} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
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
        {/* Series: soft area fill under a smoothed line, with data-point dots */}
        {series.map((s, sIdx) => {
          const lineD = smoothPath(s.data);
          const areaD = `${lineD} L ${xFor(s.data.length - 1).toFixed(2)} ${yFor(0).toFixed(2)} L ${xFor(0).toFixed(2)} ${yFor(0).toFixed(2)} Z`;
          return (
            <g key={`s-${sIdx}`}>
              <path d={areaD} fill={`url(#lc-area-${sIdx}-${s.tone})`} stroke="none" />
              <path
                d={lineD}
                fill="none"
                stroke={TONE_STROKE[s.tone]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={styles.seriesPath}
              />
              {s.data.map((value, i) => (
                <circle
                  key={`dot-${sIdx}-${i}`}
                  cx={xFor(i)}
                  cy={yFor(value)}
                  r={2}
                  fill={TONE_STROKE[s.tone]}
                  stroke="var(--bg-surface)"
                  strokeWidth={1}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
