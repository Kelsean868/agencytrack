import React from 'react';
import { Edit3, Calculator } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { formatCurrency } from '../../utils/formatters';

const MANAGER_ROLES = new Set([
  'branch_manager', 'unit_manager', 'sales_manager', 'tenant_admin', 'platform_admin',
]);

function formatPercent(decimal) {
  if (decimal == null || !Number.isFinite(decimal)) return '—';
  return `${(decimal * 100).toFixed(1)}%`;
}

function formatDate(ts) {
  if (!ts) return null;
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-TT', { month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

function bandFillClass(p) {
  if (p >= 0.90) return 'bg-success';
  if (p >= 0.80) return 'bg-warning';
  return 'bg-danger';
}

function bandValueClass(p) {
  if (p >= 0.90) return 'text-success-ink';
  if (p >= 0.80) return 'text-warning-ink';
  return 'text-danger-ink';
}

// Two-tick band track (floor @ 80%, gate @ 90%)
function BandTrack({ persistency }) {
  const pct = Math.min(Math.max(persistency * 100, 0), 100);
  return (
    <div className="relative h-1.5 rounded-full bg-border/40 my-1" style={{ overflow: 'visible' }}>
      {/* Fill */}
      <div
        className={`absolute left-0 top-0 bottom-0 rounded-full ${bandFillClass(persistency)}`}
        style={{ width: `${pct}%` }}
      />
      {/* Floor tick at 80% */}
      <div
        className="absolute w-0.5 bg-danger rounded-sm"
        style={{ left: '80%', top: '-3px', bottom: '-3px' }}
        aria-hidden="true"
      />
      {/* Gate tick at 90% */}
      <div
        className="absolute w-0.5 bg-success rounded-sm"
        style={{ left: '90%', top: '-3px', bottom: '-3px' }}
        aria-hidden="true"
      />
    </div>
  );
}

// Source badge — derived from enteredByRole since lockedByManager field is absent
// from the data schema. Manager-role enteredByRole → "Manager · locked".
function SourceBadge({ record }) {
  if (!record) return null;
  const isManager = MANAGER_ROLES.has(record.enteredByRole);
  if (isManager) {
    return (
      <span
        className="inline-flex items-center gap-1 font-mono text-[9px] font-bold tracking-wide px-2 py-1 rounded-full bg-primary/10 text-primary"
        data-testid="pers-source-manager"
      >
        <span className="text-[8px]">●</span> Manager · locked
      </span>
    );
  }
  const date = formatDate(record.lastEditedAt);
  return (
    <span
      className="inline-flex items-center gap-1 font-mono text-[9px] font-bold tracking-wide px-2 py-1 rounded-full border border-border bg-card-raised text-ink-muted"
      data-testid="pers-source-self"
    >
      <span className="text-[8px]">○</span> Self-entry{date && <span className="font-normal text-ink-muted">· {date}</span>}
    </span>
  );
}

export default function PersRoster({ rows, onEdit, onOpenPlayground }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="card text-sm text-ink-muted" data-testid="pers-roster-empty">
        No agents in scope yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card" data-testid="pers-roster">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-b border-border text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-success" />
          ≥ 90% award-eligible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-warning" />
          80–89% watch
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-danger" />
          &lt; 80% below floor
        </span>
        <span className="ml-auto font-mono text-[10px] text-ink-muted hidden sm:block">
          Manager entry overrides agent self-entry
        </span>
      </div>

      {/* Header (desktop) */}
      <div
        className="hidden sm:grid px-4 py-2.5 border-b border-border bg-card-raised text-[9px] font-bold uppercase tracking-widest text-ink-muted font-mono"
        style={{ gridTemplateColumns: '28px 1.6fr 160px 1fr 0.9fr 1.1fr 110px' }}
        data-testid="pers-roster-header"
      >
        <span className="text-center">#</span>
        <span>Agent · Unit</span>
        <span>Persistency</span>
        <span className="text-right">Net Gross Settled</span>
        <span className="text-right">Lapses</span>
        <span>Source</span>
        <span className="text-right">Actions</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border">
        {rows.map(({ user, record }, idx) => {
          const hasRecord = record != null;
          const p = record?.persistency;
          const isValidP = hasRecord && Number.isFinite(p);

          return (
            <div
              key={user.id}
              className={`flex sm:grid items-center gap-3 px-4 py-3 flex-wrap sm:flex-nowrap ${idx % 2 === 1 ? 'bg-card-raised/50' : ''}`}
              style={{ gridTemplateColumns: '28px 1.6fr 160px 1fr 0.9fr 1.1fr 110px' }}
              data-testid={`pers-roster-row-${user.id}`}
            >
              {/* Rank */}
              <span className="hidden sm:block font-display font-extrabold text-xs text-ink-muted text-center">
                {idx + 1}
              </span>

              {/* Agent + unit */}
              <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-none">
                <Avatar src={user.photoURL} name={user.name ?? user.email ?? '?'} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{user.name ?? user.email ?? user.id}</p>
                  <p className="text-xs text-ink-muted truncate">{user.unitId ?? '—'}</p>
                </div>
              </div>

              {/* Two-tick band cell */}
              <div className="flex flex-col gap-0.5" data-testid={`pers-roster-band-${user.id}`}>
                {isValidP ? (
                  <>
                    <span className={`font-display font-extrabold text-sm leading-none ${bandValueClass(p)}`}>
                      {formatPercent(p)}
                    </span>
                    <div className="pb-1 pt-0.5">
                      <BandTrack persistency={p} />
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-ink-muted italic">No entry yet</span>
                )}
              </div>

              {/* Net Gross Settled */}
              <div className="hidden sm:block text-right font-mono text-xs text-ink">
                {hasRecord ? formatCurrency(record.grossSettled) : '—'}
              </div>

              {/* Lapses (highlighted if significant) */}
              <div
                className={`hidden sm:block text-right font-mono text-xs ${
                  hasRecord && record.lapses > 0 ? 'text-warning-ink' : 'text-ink-muted'
                }`}
                data-testid={`pers-roster-lapses-${user.id}`}
              >
                {hasRecord ? formatCurrency(record.lapses) : '—'}
              </div>

              {/* Source badge */}
              <div className="hidden sm:flex items-center" data-testid={`pers-roster-source-${user.id}`}>
                <SourceBadge record={record} />
              </div>

              {/* Actions */}
              <div className="flex gap-1.5 justify-end ml-auto sm:ml-0">
                <button
                  type="button"
                  onClick={() => onEdit(user.id)}
                  className="h-9 min-w-[2.75rem] px-2.5 rounded-lg border border-border bg-card text-xs font-bold text-ink hover:bg-card-raised transition-colors flex items-center gap-1"
                  data-testid={`pers-roster-edit-${user.id}`}
                  aria-label={`Edit persistency for ${user.name ?? user.id}`}
                >
                  <Edit3 size={11} />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenPlayground(user.id)}
                  className="h-9 min-w-[2.75rem] px-2.5 rounded-lg border border-border bg-card-raised text-xs font-bold text-primary hover:bg-border/30 transition-colors flex items-center gap-1"
                  data-testid={`pers-roster-play-${user.id}`}
                  aria-label={`Open playground for ${user.name ?? user.id}`}
                >
                  <Calculator size={11} />
                  <span className="hidden sm:inline">Play</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
