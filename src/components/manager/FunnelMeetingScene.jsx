// Meeting Mode — the Master Sheet FUNNEL, projected into the room.
//
// The "sheet-in-the-room" scene (design_handoff_sheet_celebrations_planner
// README §1 · scenes 09–10). It projects the branch Master Sheet's 8-stage
// funnel onto the always-dark presentation surface so the manager can WORK the
// sheet live mid-stand-up: live agent search, VIEW totals↔details, per-stage
// expand toggles, tri-state header sorting, and an exceptions cut.
//
// It REUSES the funnel column model wholesale (src/utils/funnelModel.js —
// FUNNEL_GROUPS / funnelView / computeFunnelRow / computeFunnelTotals /
// computeInterviewsKept / funnelRowIsException). The column model is NOT forked.
// Only the RENDERING is scene-local, because the projection surface uses the
// `--presentation-*` token family (fixed-dark) rather than the app's
// `--color-*` / channel tokens that the shipped MasterSheet table is wired to —
// a shared renderer would have to parameterise every token class and would touch
// the exact JSX the t1-master-sheet VH legs assert against. Reading the same
// model keeps those assertions untouched. Values come ONLY through
// extractFields() — never raw Firestore fields.
//
// No new data path: it consumes the `submissions` prop MeetingMode already loads
// (getWeeklySubmissions for the selected week — the same read the Master Sheet uses).

import React, { useMemo, useState } from 'react';
import { Search, Plus, Minus, ArrowUp, ArrowDown, ChevronsUpDown, X, AlertTriangle } from 'lucide-react';
import { formatDateLabel } from '../../utils/validators';
import { extractFields } from '../../utils/extractFields';
import {
  FUNNEL_TOGGLABLE_IDS,
  funnelView, computeFunnelRow, computeFunnelTotals, computeInterviewsKept, funnelRowIsException,
} from '../../utils/funnelModel';

// Compact TTD money for the dense API column: "TTD 24.4K" (weekly scale).
function ttdK(n) {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`;
}

function resolveName(sub) {
  if (sub.agentName) return sub.agentName;
  if (sub.displayName) return sub.displayName;
  if (sub.userName) return sub.userName;
  const uid = sub.agentId ?? sub.userId ?? '';
  return uid ? `Agent ${uid.slice(-6)}` : '—';
}

// One numeric projection cell — sub-column, stage KPI, or the terminal API band.
function ProjCell({ col, value, rowId }) {
  const isTerm = col.terminal;
  const isKpi = col.kpi;
  const zero = !value;
  const rule = col.groupStart ? 'border-l border-presentation-border' : '';
  const base = `px-3 py-2 text-right tabular-nums whitespace-nowrap ${rule}`;
  if (isTerm) {
    return (
      <td
        data-testid={`mfc-${col.key}-${rowId}`}
        data-value={value}
        className={`${base} bg-presentation-accent/10 text-[13px] font-bold text-presentation-accent`}
        style={{ width: col.w }}
      >
        {col.money
          ? <span><span className="text-[9px] font-semibold tracking-wide text-presentation-accent/70 mr-0.5">TTD</span>{ttdK(value)}</span>
          : (zero ? <span className="text-presentation-muted/50">—</span> : value)}
      </td>
    );
  }
  if (isKpi) {
    return (
      <td
        data-testid={`mfc-${col.key}-${rowId}`}
        data-value={value}
        className={`${base} bg-presentation-text/5 text-[13px] font-bold ${zero ? 'text-presentation-muted/50' : 'text-presentation-text'}`}
        style={{ width: col.w }}
      >
        {zero ? '—' : value}
      </td>
    );
  }
  return (
    <td
      data-testid={`mfc-${col.key}-${rowId}`}
      data-value={value}
      className={`${base} text-[12px] ${zero ? 'text-presentation-muted/50' : 'text-presentation-muted'}`}
      style={{ width: col.w }}
    >
      {zero ? '—' : value}
    </td>
  );
}

export default function FunnelMeetingScene({ submissions, selectedWeek }) {
  const [expanded, setExpanded] = useState(() => new Set()); // default: totals only
  const [sort, setSort] = useState(null);                    // {key, dir} | null (null = API rank)
  const [search, setSearch] = useState('');
  const [exceptionsOn, setExceptionsOn] = useState(false);

  // Base rows — ranked by this-week production credit (desc), computed BEFORE
  // search / exceptions / sort so rank stays stable as the operator works the sheet.
  const allRows = useMemo(() => {
    return (submissions || [])
      .map((sub) => {
        const v = computeFunnelRow(extractFields(sub), sub);
        return {
          id: sub.agentId ?? sub.userId ?? sub.id,
          name: resolveName(sub),
          status: sub.status ?? 'draft',
          v,
        };
      })
      .sort((a, b) => (b.v.api || 0) - (a.v.api || 0))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [submissions]);

  const searchedRows = useMemo(
    () => allRows.filter((r) => search.trim() === '' || r.name.toLowerCase().includes(search.trim().toLowerCase())),
    [allRows, search]
  );
  const exceptionRows = useMemo(
    () => (exceptionsOn ? searchedRows.filter(funnelRowIsException) : searchedRows),
    [searchedRows, exceptionsOn]
  );
  const displayRows = useMemo(() => {
    if (!sort) return exceptionRows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...exceptionRows].sort((a, b) => dir * ((b.v[sort.key] || 0) - (a.v[sort.key] || 0)));
  }, [exceptionRows, sort]);

  const view = useMemo(() => funnelView(expanded), [expanded]);
  const totals = useMemo(() => computeFunnelTotals(displayRows.map((r) => r.v), view.cols), [displayRows, view]);
  const interviewsKept = useMemo(() => computeInterviewsKept(displayRows.map((r) => r.v)), [displayRows]);
  const exceptionCount = useMemo(() => searchedRows.filter(funnelRowIsException).length, [searchedRows]);

  const allOpen = FUNNEL_TOGGLABLE_IDS.every((id) => expanded.has(id));
  const allClosed = expanded.size === 0;

  const toggleGroup = (id) => setExpanded((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const expandAll = () => setExpanded(new Set(FUNNEL_TOGGLABLE_IDS));
  const collapseAll = () => setExpanded(new Set());

  // Tri-state: click ↓ (desc) → ↑ (asc) → clear back to default rank order.
  const onSort = (key) => setSort((prev) => {
    if (!prev || prev.key !== key) return { key, dir: 'desc' };
    if (prev.dir === 'desc') return { key, dir: 'asc' };
    return null;
  });

  const seg = (active) =>
    `min-h-[36px] px-3 rounded-md text-[11px] font-bold tracking-wide uppercase transition-colors ${
      active ? 'bg-presentation-text/10 text-presentation-accent' : 'text-presentation-muted hover:text-presentation-text'
    }`;

  const T1_H = 'h-8';
  const SUB_TOP = 'top-8';
  const LEAD_RANK_W = 40;
  const LEAD_AGENT_W = 190;

  return (
    <div className="flex-1 flex flex-col px-8 py-6 min-h-0" data-testid="meeting-funnel-scene">
      {/* Header — eyebrow + title, live search · VIEW · EXCEPTIONS */}
      <div className="flex flex-wrap items-center gap-4 flex-shrink-0">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-presentation-accent">
            Branch stand-up · Week of {formatDateLabel(selectedWeek)}
          </p>
          <h2 className="mt-1 text-3xl font-display font-bold text-presentation-text leading-none">The Master Sheet</h2>
        </div>

        <div className="flex-1" />

        {/* Live search */}
        <div className={`flex items-center gap-2 h-10 px-3 rounded-lg border bg-presentation-text/5 ${search ? 'border-presentation-accent/60' : 'border-presentation-border'}`}>
          <Search size={14} className={search ? 'text-presentation-accent' : 'text-presentation-muted'} aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agent…"
            aria-label="Search agent"
            className="w-36 bg-transparent border-none outline-none text-sm font-medium text-presentation-text placeholder:text-presentation-muted"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="text-presentation-muted hover:text-presentation-text">
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* VIEW segmented */}
        <div className="inline-flex gap-1 rounded-lg border border-presentation-border bg-presentation-text/5 p-1" role="group" aria-label="Funnel detail view">
          <button type="button" onClick={collapseAll} aria-pressed={allClosed} className={seg(allClosed)}>Totals</button>
          <button type="button" onClick={expandAll} aria-pressed={allOpen} className={seg(allOpen)}>+ Details</button>
        </div>

        {/* EXCEPTIONS cut */}
        <button
          type="button"
          role="switch"
          aria-checked={exceptionsOn}
          data-testid="meeting-funnel-exceptions"
          onClick={() => setExceptionsOn((v) => !v)}
          className={`min-h-[40px] inline-flex items-center gap-2 px-3 rounded-lg border text-sm font-semibold transition-colors ${
            exceptionsOn ? 'bg-warning/15 border-warning/50 text-warning' : 'bg-presentation-text/5 border-presentation-border text-presentation-muted hover:text-presentation-text'
          }`}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          Exceptions
          <span className="tabular-nums text-xs">{exceptionCount}</span>
        </button>
      </div>

      {/* The projected funnel table — same model, projection-dark render */}
      <div className="mt-5 flex-1 min-h-0 overflow-auto rounded-xl border border-presentation-border">
        <table className="border-separate border-spacing-0 w-full">
          <thead>
            {/* Tier 1 — funnel stage groups; click a group to expand / collapse it. */}
            <tr>
              <th
                colSpan={2}
                className={`${T1_H} sticky top-0 left-0 z-40 bg-presentation-text/10 border-b border-presentation-border px-3 text-left text-[9px] font-bold tracking-[0.14em] uppercase text-presentation-muted whitespace-nowrap`}
                style={{ width: LEAD_RANK_W + LEAD_AGENT_W }}
              >
                The Funnel →
              </th>
              {view.groups.map((g) => {
                const togglable = g.id !== 'qa';
                return (
                  <th
                    key={g.id}
                    colSpan={g.vcols.length}
                    className={`${T1_H} sticky top-0 z-30 bg-presentation-text/10 border-b border-l border-presentation-border p-0`}
                  >
                    <button
                      type="button"
                      onClick={togglable ? () => toggleGroup(g.id) : undefined}
                      disabled={!togglable}
                      aria-expanded={togglable ? g.open : undefined}
                      aria-label={togglable ? `${g.open ? 'Collapse' : 'Expand'} ${g.label}` : undefined}
                      className={`w-full h-full flex items-center gap-1.5 pl-3 pr-2 ${togglable ? 'cursor-pointer hover:bg-presentation-text/5' : 'cursor-default'}`}
                    >
                      <span className="text-[9px] font-bold tracking-wide text-presentation-accent">{g.num}</span>
                      <span className="text-[9px] font-bold tracking-[0.11em] uppercase text-presentation-muted truncate">{g.open ? g.label : g.short}</span>
                      {togglable && (
                        <span className="ml-auto w-3.5 h-3.5 shrink-0 rounded border border-presentation-border flex items-center justify-center text-presentation-muted" aria-hidden="true">
                          {g.open ? <Minus size={9} /> : <Plus size={9} />}
                        </span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
            {/* Tier 2 — sub-columns; every column header sorts (tri-state). */}
            <tr>
              <th className={`${SUB_TOP} sticky left-0 z-40 bg-presentation border-b border-presentation-border px-2 py-1.5 text-center text-[9px] font-semibold uppercase tracking-wide text-presentation-muted`} style={{ width: LEAD_RANK_W }}>#</th>
              <th className={`${SUB_TOP} sticky z-40 bg-presentation border-b border-presentation-border px-3 py-1.5 text-left text-[9px] font-semibold uppercase tracking-wide text-presentation-muted`} style={{ width: LEAD_AGENT_W, left: LEAD_RANK_W }}>Agent</th>
              {view.cols.map((c) => {
                const sorted = sort && sort.key === c.key;
                const wash = c.terminal ? 'bg-presentation-accent/10 text-presentation-accent' : c.kpi ? 'bg-presentation-text/5 text-presentation-text' : 'text-presentation-muted';
                return (
                  <th
                    key={c.key}
                    aria-sort={sorted ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}
                    className={`${SUB_TOP} sticky z-30 bg-presentation border-b border-presentation-border ${c.groupStart ? 'border-l' : ''} p-0`}
                    style={{ width: c.w }}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(c.key)}
                      title={`Sort by ${c.label} — ↓, ↑, then back to default`}
                      className={`w-full h-full flex items-center justify-end gap-1 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap ${wash} ${c.kpi ? 'font-bold' : ''}`}
                    >
                      <span>{c.label}</span>
                      {c.ik && (
                        <span className="ml-0.5 px-1 rounded border border-presentation-border text-[7.5px] font-bold tracking-wide text-presentation-muted" aria-label="Interviews Kept contributor">IK</span>
                      )}
                      {sorted
                        ? (sort.dir === 'desc' ? <ArrowDown size={10} aria-hidden="true" /> : <ArrowUp size={10} aria-hidden="true" />)
                        : (c.kpi ? <ChevronsUpDown size={10} className="text-presentation-muted/50" aria-hidden="true" /> : null)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={2 + view.cols.length} className="px-3 py-10 text-center">
                  <p className="text-sm font-semibold text-presentation-text" data-testid="meeting-funnel-empty">
                    {exceptionsOn ? 'No exceptions in view' : search.trim() ? 'No agents match your search' : 'No submissions this week'}
                  </p>
                </td>
              </tr>
            )}
            {displayRows.map((row) => {
              const gold = row.rank <= 3;
              const isException = funnelRowIsException(row);
              return (
                <tr key={row.id} data-testid={`mfrow-${row.id}`} className="hover:bg-presentation-text/5">
                  <td className="sticky left-0 z-20 bg-presentation border-b border-presentation-border px-2 py-2 text-center align-middle" style={{ width: LEAD_RANK_W }}>
                    <span className={`text-sm font-bold tabular-nums ${gold ? 'text-presentation-gold' : 'text-presentation-muted'}`}>{row.rank}</span>
                  </td>
                  <td className="sticky z-20 bg-presentation border-b border-presentation-border px-3 py-2 text-left align-middle" style={{ width: LEAD_AGENT_W, left: LEAD_RANK_W }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-semibold text-presentation-text whitespace-nowrap truncate">{row.name}</span>
                      {isException && (
                        <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-warning/15 text-warning">Draft</span>
                      )}
                    </div>
                  </td>
                  {view.cols.map((c) => (
                    <ProjCell key={c.key} col={c} value={row.v[c.key]} rowId={row.id} />
                  ))}
                </tr>
              );
            })}
          </tbody>

          {displayRows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2} className="sticky bottom-0 left-0 z-30 bg-presentation-text/10 border-t border-presentation-border px-3 py-2 text-left text-[9px] font-bold tracking-[0.13em] uppercase text-presentation-muted whitespace-nowrap">
                  Branch · {displayRows.length} agent{displayRows.length === 1 ? '' : 's'}
                </td>
                {view.cols.map((c) => {
                  const wash = c.terminal ? 'bg-presentation-accent/10 text-presentation-accent' : c.kpi ? 'bg-presentation-text/5 text-presentation-text' : 'text-presentation-muted';
                  return (
                    <td
                      key={c.key}
                      data-testid={`mftot-${c.key}`}
                      data-value={totals[c.key]}
                      className={`sticky bottom-0 z-20 bg-presentation-text/10 border-t border-presentation-border ${c.groupStart ? 'border-l' : ''} px-3 py-2 text-right tabular-nums whitespace-nowrap ${wash} ${c.terminal || c.kpi ? 'text-[13px] font-bold' : 'text-[12px] font-medium'}`}
                      style={{ width: c.w }}
                    >
                      {c.money
                        ? <span><span className="text-[9px] opacity-60 mr-0.5">TTD</span>{ttdK(totals[c.key])}</span>
                        : totals[c.key]}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* IK footer — the Activity Standards derived figure. */}
      <div className="mt-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-presentation-muted flex-shrink-0" data-testid="meeting-funnel-ik">
        <span className="px-1 rounded border border-presentation-border text-[7.5px] font-bold tracking-wide">IK</span>
        FFI + CI Conducted = Interviews Kept · {interviewsKept} this week
      </div>
    </div>
  );
}
