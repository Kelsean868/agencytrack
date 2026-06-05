import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../../../utils/formatters';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const MODE_COLORS = {
  annual:     'var(--color-primary)',
  semiAnnual: 'var(--color-primary)',
  quarterly:  'var(--color-gold)',
  monthly:    'var(--color-gold)',
};

const MODE_OPACITY = {
  annual: 1, semiAnnual: 0.55, quarterly: 1, monthly: 0.5,
};

const MODE_DISPLAY = {
  annual: 'Annual', semiAnnual: 'Semi', quarterly: 'Quarter', monthly: 'Monthly',
};

function buildStackedData(totalApi, modeMix, commissionRate) {
  const C = commissionRate / 100;
  const a = totalApi * (modeMix.annual     ?? 0) * C;
  const s = totalApi * (modeMix.semiAnnual ?? 0) * C;
  const q = totalApi * (modeMix.quarterly  ?? 0) * C;
  const m = totalApi * (modeMix.monthly    ?? 0) * C;

  let cumulative = 0;
  return MONTH_LABELS.map((name, i) => {
    const annual     = i === 0              ? Math.round(a)       : 0;
    const semiAnnual = i === 0 || i === 6   ? Math.round(s * 0.5) : 0;
    const quarterly  = [0,3,6,9].includes(i)? Math.round(q * 0.25): 0;
    const monthly    = Math.round(m / 12);
    cumulative += annual + semiAnnual + quarterly + monthly;
    return { name, annual, semiAnnual, quarterly, monthly, cumulative };
  });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const modes = payload.filter((p) => p.dataKey !== 'cumulative');
  const cum   = payload.find((p)   => p.dataKey === 'cumulative');
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-md min-w-[140px]">
      <p className="font-semibold text-ink mb-1.5">{label}</p>
      {modes.map((p) =>
        p.value > 0 ? (
          <div key={p.dataKey} className="flex justify-between gap-3 text-ink-muted">
            <span>{MODE_DISPLAY[p.dataKey]}</span>
            <span className="tabular-nums text-ink">{formatCurrency(p.value)}</span>
          </div>
        ) : null
      )}
      {cum && (
        <div className="flex justify-between gap-3 mt-1.5 pt-1.5 border-t border-border text-ink-muted">
          <span>Cumulative</span>
          <span className="tabular-nums text-ink font-semibold">{formatCurrency(cum.value)}</span>
        </div>
      )}
    </div>
  );
}

export default function CashFlowChart({ totalApi, modeMix, commissionRate }) {
  const data = buildStackedData(totalApi, modeMix, commissionRate);
  const activeModes = ['annual', 'semiAnnual', 'quarterly', 'monthly'].filter(
    (m) => (modeMix[m] ?? 0) > 0
  );

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="25%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => v === 0 ? '0' : `${Math.round(v / 1000)}k`}
            tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }}
            tickLine={false}
            axisLine={false}
            width={32}
          />
          <Tooltip content={<CustomTooltip />} />
          {activeModes.map((mode) => (
            <Bar
              key={mode}
              dataKey={mode}
              stackId="a"
              fill={MODE_COLORS[mode]}
              fillOpacity={MODE_OPACITY[mode]}
              radius={mode === activeModes[activeModes.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              isAnimationActive={false}
            />
          ))}
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="var(--color-text-muted)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-2 font-mono text-[9.5px] text-ink-muted">
        {activeModes.map((mode) => (
          <span key={mode} className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-sm inline-block shrink-0"
               style={{ background: MODE_COLORS[mode], opacity: MODE_OPACITY[mode] }} />
            {MODE_DISPLAY[mode]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <i className="inline-block w-5 h-0 border-t border-dashed border-ink-muted shrink-0" />
          Cumulative
        </span>
      </div>
    </div>
  );
}
