// E3 — Agent-side persistency tab.
//
// Shows the agent's current month + 12-month trend + self-entry form (locked
// when a manager has already entered for the same month) + a "Open Playground"
// CTA. Award-gate banner appears when persistency is below 90%.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, ReferenceLine, Tooltip, XAxis, YAxis, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, AlertCircle, Calculator, Edit3, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getAgentHistory,
  getAvailableMonths,
} from '../../services/persistencyService';
import PersistencyEntryForm from '../manager/PersistencyEntryForm';
import PersistencyPlayground from '../persistency/PersistencyPlayground';

function formatPct(decimal) {
  if (!Number.isFinite(decimal)) return '—';
  return `${(decimal * 100).toFixed(1)}%`;
}


export default function PersistencyTab({ onViewLapsedPolicies }) {
  const { user, role, tenantId } = useAuth();

  const [history, setHistory] = useState([]);
  const [monthKeys, setMonthKeys] = useState([]);
  const [activeMonthKey, setActiveMonthKey] = useState(null);
  const [editing, setEditing] = useState(false);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    setError('');
    try {
      const [recs, months] = await Promise.all([
        getAgentHistory(tenantId, user.uid, 12),
        getAvailableMonths(tenantId, 'agent', user.uid),
      ]);
      setHistory(recs);
      setMonthKeys(months);
      setActiveMonthKey((prev) => prev ?? months[0] ?? null);
    } catch (e) {
      setError(e.message ?? 'Failed to load persistency.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, tenantId]);

  useEffect(() => { load(); }, [load]);

  const recordByMonth = useMemo(() => {
    const m = {};
    history.forEach((r) => { m[r.monthKey] = r; });
    return m;
  }, [history]);

  const currentRecord = activeMonthKey ? recordByMonth[activeMonthKey] : null;
  const currentDecimal = currentRecord?.persistency ?? null;
  const meetsGate = (currentDecimal ?? 0) >= 0.90;

  // Manager has entered if the existing record's enteredByRole is anything
  // other than 'agent'. Agents may still see (read-only) a manager-entered
  // doc for the same month.
  const lockedByManager = currentRecord
    && currentRecord.enteredByRole
    && currentRecord.enteredByRole !== 'agent';

  // Trend chart data: oldest-first decimals scaled to %.
  const chartData = useMemo(() => history.map((r) => ({
    monthKey: r.monthKey,
    pct: Number.isFinite(r.persistency) ? Math.round(r.persistency * 1000) / 10 : null,
  })), [history]);

  return (
    <div className="flex flex-col gap-4" data-testid="agent-persistency-tab">
      {error && (
        <div className="card flex items-center gap-2 text-sm text-danger-ink">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Month selector */}
      <div className="flex items-center gap-2">
        <select
          aria-label="Month"
          data-testid="agent-persistency-month-selector"
          value={activeMonthKey ?? ''}
          onChange={(e) => setActiveMonthKey(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {monthKeys.length === 0 && <option value="">—</option>}
          {monthKeys.map((mk) => (
            <option key={mk} value={mk}>{mk}</option>
          ))}
        </select>
      </div>

      {/* Big number */}
      {/* @@hero-pane-start */}
      <div className="glass hero teal p-6 flex flex-col gap-2" data-testid="agent-persistency-summary">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-[--hero-ink-muted-teal]" />
          <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-[--hero-ink-muted-teal]">
            Your persistency · {activeMonthKey ?? '—'}
          </p>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[--hero-chip-island] border border-[--hero-chip-border]"
            data-testid="agent-persistency-value"
          >
            {Number.isFinite(currentDecimal) && (
              <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${
                currentDecimal >= 0.90 ? 'bg-[--hero-dot-success]'
                  : currentDecimal >= 0.80 ? 'bg-[--hero-dot-warning]'
                  : 'bg-[--hero-dot-danger]'
              }`} />
            )}
            <span className="text-3xl font-bold text-[--hero-ink]">
              {currentRecord ? formatPct(currentDecimal) : '—'}
            </span>
          </span>
          {currentRecord && meetsGate && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[--hero-chip-island] border border-[--hero-chip-border] text-[--hero-ink] text-[9px] font-bold font-mono uppercase tracking-widest">
              <span className="w-1.5 h-1.5 rounded-full bg-[--hero-dot-success]" />
              Award-eligible
            </span>
          )}
        </div>
        {!currentRecord && !loading && (
          <p className="text-xs text-[--hero-ink-muted-teal]">No record entered for this month yet.</p>
        )}
      </div>
      {/* @@hero-pane-end */}

      {/* Award gate banner — only when a record exists and persistency < 90% */}
      {currentRecord && !meetsGate && (
        <div
          className="card flex items-start gap-2 bg-warning-tint border-warning/30"
          data-testid="award-gate-banner"
        >
          <AlertCircle size={16} className="text-warning-ink shrink-0 mt-0.5" />
          <div className="text-sm text-ink">
            <p className="font-semibold">
              Your persistency is {formatPct(currentDecimal)}. Awards require 90% minimum.
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Use the Playground below to model your path.
            </p>
          </div>
        </div>
      )}

      {/* Trend chart */}
      <div className="card flex flex-col gap-2" data-testid="persistency-trend-chart">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
          12-month trend
        </p>
        {chartData.length === 0 ? (
          <p className="text-xs text-ink-muted py-6 text-center">
            No history yet — your trend appears after the first month is entered.
          </p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <XAxis dataKey="monthKey" fontSize={10} stroke="var(--color-text-muted)" />
                <YAxis domain={[0, 100]} fontSize={10} stroke="var(--color-text-muted)" />
                <Tooltip
                  formatter={(v) => [`${v}%`, 'Persistency']}
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine y={90} stroke="var(--color-gold)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="pct"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Self-entry CTA */}
      <div className="card flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
              Self-entry
            </p>
            <p className="text-sm text-ink mt-1">
              {lockedByManager
                ? 'Your manager has entered figures for this month. View only.'
                : 'Enter the six business figures from the Tatil monthly report. Persistency is derived automatically.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={!activeMonthKey || lockedByManager}
            className="h-10 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60"
            data-testid="agent-persistency-edit-button"
          >
            {lockedByManager ? <Lock size={14} /> : <Edit3 size={14} />}
            {lockedByManager ? 'Locked' : currentRecord ? 'Edit' : 'Enter'}
          </button>
        </div>
      </div>

      {/* Playground CTA */}
      <div className="card flex flex-col gap-2">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
          What-if calculator
        </p>
        <p className="text-sm text-ink-muted">
          Model new business, reinstatements, and orphan adoptions to see how your
          persistency would change.
        </p>
        <button
          type="button"
          onClick={() => setPlaygroundOpen(true)}
          className="self-start h-10 px-4 rounded-lg border border-primary text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/10 transition-colors"
          data-testid="agent-playground-open-button"
        >
          <Calculator size={14} /> Open Playground
        </button>
      </div>

      {editing && activeMonthKey && (
        <PersistencyEntryForm
          tenantId={tenantId}
          monthKey={activeMonthKey}
          agentUid={user.uid}
          agentName="You"
          existingRecord={currentRecord}
          writerRole={role}
          writerUid={user.uid}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}

      {playgroundOpen && (
        <PersistencyPlayground
          mode="self"
          agentName="You"
          currentRecord={currentRecord}
          onClose={() => setPlaygroundOpen(false)}
          onViewLapsedPolicies={onViewLapsedPolicies}
        />
      )}
    </div>
  );
}
