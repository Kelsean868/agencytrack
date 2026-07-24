import React from 'react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function KPICard({ label, values = [], isCurrency = false, isPercent = false }) {
  const current = values.length > 0 ? values[values.length - 1] : 0;
  const last    = values.length > 1 ? values[values.length - 2] : null;
  const delta   = last !== null ? current - last : null;

  // isPercent renders a "%" suffix (rate KPIs stored 0–100, e.g. Compliance Rate);
  // isCurrency wins if both are set. Delta reuses fmt, so trends read "+2% vs last week".
  const fmt = (v) =>
    isCurrency ? formatCurrency(v)
    : isPercent ? `${v.toLocaleString()}%`
    : v.toLocaleString();

  const deltaClass =
    delta === null || delta === 0 ? 'text-ink-muted' :
    delta > 0 ? 'text-success-ink' : 'text-danger-ink';

  const chartData = values.map((v, i) => ({ i, v }));

  return (
    <div className="card flex flex-col gap-1.5 min-h-[140px]">
      <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide leading-none">
        {label}
      </p>

      <p className="text-2xl font-bold text-ink leading-tight">{fmt(current)}</p>

      <div className={`flex items-center gap-0.5 text-xs font-semibold ${deltaClass}`}>
        {delta === null ? (
          <span className="text-ink-muted text-[11px]">No prior data</span>
        ) : delta === 0 ? (
          <><Minus size={12} /><span>No change</span></>
        ) : delta > 0 ? (
          <><TrendingUp size={12} /><span>+{fmt(Math.abs(delta))} vs last week</span></>
        ) : (
          <><TrendingDown size={12} /><span>{fmt(Math.abs(delta))} vs last week</span></>
        )}
      </div>

      <div className="flex-1" />

      {chartData.length > 1 && (
        <div className="w-full h-10">
          <ResponsiveContainer width="100%" height={40} debounce={50}>
            <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <Line
                type="monotone"
                dataKey="v"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
