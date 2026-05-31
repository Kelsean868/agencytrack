import React from 'react';

/**
 * MiniViz primitives for v2 Pulse chips. All SVG, tokens only.
 * Color comes via CSS variable string passed in by the chip's tone.
 * aria-hidden="true" — the chip's text carries meaning.
 */

export function MiniSparkline({ color, values, width = 56, height = 22 }) {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * (width - 4) + 2;
    const y = (height - 4) - ((v - min) / range) * (height - 4) + 2;
    return [x, y];
  });
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />
    </svg>
  );
}

export function MiniDonut({ color, percent, size = 30 }) {
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safePct = Math.max(0, Math.min(100, percent ?? 0));
  const dash = (safePct / 100) * c;
  return (
    <svg width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity="0.18" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        strokeDasharray={`${dash} ${c}`}
      />
    </svg>
  );
}

export function MiniBars({ color, values, width = 56, height = 22 }) {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values, 1);
  const barW = (width - (values.length - 1) * 2) / values.length;
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block' }}>
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        const x = i * (barW + 2);
        const y = height - h;
        return <rect key={i} x={x} y={y} width={barW} height={h} fill={color} rx="1" />;
      })}
    </svg>
  );
}

export function MiniBadge({ color, count }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 28, height: 28, borderRadius: '50%', background: color, color: '#ffffff',
        fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Cabinet Grotesk", system-ui, sans-serif',
      }}
      className="text-white"
    >
      {count}
    </div>
  );
}
