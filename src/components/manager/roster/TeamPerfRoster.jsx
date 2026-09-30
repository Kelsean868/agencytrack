import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import TenureCell from './TenureCell';
import PersBandCell from './PersBandCell';
import GoalHeatCell from './GoalHeatCell';
import { PERS_FLOOR_PCT, PERS_GATE_PCT } from '../../../lib/persistency/calculations';
import { roundPersistencyPct, formatPersistencyPct } from '../../../lib/persistency/persistencyRounding';

// ─── Column definitions ────────────────────────────────────────────────────────
// key     = field on RosterRow used for cell rendering
// sortKey = field name passed to onSort (matches teamRoster.js sortRows keys)
// grp     = group band: null | 'sub' (Submitted) | 'iss' (Issued/settled)
const COLS = [
  { key:'name',            label:'Name',             sortKey:'name',            pin:true,  numeric:false, grp:null,  money:false, minW:'min-w-[180px]' },
  { key:'tenure',          label:'Tenure',           sortKey:'contractDate',    pin:false, numeric:false, grp:null,  money:false, minW:'min-w-[110px]' },
  { key:'submittedAPI',    label:'API submitted',    sortKey:'submittedAPI',    pin:false, numeric:true,  grp:'sub', money:true,  minW:'min-w-[130px]' },
  { key:'submittedApps',   label:'Apps submitted',   sortKey:'submittedApps',   pin:false, numeric:true,  grp:'sub', money:false, minW:'min-w-[90px]'  },
  { key:'issuedAPI',       label:'API issued',       sortKey:'issuedAPI',       pin:false, numeric:true,  grp:'iss', money:true,  minW:'min-w-[130px]' },
  { key:'issuedApps',      label:'Apps issued',      sortKey:'issuedApps',      pin:false, numeric:true,  grp:'iss', money:false, minW:'min-w-[90px]'  },
  { key:'persistency',     label:'Persistency',      sortKey:'persistency',     pin:false, numeric:true,  grp:null,  money:false, minW:'min-w-[120px]' },
  { key:'pctOfAnnualGoal', label:'% of annual goal', sortKey:'pctOfAnnualGoal', pin:false, numeric:true,  grp:null,  money:false, minW:'min-w-[130px]' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMoney(n) {
  if (n === null || n === undefined) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((p) => p[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function RosterAvatar({ name, isUM }) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-[11px] flex-shrink-0 select-none ${
        isUM ? 'bg-ink-muted/20 text-ink' : 'bg-primary/10 text-primary'
      }`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

function SortIcon({ col, sort }) {
  const active = sort.column === col.sortKey;
  if (!active) return <ChevronsUpDown size={10} className="opacity-30 flex-shrink-0" />;
  return sort.direction === 'asc'
    ? <ChevronUp size={10} className="text-primary flex-shrink-0" />
    : <ChevronDown size={10} className="text-primary flex-shrink-0" />;
}

function SkeletonRow() {
  return (
    <tr data-testid="skeleton-row">
      {[180, 110, 130, 90, 130, 90, 120, 130].map((w, i) => (
        <td
          key={i}
          className={`px-3.5 py-3.5 border-b border-border ${i === 0 ? 'sticky left-0 bg-card z-10' : ''}`}
        >
          <div
            className="h-3 rounded-full bg-border/60 animate-pulse"
            style={{ width: w * 0.6 }}
          />
        </td>
      ))}
    </tr>
  );
}

function MoneyCell({ value, extraClass = '' }) {
  const base = `px-3.5 py-3 border-b border-border text-right font-mono text-xs ${extraClass}`;
  if (value === null || value === undefined) {
    return <td className={`${base} text-ink-muted`}>—</td>;
  }
  return (
    <td className={`${base} text-ink`}>
      <span className="text-[9.5px] text-ink-muted mr-0.5">TTD</span>
      {formatMoney(value)}
    </td>
  );
}

function NumCell({ value, extraClass = '' }) {
  const base = `px-3.5 py-3 border-b border-border text-right font-mono text-xs ${extraClass}`;
  if (value === null || value === undefined) {
    return <td className={`${base} text-ink-muted`}>—</td>;
  }
  return (
    <td className={`${base} text-ink`}>
      {value.toLocaleString()}
    </td>
  );
}

// ─── Mobile card (lg:hidden) ──────────────────────────────────────────────────
function MobileCard({ row }) {
  return (
    <div
      className="bg-card border border-border rounded-xl p-3.5 mb-2.5"
      data-testid={`roster-card-${row.id}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 pb-2.5 border-b border-border">
        <RosterAvatar name={row.name} isUM={row.role === 'UM'} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-ink truncate">{row.name}</span>
            {row.role === 'UM' && (
              <span className="font-mono text-[7.5px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-ink-muted/15 text-ink-muted flex-shrink-0">
                UM
              </span>
            )}
          </div>
          <div className="font-mono text-[9px] text-ink-muted mt-0.5">{row.unit}</div>
        </div>
      </div>
      {/* 2×2 production grid */}
      <div className="grid grid-cols-2 gap-2 mt-2.5">
        {[
          { label: 'API sub',    val: row.submittedAPI,  money: true },
          { label: 'Apps sub',   val: row.submittedApps, money: false },
          { label: 'API issued', val: row.issuedAPI,     money: true },
          { label: 'Apps issued',val: row.issuedApps,    money: false },
        ].map(({ label, val, money }) => (
          <div key={label} className="flex flex-col">
            <span className="font-mono text-[8px] font-bold tracking-widest uppercase text-ink-muted">{label}</span>
            <span className="font-mono text-[12.5px] font-bold mt-0.5 text-primary">
              {val === null ? '—' : money ? `TTD ${formatMoney(val)}` : val.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
      {/* Footer: persistency + goal */}
      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-border">
        <span className="font-display font-extrabold text-sm">
          {row.persistency === null
            ? <span className="text-ink-muted">Pers —</span>
            : <span className={roundPersistencyPct(row.persistency) >= PERS_GATE_PCT ? 'text-success-ink' : roundPersistencyPct(row.persistency) >= PERS_FLOOR_PCT ? 'text-warning-ink' : 'text-danger-ink'}>
                Pers {formatPersistencyPct(row.persistency)}
              </span>
          }
        </span>
        <span className="font-mono text-xs text-ink-muted">
          {row.pctOfAnnualGoal === null ? 'Goal —' : `Goal ${Math.round(row.pctOfAnnualGoal)}%`}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TeamPerfRoster({ rows, sort, onSort, loading }) {
  const hasMembers = rows.length > 0;
  const emptyPeriod = hasMembers && rows.every(
    (r) => r.submittedAPI === null && r.issuedAPI === null
  );

  // Column border classes: first col of 'sub' group, first col of 'iss' group
  function colBorderClass(col) {
    if (col.grp === 'sub' && col.key === 'submittedAPI') return 'border-l border-border';
    if (col.grp === 'iss' && col.key === 'issuedAPI')    return 'border-l border-border';
    return '';
  }

  function renderHeaderBtn(col) {
    const active = sort.column === col.sortKey;
    return (
      <button
        type="button"
        onClick={() => onSort(col.sortKey)}
        className={`flex items-center gap-1 w-full px-3.5 py-2.5 font-mono text-[9.5px] font-bold tracking-widest uppercase min-h-[40px] transition-colors
          ${col.numeric ? 'justify-end text-right' : 'justify-start'}
          ${active ? 'text-primary' : 'text-ink-muted hover:text-ink'}
        `}
      >
        {col.numeric ? (
          <>
            <SortIcon col={col} sort={sort} />
            {col.label}
          </>
        ) : (
          <>
            {col.label}
            <SortIcon col={col} sort={sort} />
          </>
        )}
      </button>
    );
  }

  function renderBodyCell(col, row) {
    const tdBase = `px-0 py-0 border-b border-border ${colBorderClass(col)}`;
    const wrapTd = (content) => <td key={col.key} className={tdBase}>{content}</td>;

    if (col.key === 'name') {
      return (
        <td
          key={col.key}
          className={`sticky left-0 z-10 bg-card px-3.5 py-3 border-b border-border border-r border-border/30`}
        >
          <div className="flex items-center gap-2.5">
            <RosterAvatar name={row.name} isUM={row.role === 'UM'} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[13px] text-ink truncate whitespace-nowrap">
                  {row.name}
                </span>
                {row.role === 'UM' && (
                  <span className="font-mono text-[7.5px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-ink-muted/15 text-ink-muted flex-shrink-0">
                    UM
                  </span>
                )}
              </div>
              <div className="font-mono text-[9.5px] text-ink-muted mt-0.5">{row.unit}</div>
            </div>
          </div>
        </td>
      );
    }

    if (col.key === 'tenure') {
      return wrapTd(
        <div className="px-3.5 py-3">
          <TenureCell contractDate={row.contractDate} />
        </div>
      );
    }

    if (col.key === 'submittedAPI') {
      return <MoneyCell key={col.key} value={row.submittedAPI} extraClass="border-l border-border" />;
    }
    if (col.key === 'submittedApps') {
      return <NumCell key={col.key} value={row.submittedApps} />;
    }
    if (col.key === 'issuedAPI') {
      return <MoneyCell key={col.key} value={row.issuedAPI} extraClass="border-l border-border/60" />;
    }
    if (col.key === 'issuedApps') {
      return <NumCell key={col.key} value={row.issuedApps} />;
    }

    if (col.key === 'persistency') {
      return wrapTd(
        <div className="px-3.5 py-3">
          <PersBandCell persistency={row.persistency} />
        </div>
      );
    }

    if (col.key === 'pctOfAnnualGoal') {
      return wrapTd(
        <div className="px-3.5 py-3">
          <GoalHeatCell pctOfAnnualGoal={row.pctOfAnnualGoal} />
        </div>
      );
    }

    return <td key={col.key} className="px-3.5 py-3 border-b border-border">—</td>;
  }

  return (
    <div data-testid="team-perf-roster">
      {/* ── Desktop table (hidden on mobile) ─────────────────────────────── */}
      <div className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden">
        {/* Empty-period banner */}
        {emptyPeriod && (
          <div className="flex items-center gap-3 px-4 py-3 bg-warning/5 border-b border-warning/20">
            <span className="text-2xl">∅</span>
            <div className="flex-1">
              <p className="font-semibold text-sm text-ink">No production this period</p>
              <p className="text-xs text-ink-muted">Members still listed. Persistency &amp; % goal reflect their annual figures.</p>
            </div>
          </div>
        )}

        <div className="overflow-x-auto" data-testid="roster-table-scroll">
          <table
            className="border-separate border-spacing-0 w-full"
            style={{ minWidth: 980 }}
            aria-label="Team performance roster"
          >
            <thead>
              {/* Group band row — sticky top-0 */}
              <tr>
                {/* Name (pinned) — empty band header */}
                <th
                  className="sticky top-0 left-0 z-[40] bg-surface px-3.5 py-1.5 border-b border-border border-r border-border/30"
                  aria-hidden="true"
                />
                {/* Tenure — empty */}
                <th className="sticky top-0 z-30 bg-surface px-3.5 py-1.5 border-b border-border" aria-hidden="true" />
                {/* Submitted band */}
                <th
                  colSpan={2}
                  className="sticky top-0 z-30 bg-surface px-3.5 py-1.5 border-b border-border border-l border-border font-mono text-[9px] font-bold tracking-widest uppercase text-primary text-center"
                >
                  Submitted
                </th>
                {/* Issued / settled band */}
                <th
                  colSpan={2}
                  className="sticky top-0 z-30 bg-surface px-3.5 py-1.5 border-b border-border border-l border-border/60 font-mono text-[9px] font-bold tracking-widest uppercase text-warning-ink text-center"
                >
                  Issued / settled
                </th>
                {/* Persistency + Goal — empty */}
                <th className="sticky top-0 z-30 bg-surface px-3.5 py-1.5 border-b border-border" aria-hidden="true" />
                <th className="sticky top-0 z-30 bg-surface px-3.5 py-1.5 border-b border-border" aria-hidden="true" />
              </tr>

              {/* Header row — sticky below group band */}
              <tr>
                {COLS.map((col) => {
                  const active = sort.column === col.sortKey;
                  const ariaSort = active
                    ? (sort.direction === 'asc' ? 'ascending' : 'descending')
                    : 'none';
                  return (
                    <th
                      key={col.key}
                      aria-sort={ariaSort}
                      className={`
                        sticky top-7 z-20 bg-surface border-b border-border/80
                        ${col.minW}
                        ${col.pin ? 'left-0 z-[30] border-r border-border/30' : ''}
                      `}
                    >
                      {renderHeaderBtn(col)}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

              {!loading && !hasMembers && (
                <tr>
                  <td colSpan={COLS.length} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3" data-testid="empty-members">
                      <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-xl">○</div>
                      <p className="font-display font-bold text-base text-ink">No team members yet</p>
                      <p className="text-sm text-ink-muted max-w-xs">This manager's unit/branch has no assigned members.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && rows.map((row, i) => {
                const zebra = i % 2 === 1 ? 'bg-card-raised/40' : '';
                return (
                  <tr key={row.id} className={`group ${zebra}`} data-testid={`roster-row-${row.id}`}>
                    {COLS.map((col) => renderBodyCell(col, row))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border bg-surface text-xs text-ink-muted">
          <span>{rows.length} team member{rows.length !== 1 ? 's' : ''}</span>
          <span className="ml-auto font-mono text-[10px]">
            ← Name pinned · scroll for all 8 columns →
          </span>
        </div>
      </div>

      {/* ── Mobile cards (lg:hidden) ─────────────────────────────────────── */}
      <div className="lg:hidden space-y-0" data-testid="roster-mobile">
        {loading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        )}
        {!loading && !hasMembers && (
          <div className="py-12 text-center text-sm text-ink-muted" data-testid="empty-members-mobile">
            No team members yet
          </div>
        )}
        {!loading && rows.map((row) => <MobileCard key={row.id} row={row} />)}
      </div>
    </div>
  );
}
