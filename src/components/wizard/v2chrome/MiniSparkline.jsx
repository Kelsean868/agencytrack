import React from 'react';

/**
 * 6-bar production-API sparkline for the WeekSoFarPanel hero.
 *
 * Renders a pure SVG bar chart from `values` (oldest → newest). The last
 * bar is tinted differently to signal "this week, live in progress." If
 * `currentLive` is provided, the last bar's value is replaced with it
 * (used by the panel to show the live in-progress total while typing).
 *
 * Nexus tokens only via CSS vars; no raw hex.
 */
export default function MiniSparkline({
  values,
  currentLive,
  width = 148,
  height = 36,
  ariaLabel = '6-week Production API trend',
}) {
  const series = Array.isArray(values) ? values.slice(0, 6) : [];
  // Left-pad to 6 bars so empty agents still render the chart shape.
  while (series.length < 6) series.unshift(0);
  if (currentLive !== undefined && currentLive !== null) {
    series[series.length - 1] = Number(currentLive) || 0;
  }
  const max = Math.max(...series, 1);
  const gap = 4;
  const barW = (width - gap * 5) / 6;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      style={{ display: 'block' }}
    >
      {series.map((v, i) => {
        const isLast = i === series.length - 1;
        const safeV = Math.max(0, Number(v) || 0);
        const bh = Math.max(2, (safeV / max) * (height - 4));
        const x = i * (barW + gap);
        const y = height - bh;
        // Past bars: brand teal at increasing opacity (oldest faintest).
        // Last bar (this week, live): gold accent.
        const fill = isLast ? 'var(--color-gold)' : 'var(--color-primary)';
        const opacity = isLast ? 1 : 0.55 + i * 0.08;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh}
            rx={2}
            fill={fill}
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}
