import React from 'react';
import {
  BarChart, Bar, Cell, ReferenceLine, Tooltip, XAxis, YAxis, ResponsiveContainer,
} from 'recharts';

import { GateBars } from '../fr/charts';
import { monthAxisLabel } from '../../lib/fr/moneyModel';
import { formatPersistencyPct } from '../../lib/persistency/persistencyRounding';

/**
 * PersistencyTrendChart - the agent Persistency tab's monthly trend, as BARS
 * against the 90% gate (it was a line).
 *
 *   FR look    the FR chart kit's GateBars: bars grow up from the gate line when
 *              at/above it and down when below, values direct-labelled.
 *   Nexus look a Recharts BarChart over the same data with a ReferenceLine at
 *              the gate.
 *
 * `data` is oldest-first `[{ monthKey, pct }]`, `pct` a percent already rounded
 * by roundPersistencyPct (or null for "no reading"). Axis ticks stay whole
 * numbers; tooltips and direct labels go through formatPersistencyPct, so the
 * chart prints the same string as every other persistency surface (R-a).
 */
const GATE = 90;

export default function PersistencyTrendChart({ data, fr = false, gate = GATE }) {
  const rows = Array.isArray(data) ? data : [];

  if (fr) {
    const bars = rows
      .filter((d) => Number.isFinite(d.pct))
      .map((d) => ({ key: d.monthKey, label: monthAxisLabel(d.monthKey) || d.monthKey, value: d.pct }));
    return <GateBars data={bars} gate={gate} format={formatPersistencyPct} />;
  }

  return (
    <div
      className="h-48"
      role="img"
      aria-label={`Monthly persistency as bars, with the ${gate}% gate marked`}
      data-testid="persistency-trend-bars"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <XAxis dataKey="monthKey" fontSize={10} stroke="var(--color-text-muted)" />
          <YAxis domain={[0, 100]} fontSize={10} stroke="var(--color-text-muted)" />
          <Tooltip
            cursor={{ fill: 'var(--color-surface-raised)' }}
            formatter={(v) => [formatPersistencyPct(v), 'Persistency']}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <ReferenceLine
            y={gate}
            stroke="var(--color-gold)"
            strokeDasharray="3 3"
            label={{ value: `Gate ${gate}%`, position: 'insideTopRight', fontSize: 10, fill: 'var(--color-text-muted)' }}
          />
          <Bar dataKey="pct" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {rows.map((d) => (
              <Cell
                key={d.monthKey}
                fill={Number.isFinite(d.pct) && d.pct >= gate ? 'var(--color-primary)' : 'var(--color-warning)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
