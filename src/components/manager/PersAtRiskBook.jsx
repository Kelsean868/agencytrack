import React from 'react';
import { MessageSquare } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { formatCurrency } from '../../utils/formatters';
import { formatPersistencyPct } from '../../lib/persistency/persistencyRounding';

// Ruling R-a: 2 decimals, half up.
function formatPercent(decimal) {
  if (decimal == null || !Number.isFinite(decimal)) return '—';
  return formatPersistencyPct(decimal * 100);
}

export default function PersAtRiskBook({ rows, onCoach }) {
  // rows: [{ user, record }] — all records with persistency < 0.80, sorted worst-first by caller
  if (!rows || rows.length === 0) {
    return (
      <div
        className="card border border-success/30 bg-success/5 flex items-center gap-3 px-5 py-4"
        data-testid="pers-atrisk-celebration"
      >
        <div className="w-9 h-9 rounded-xl bg-success/15 text-success-ink flex items-center justify-center text-base font-bold flex-shrink-0">
          ✓
        </div>
        <div>
          <p className="text-sm font-bold text-ink">No one below the floor</p>
          <p className="text-xs text-ink-muted mt-0.5">
            Every agent is at or above 80% this month. The at-risk book is empty.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-danger/25 overflow-hidden"
      data-testid="pers-atrisk-book"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-danger/8 border-b border-danger/20">
        <span className="text-danger-ink text-sm">▾</span>
        <p className="text-sm font-display font-extrabold text-danger-ink">
          At-risk book — below the 80% floor
        </p>
        <span
          className="ml-auto text-[10px] font-bold font-mono bg-card text-danger-ink px-2 py-0.5 rounded-full"
          data-testid="pers-atrisk-count"
        >
          {rows.length} {rows.length === 1 ? 'AGENT' : 'AGENTS'} · EXCEPTION-FIRST
        </span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border bg-card">
        {rows.map(({ user, record }, idx) => (
          <div
            key={user.id}
            className={`flex items-center gap-3 px-4 py-3 ${idx % 2 === 1 ? 'bg-card-raised' : ''}`}
            data-testid={`pers-atrisk-row-${user.id}`}
          >
            <Avatar src={user.photoURL} name={user.name ?? user.email ?? '?'} size="sm" />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink truncate">{user.name ?? user.email ?? user.id}</p>
              <p className="text-xs text-ink-muted truncate">{user.unitId ?? '—'}</p>
            </div>

            {/* % badge */}
            <span
              className="font-display font-extrabold text-sm text-danger-ink min-w-[3rem] text-center"
              data-testid={`pers-atrisk-pct-${user.id}`}
            >
              {formatPercent(record?.persistency)}
            </span>

            {/* Lapsed TTD */}
            <span
              className="font-mono text-xs text-warning-ink text-right min-w-[6rem] hidden sm:block"
              data-testid={`pers-atrisk-lapses-${user.id}`}
            >
              {record?.lapses != null && Number.isFinite(record.lapses)
                ? `${formatCurrency(record.lapses)} lapsed`
                : ''}
            </span>

            {/* Coach button — PLAYGROUND hidden until S3 */}
            <button
              type="button"
              onClick={() => onCoach({ user, record })}
              className="h-9 min-w-[2.75rem] px-3 rounded-lg border border-border bg-card text-xs font-bold text-ink hover:bg-card-raised transition-colors flex items-center gap-1.5 flex-shrink-0"
              data-testid={`pers-atrisk-coach-${user.id}`}
              aria-label={`Coach ${user.name ?? user.id}`}
            >
              <MessageSquare size={12} />
              <span className="hidden sm:inline">Coach</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
