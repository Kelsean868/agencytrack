import { useState, useEffect, useMemo, useRef } from 'react';
import React from 'react';
import StatusPill from '../ui/StatusPill';
import Avatar from '../ui/Avatar';
import DataSourceBadge from '../productionReport/DataSourceBadge';
import {
  Download, Search, MessageSquare, CalendarCheck, AlertTriangle,
  Plus, Minus, ArrowUp, ArrowDown, ChevronsUpDown, X, SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useAppSettings from '../../hooks/useAppSettings';
import { DEFAULT_MASTER_SHEET_PRESET, isValidMasterSheetPreset } from '../../config/viewDefaults';
import { getWeeklySubmissions, getTenantUsers } from '../../services/managerService';
import { getLastNSundays } from '../../utils/dateHelpers';
import { formatCurrency, formatDateFriendly } from '../../utils/formatters';
import { extractFields, extractTotalProductionCredit } from '../../utils/extractFields';
import { deriveExceptions } from '../../utils/managerExceptions';
import {
  FUNNEL_GROUPS, FUNNEL_COLS, FUNNEL_TOGGLABLE_IDS, FUNNEL_LEAD_W, FUNNEL_LEAD_LEFT,
  funnelView, computeFunnelRow, computeInterviewsKept, computeFunnelTotals, funnelRowIsException,
} from '../../utils/funnelModel';
import {
  FUNNEL_REPORT_OPTS, DEFAULT_FUNNEL_FILTERS,
  deriveUnitOptions, funnelFiltersCount, applyFunnelFilters, buildFilterChips,
} from '../../utils/funnelFilters';
import SubmissionViewer from '../submissions/SubmissionViewer';
import CoachingNotesModal from './CoachingNotesModal';

// ── Dense-table styling helpers (Nexus v2 funnel edition) ────────────────────
// Emphasis is weight + tone, not colour alone. Teal is reserved for the terminal
// KPI band (API) only. The two KPI/terminal washes auto-theme because the CSS-var
// channels flip in `.dark` (see src/index.css).
const KPI_WASH   = 'bg-[rgb(var(--text-channels)/0.05)] dark:bg-[rgb(var(--text-channels)/0.055)]';
const TERM_WASH  = 'bg-[rgb(var(--primary-channels)/0.085)] dark:bg-[rgb(var(--primary-channels)/0.11)]';
// Group boundary hairline (--border-strong-channels; `border` has no strong tier).
const RULE_STRONG = 'border-l border-[rgb(var(--border-strong-channels))]';
// 6px scroll shadow marking the pinned lead seam.
const SEAM_SHADOW = 'shadow-[6px_0_8px_-6px_rgba(38,35,28,0.10)] dark:shadow-[6px_0_8px_-6px_rgba(0,0,0,0.45)]';

// Compact TTD money for the dense API column: "TTD 24.4K" (weekly scale).
function apiText(n) {
  const v = Number(n) || 0;
  return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`;
}

function resolveName(sub, userNameMap) {
  if (sub.agentName)   return sub.agentName;
  if (sub.displayName) return sub.displayName;
  if (sub.userName)    return sub.userName;
  const uid = sub.agentId ?? sub.userId ?? '';
  if (uid && userNameMap[uid]) return userNameMap[uid];
  return uid ? `Agent ${uid.slice(-6)}` : '—';
}

// One numeric funnel body cell — sub-column, stage KPI, or the terminal API band.
function FunnelCell({ col, value, terminalKey, rowId }) {
  const isTerm = col.key === terminalKey;
  const isKpi = col.kpi;
  const zero = !value;
  const tid = `fc-${col.key}-${rowId}`;
  const base = `px-2.5 py-2 text-right tabular-nums whitespace-nowrap ${col.groupStart ? RULE_STRONG : ''}`;
  if (isTerm) {
    return (
      <td data-testid={tid} data-value={value} className={`${base} ${TERM_WASH} text-[12px] font-bold text-primary`} style={{ width: col.w }}>
        {col.money
          ? <span><span className="text-[8.5px] font-semibold tracking-wide text-primary/70 mr-0.5">TTD</span>{apiText(value)}</span>
          : (zero ? <span className="text-ink-dim">—</span> : value)}
      </td>
    );
  }
  if (isKpi) {
    return (
      <td data-testid={tid} data-value={value} className={`${base} ${KPI_WASH} text-[12px] font-bold ${zero ? 'text-ink-dim' : 'text-ink'}`} style={{ width: col.w }}>
        {col.money
          ? <span><span className="text-[8.5px] font-semibold tracking-wide text-ink-muted mr-0.5">TTD</span>{apiText(value)}</span>
          : (zero ? '—' : value)}
      </td>
    );
  }
  return (
    <td data-testid={tid} data-value={value} className={`${base} text-[11.5px] font-normal ${zero ? 'text-ink-dim' : 'text-ink-muted'}`} style={{ width: col.w }}>
      {zero ? '—' : value}
    </td>
  );
}

export default function MasterSheet({ selectedWeek, setSelectedWeek }) {
  const { tenantId, user } = useAuth();
  // Settings v2 (Fable Run4 polish Item 2) — "Default RANK BY" seeds the initial
  // RANK BY value. Read ONLY at mount (the lazy useState initializer below runs
  // once, on the first render): a legacy 5-preset string or an absent value both
  // fail closed to the API default. Session RANK BY changes inside the sheet
  // stay local/ephemeral — they never write back to this setting, and a
  // background Firestore reconcile that resolves after mount does not retroactively
  // change an already-open sheet's rank order.
  const { settings } = useAppSettings({ tenantId, uid: user?.uid });
  const [submissions, setSubmissions] = useState([]);
  const [users, setUsers]             = useState([]);
  const [userNameMap, setUserNameMap] = useState({});
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [search, setSearch]           = useState('');
  const [exceptionsOnly, setExceptionsOnly] = useState(false);

  // Funnel view state (session-local — expand/sort/filters are NOT persisted;
  // only the RANK BY *default* comes from Settings, and only at mount). Mirrors
  // `pickPreset`'s pairing of `preset` + `sort` exactly, so a settings-driven
  // 'newNames' default actually ranks the table by New Names on first paint —
  // not just tint the terminal column while rows sit in API order.
  const initialPreset = isValidMasterSheetPreset(settings.masterSheetPreset)
    ? settings.masterSheetPreset : DEFAULT_MASTER_SHEET_PRESET;
  const [expanded, setExpanded] = useState(() => new Set()); // default: all collapsed → totals only
  const [sort, setSort]         = useState(() => (           // {key, dir} | null (null = production-credit rank)
    initialPreset === 'newNames' ? { key: 'newNames', dir: 'desc' } : null
  ));
  const [preset, setPreset]     = useState(() => initialPreset); // RANK BY: 'api' | 'newNames'

  // Filters (scene 06) — unit · weekly-report · no-log. STATUS + LEVEL chips from
  // the mockup are intentionally NOT built here — see src/utils/funnelFilters.js
  // for the honesty rationale (this read-light single-week surface loads neither
  // YTD/tenure-floor data for STATUS nor any level field for LEVEL).
  const [filters, setFilters]         = useState(DEFAULT_FUNNEL_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [notesAgent, setNotesAgent] = useState(null);
  const scrollRef = useRef(null);

  const sundays = getLastNSundays(8);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      getWeeklySubmissions(tenantId, selectedWeek),
      getTenantUsers(tenantId).catch(() => []),
    ])
      .then(([subs, userList]) => {
        setSubmissions(subs);
        setUsers(userList);
        const nameMap = {};
        userList.forEach((u) => { nameMap[u.id] = u.name ?? u.displayName ?? u.email ?? null; });
        setUserNameMap(nameMap);
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load data. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [selectedWeek, tenantId]);

  const userMeta = useMemo(() => {
    const m = {};
    users.forEach((u) => {
      m[u.id] = {
        unitId:   u.unitId ?? null,
        unitName: u.unitName ?? u.unit ?? null,
        level:    u.levelTitle ?? u.careerLevel ?? null,
      };
    });
    return m;
  }, [users]);

  // All loaded rows, ranked by this-week production credit (desc). Rank is a true
  // standing over the full loaded set — computed BEFORE search/exception/sort so
  // it stays stable as the operator filters or re-sorts.
  const allRows = useMemo(() => {
    return submissions
      .map((sub) => {
        const f = extractFields(sub);
        const v = computeFunnelRow(f, sub);
        const uid = sub.agentId ?? sub.userId ?? sub.id;
        const meta = userMeta[uid] ?? {};
        return {
          id:          uid,
          _submission: sub,
          name:        resolveName(sub, userNameMap),
          unitId:      sub.unitId ?? meta.unitId ?? null,
          unitName:    meta.unitName ?? null,
          level:       meta.level ?? null,
          status:      sub.status ?? 'draft',
          logged:      (f.daysWorked ?? null) != null,
          api:         extractTotalProductionCredit(sub),
          v,
        };
      })
      .sort((a, b) => (b.api || 0) - (a.api || 0))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [submissions, userNameMap, userMeta]);

  // A single-week "exception" = report not yet submitted (draft = unfinished).
  // Uses the shared funnelRowIsException predicate (also used by the Meeting-Mode
  // projection scene) directly at its call site below.

  const searchedRows = useMemo(
    () => allRows.filter(
      (r) => search.trim() === '' || r.name.toLowerCase().includes(search.trim().toLowerCase())
    ),
    [allRows, search]
  );

  // Filters panel conditions (unit · report · no-log) compose AFTER search and
  // BEFORE the exceptions toggle + sort, so all view controls stack predictably.
  const panelFilteredRows = useMemo(
    () => applyFunnelFilters(searchedRows, filters),
    [searchedRows, filters]
  );

  const filteredRows = useMemo(
    () => (exceptionsOnly ? panelFilteredRows.filter(funnelRowIsException) : panelFilteredRows),
    [panelFilteredRows, exceptionsOnly]
  );

  // Unit options derive from the loaded roster (no unit-name fetch — read-light).
  const unitOptions  = useMemo(() => deriveUnitOptions(allRows), [allRows]);
  const filtersCount = funnelFiltersCount(filters);
  const filterChips  = useMemo(() => buildFilterChips(filters, unitOptions), [filters, unitOptions]);

  const setFilterPatch = (patch) => setFilters((prev) => ({ ...prev, ...patch }));
  const resetFilters   = () => setFilters(DEFAULT_FUNNEL_FILTERS);
  const toggleReport   = (k) => setFilters((prev) => ({
    ...prev,
    reports: prev.reports.includes(k) ? prev.reports.filter((x) => x !== k) : [...prev.reports, k],
  }));

  // Week change resets filters (they are week-scoped view state) so a unit that
  // no longer exists in the new week can't silently empty the table.
  useEffect(() => {
    setFilters(DEFAULT_FUNNEL_FILTERS);
    setFiltersOpen(false);
  }, [selectedWeek]);

  // Escape closes the filters popover.
  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setFiltersOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtersOpen]);

  // Tri-state sort applies over the filtered set; null → production-credit rank.
  const displayRows = useMemo(() => {
    if (!sort) return filteredRows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filteredRows].sort((a, b) => dir * ((b.v[sort.key] || 0) - (a.v[sort.key] || 0)));
  }, [filteredRows, sort]);

  // ── Reality bar stats (read-light — single week only) ──────────────────────
  const agentUsers = useMemo(() => users.filter((u) => u?.role === 'agent'), [users]);
  const reportExceptions = useMemo(
    () => deriveExceptions({ users: agentUsers, subs: submissions, companyMins: null }).filter((e) => e.type === 'report'),
    [agentUsers, submissions]
  );
  const weekApiTotal = useMemo(
    () => allRows.reduce((s, r) => s + (typeof r.api === 'number' ? r.api : 0), 0),
    [allRows]
  );
  const filerCount     = allRows.length;
  const submittedCount = useMemo(() => allRows.filter((r) => r.status === 'submitted').length, [allRows]);
  const draftCount     = filerCount - submittedCount;
  const rosterCount    = agentUsers.length || filerCount;
  const nonFilerCount  = reportExceptions.length;
  const exceptionCount = nonFilerCount + draftCount;

  const terminalKey = preset === 'newNames' ? 'newNames' : 'api';
  const view = useMemo(() => funnelView(expanded), [expanded]);
  const totals = useMemo(() => computeFunnelTotals(displayRows.map((r) => r.v), view.cols), [displayRows, view]);
  const interviewsKept = useMemo(() => computeInterviewsKept(displayRows.map((r) => r.v)), [displayRows]);

  const allOpen   = FUNNEL_TOGGLABLE_IDS.every((id) => expanded.has(id));
  const allClosed = expanded.size === 0;

  // ── View controls ──────────────────────────────────────────────────────────
  const toggleGroup = (id) => setExpanded((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const expandAll   = () => setExpanded(new Set(FUNNEL_TOGGLABLE_IDS));
  const collapseAll = () => setExpanded(new Set());

  // Tri-state: click ↓ (desc) → ↑ (asc) → clear back to default rank order.
  const onSort = (key) => setSort((prev) => {
    if (!prev || prev.key !== key) return { key, dir: 'desc' };
    if (prev.dir === 'desc') return { key, dir: 'asc' };
    return null;
  });

  // RANK BY preset: sets the sort AND moves the terminal teal emphasis.
  const pickPreset = (k) => {
    setPreset(k);
    setSort({ key: k === 'newNames' ? 'newNames' : 'api', dir: 'desc' });
  };

  // Narrow-viewport stage scrubber — scroll a group into view after the sticky
  // lead columns.
  const scrollToGroup = (groupId) => {
    const el = scrollRef.current;
    if (!el) return;
    let x = 0;
    for (const c of view.cols) { if (c.groupId === groupId) break; x += c.w; }
    el.scrollLeft = x;
  };

  // CSV export is RECORDS-COMPLETE: every funnel sub-column + KPI, every row in
  // the current SEARCH scope (ignores collapse, the exceptions toggle, AND the
  // filters panel — same "records-complete" contract as the exceptions toggle).
  const exportCSV = () => {
    const leadHeaders = ['Rank', 'Agent', 'Unit', 'Status'];
    const colHeaders = FUNNEL_COLS.map((c) => {
      const g = FUNNEL_GROUPS.find((gg) => gg.id === c.groupId);
      return `${g.short} ${c.label}`;
    });
    const csvRows = [
      [...leadHeaders, ...colHeaders].join(','),
      ...searchedRows.map((r) => [
        r.rank,
        `"${r.name}"`,
        `"${r.unitName ?? ''}"`,
        r.status,
        ...FUNNEL_COLS.map((c) => r.v[c.key] ?? 0),
      ].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-sheet-funnel-${selectedWeek}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortChip = sort
    ? (() => {
        const col = FUNNEL_COLS.find((c) => c.key === sort.key);
        if (!col) return null;
        return `${col.groupNum} ${col.label.toUpperCase()} ${sort.dir === 'desc' ? '↓' : '↑'}`;
      })()
    : null;

  const segBtn = (active) =>
    `min-h-[44px] px-3 rounded-md text-xs font-bold tracking-wide uppercase transition-colors ${
      active ? 'bg-card text-primary shadow-sm border border-border' : 'text-ink-muted hover:text-ink border border-transparent'
    }`;

  // Two-tier header row heights (dense desktop table).
  const T1_H = 'h-8';        // group tier
  const SUB_TOP = 'top-8';   // sub tier sticks below the 32px group tier

  return (
    <div className="flex flex-col gap-4">
      {notesAgent && (
        <CoachingNotesModal
          agentId={notesAgent.agentId}
          agentName={notesAgent.agentName}
          agentUnitId={notesAgent.agentUnitId}
          onClose={() => setNotesAgent(null)}
        />
      )}

      {viewingSubmission && (
        <SubmissionViewer submission={viewingSubmission} onClose={() => setViewingSubmission(null)} />
      )}

      {/* Reality bar — anchor-first team state (read-light; single week). */}
      <div
        className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-border bg-card px-4 py-3"
        data-testid="mastersheet-reality"
      >
        <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink">
          <CalendarCheck size={14} className="text-ink-muted" aria-hidden="true" />
          {formatDateFriendly(selectedWeek)}
        </div>

        <div className="hidden sm:block h-8 w-px bg-border" aria-hidden="true" />

        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Week API</span>
            <DataSourceBadge source="submitted" />
          </div>
          <div className="mt-0.5 text-lg font-semibold text-ink tabular-nums" data-testid="mastersheet-reality-weekapi">
            {formatCurrency(weekApiTotal)}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Submitted</div>
          <div className="mt-0.5 text-lg font-semibold text-ink tabular-nums" data-testid="mastersheet-reality-submitted">
            {submittedCount} / {filerCount}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Filed</div>
          <div className="mt-0.5 text-lg font-semibold text-ink tabular-nums" data-testid="mastersheet-reality-filed">
            {filerCount} / {rosterCount}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Exceptions</div>
          <div
            className={`mt-0.5 text-lg font-semibold tabular-nums ${exceptionCount > 0 ? 'text-warning-ink' : 'text-ink'}`}
            data-testid="mastersheet-reality-exceptions"
          >
            {exceptionCount}
          </div>
        </div>
      </div>

      {/* Action bar — VIEW · RANK BY · UNIT · FILTERS · exceptions.
          `relative` anchors the filters popover to this row. */}
      <div className="relative flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">View</span>
          <div className="inline-flex gap-1 rounded-lg border border-border bg-surface p-1" role="group" aria-label="Funnel detail view">
            <button type="button" onClick={collapseAll} aria-pressed={allClosed} className={segBtn(allClosed)}>Totals</button>
            <button type="button" onClick={expandAll} aria-pressed={allOpen} className={segBtn(allOpen)}>+ Details</button>
          </div>
        </div>

        <div className="inline-flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Rank by</span>
          <div className="inline-flex gap-1 rounded-lg border border-border bg-surface p-1" role="group" aria-label="Rank by">
            <button type="button" onClick={() => pickPreset('api')} aria-pressed={preset === 'api'} className={segBtn(preset === 'api')}>API</button>
            <button type="button" onClick={() => pickPreset('newNames')} aria-pressed={preset === 'newNames'} className={segBtn(preset === 'newNames')}>New Names</button>
          </div>
        </div>

        {/* UNIT — only when the loaded week actually spans more than one unit
            (staging carries no unit NAMES, so labels fall back — see funnelFilters). */}
        {unitOptions.length > 1 && (
          <div className="inline-flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-muted">Unit</span>
            <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1" role="group" aria-label="Filter by unit">
              <button
                type="button"
                data-testid="funnel-unit-all"
                onClick={() => setFilterPatch({ unit: 'all' })}
                aria-pressed={filters.unit === 'all'}
                className={segBtn(filters.unit === 'all')}
              >
                All
              </button>
              {unitOptions.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  data-testid={`funnel-unit-${u.id}`}
                  onClick={() => setFilterPatch({ unit: u.id })}
                  aria-pressed={filters.unit === u.id}
                  className={segBtn(filters.unit === u.id)}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* FILTERS — opens the popover; badge = active-condition count. */}
        <button
          type="button"
          data-testid="funnel-filters-toggle"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-haspopup="dialog"
          className={`min-h-[44px] inline-flex items-center gap-2 px-3 rounded-lg border text-sm font-semibold transition-colors ${
            filtersOpen || filtersCount > 0 ? 'bg-primary-tint border-primary/40 text-primary' : 'bg-card border-border text-ink-muted hover:text-ink'
          }`}
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Filters
          {filtersCount > 0 && (
            <span
              data-testid="funnel-filters-badge"
              className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white dark:bg-primary-dark text-[10px] font-bold flex items-center justify-center tabular-nums"
            >
              {filtersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          role="switch"
          aria-checked={exceptionsOnly}
          onClick={() => setExceptionsOnly((v) => !v)}
          className={`min-h-[44px] inline-flex items-center gap-2 px-3 rounded-lg border text-sm font-semibold transition-colors ${
            exceptionsOnly ? 'bg-warning/15 border-warning/40 text-warning-ink' : 'bg-card border-border text-ink-muted hover:text-ink'
          }`}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          Only exceptions
          <span className="tabular-nums text-xs">{exceptionCount}</span>
        </button>

        {/* Filters popover — unit is in the action bar; this panel carries the
            weekly-report + no-log conditions. STATUS/LEVEL omitted (see module). */}
        {filtersOpen && (
          <div
            role="dialog"
            aria-label="Master Sheet filters"
            data-testid="funnel-filters-panel"
            className="absolute top-full right-0 mt-2 z-40 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-lg p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-ink">Filters</span>
              <div className="flex-1" />
              <button
                type="button"
                data-testid="funnel-filters-reset"
                onClick={resetFilters}
                className="min-h-[44px] px-3 rounded-lg text-[11px] font-bold uppercase tracking-wide text-ink-muted hover:text-ink transition-colors"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="min-h-[44px] px-4 rounded-lg bg-primary text-white dark:bg-primary-dark text-[11px] font-bold uppercase tracking-wide transition-colors"
              >
                Done
              </button>
            </div>

            <div className="mb-3">
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted mb-2">Weekly report</div>
              <div className="flex flex-wrap gap-2">
                {FUNNEL_REPORT_OPTS.map(([k, label]) => {
                  const on = filters.reports.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      data-testid={`funnel-report-${k}`}
                      onClick={() => toggleReport(k)}
                      aria-pressed={on}
                      className={`min-h-[44px] px-3 rounded-full border text-xs font-bold tracking-wide transition-colors ${
                        on ? 'bg-primary-tint border-primary/40 text-primary' : 'bg-surface border-border text-ink-muted hover:text-ink'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={filters.noLog}
              data-testid="funnel-nolog"
              onClick={() => setFilterPatch({ noLog: !filters.noLog })}
              className={`w-full min-h-[44px] inline-flex items-center gap-3 px-3 rounded-lg border text-sm font-semibold transition-colors ${
                filters.noLog ? 'bg-warning/15 border-warning/40 text-warning-ink' : 'bg-surface border-border text-ink-muted hover:text-ink'
              }`}
            >
              <span
                aria-hidden="true"
                className={`relative w-7 h-4 rounded-full transition-colors ${filters.noLog ? 'bg-warning' : 'bg-ink-dim'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-card transition-all ${filters.noLog ? 'right-0.5' : 'left-0.5'}`} />
              </span>
              No daily log this week only
            </button>
          </div>
        )}
      </div>

      {/* Week selector · search · CSV */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          aria-label="Select week"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {sundays.map((d, i) => (
            <option key={d} value={d}>
              {i === 0 ? `This week — ${formatDateFriendly(d)}` : formatDateFriendly(d)}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agent…"
            className="w-full h-11 pl-8 pr-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <button
          onClick={exportCSV}
          disabled={loading || searchedRows.length === 0}
          className="h-11 px-4 rounded-lg border border-border bg-card text-ink text-sm font-medium flex items-center gap-2 hover:bg-surface transition-colors disabled:opacity-50"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Active-condition chips — every sort + filter renders as a dismissible
          chip; × clears that one condition. CLEAR ALL appears at ≥2 chips. */}
      {(sortChip || filterChips.length > 0) && (
        <div className="flex flex-wrap gap-2 items-center" data-testid="funnel-chips">
          {sortChip && (
            <span className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-surface border border-border text-[10px] font-bold tracking-wide text-ink-muted">
              SORT · {sortChip}
              <button
                type="button"
                onClick={() => { setSort(null); }}
                aria-label="Clear sort"
                className="w-5 h-5 rounded-full border border-[rgb(var(--border-strong-channels))] flex items-center justify-center text-ink-muted hover:text-ink"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          )}
          {filterChips.map((chip) => (
            <span
              key={chip.key}
              data-testid={`funnel-chip-${chip.key}`}
              className="inline-flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full bg-surface border border-border text-[10px] font-bold tracking-wide text-ink-muted"
            >
              {chip.text}
              <button
                type="button"
                onClick={() => setFilterPatch(chip.patch)}
                aria-label={`Clear ${chip.text}`}
                data-testid={`funnel-chip-${chip.key}-clear`}
                className="w-5 h-5 rounded-full border border-[rgb(var(--border-strong-channels))] flex items-center justify-center text-ink-muted hover:text-ink"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
          {(Number(Boolean(sortChip)) + filterChips.length) > 1 && (
            <button
              type="button"
              data-testid="funnel-chips-clear-all"
              onClick={() => { setSort(null); resetFilters(); }}
              className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{error}</div>
      )}

      {/* Narrow-viewport stage scrubber — jump-to-stage on narrow widths. */}
      <div className="md:hidden -mb-1 flex flex-nowrap gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Jump to funnel stage">
        {FUNNEL_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => scrollToGroup(g.id)}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 rounded-full border border-border bg-surface text-[10px] font-bold tracking-wide text-ink-muted whitespace-nowrap"
          >
            <span className="text-primary">{g.num}</span>{g.short}
          </button>
        ))}
      </div>

      {/* Table — card-scoped scroll on BOTH axes; two-tier sticky header; sticky
          lead columns; pinned totals row. */}
      <div ref={scrollRef} className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-border bg-card">
        <table className="border-separate border-spacing-0" style={{ minWidth: FUNNEL_LEAD_W.reduce((a, b) => a + b, 0) + view.cols.reduce((a, c) => a + c.w, 0) }}>
          <thead>
            {/* Tier 1 — funnel stage groups; click a group to expand / collapse it. */}
            <tr>
              <th
                colSpan={3}
                className={`${T1_H} sticky top-0 left-0 z-40 bg-surface-muted border-b border-border ${SEAM_SHADOW} px-3 text-left text-[8.5px] font-bold tracking-[0.14em] uppercase text-ink-muted whitespace-nowrap`}
                style={{ width: FUNNEL_LEAD_W.reduce((a, b) => a + b, 0) }}
              >
                The Funnel →
              </th>
              {view.groups.map((g) => {
                const togglable = g.id !== 'qa';
                return (
                  <th
                    key={g.id}
                    colSpan={g.vcols.length}
                    className={`${T1_H} sticky top-0 z-30 bg-surface-muted border-b border-border ${RULE_STRONG} p-0`}
                  >
                    <button
                      type="button"
                      onClick={togglable ? () => toggleGroup(g.id) : undefined}
                      disabled={!togglable}
                      aria-expanded={togglable ? g.open : undefined}
                      aria-label={togglable ? `${g.open ? 'Collapse' : 'Expand'} ${g.label}` : undefined}
                      className={`w-full h-full flex items-center gap-1.5 pl-2.5 pr-2 ${togglable ? 'cursor-pointer hover:bg-[rgb(var(--text-channels)/0.04)]' : 'cursor-default'}`}
                    >
                      <span className="text-[9px] font-bold tracking-wide text-primary">{g.num}</span>
                      <span className="text-[8.5px] font-bold tracking-[0.11em] uppercase text-ink-muted truncate">{g.open ? g.label : g.short}</span>
                      {togglable && (
                        <span className="ml-auto w-3.5 h-3.5 shrink-0 rounded border border-[rgb(var(--border-strong-channels))] bg-surface flex items-center justify-center text-ink-muted" aria-hidden="true">
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
              <th className={`${SUB_TOP} sticky left-0 z-40 bg-surface border-b border-[rgb(var(--border-strong-channels))] px-2 py-1.5 text-center text-[8.5px] font-semibold uppercase tracking-wide text-ink-muted`} style={{ width: FUNNEL_LEAD_W[0] }}>#</th>
              <th className={`${SUB_TOP} sticky z-40 bg-surface border-b border-[rgb(var(--border-strong-channels))] px-2 py-1.5 text-left text-[8.5px] font-semibold uppercase tracking-wide text-ink-muted`} style={{ width: FUNNEL_LEAD_W[1], left: FUNNEL_LEAD_LEFT[1] }}>Agent · Unit</th>
              <th className={`${SUB_TOP} sticky z-40 bg-surface border-b border-[rgb(var(--border-strong-channels))] ${SEAM_SHADOW} px-2 py-1.5 text-left text-[8.5px] font-semibold uppercase tracking-wide text-ink-muted`} style={{ width: FUNNEL_LEAD_W[2], left: FUNNEL_LEAD_LEFT[2] }}>Status</th>
              {view.cols.map((c) => {
                const isTerm = c.key === terminalKey;
                const sorted = sort && sort.key === c.key;
                const washCls = isTerm ? `${TERM_WASH} text-primary` : c.kpi ? `${KPI_WASH} text-ink` : 'text-ink-muted';
                return (
                  <th
                    key={c.key}
                    aria-sort={sorted ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}
                    className={`${SUB_TOP} sticky z-30 bg-surface border-b border-[rgb(var(--border-strong-channels))] ${c.groupStart ? RULE_STRONG : ''} p-0`}
                    style={{ width: c.w }}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(c.key)}
                      title={`Sort by ${c.label} — ↓, ↑, then back to default`}
                      className={`w-full h-full flex items-center justify-end gap-1 px-2.5 py-1.5 text-[8.5px] font-semibold uppercase tracking-wide whitespace-nowrap ${washCls} ${c.kpi ? 'font-bold' : ''}`}
                    >
                      <span>{c.label}</span>
                      {c.ik && (
                        <span className="ml-0.5 px-1 rounded border border-[rgb(var(--border-strong-channels))] text-[7.5px] font-bold tracking-wide text-ink-muted" aria-label="Interviews Kept contributor">IK</span>
                      )}
                      {sorted
                        ? (sort.dir === 'desc' ? <ArrowDown size={10} aria-hidden="true" /> : <ArrowUp size={10} aria-hidden="true" />)
                        : (c.kpi ? <ChevronsUpDown size={10} className="text-ink-dim" aria-hidden="true" /> : null)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {[...FUNNEL_LEAD_W.map((w, j) => ({ w, k: `l${j}` })), ...view.cols].map((c, j) => (
                    <td key={c.k ?? c.key ?? j} className="px-2.5 py-2.5 border-b border-border/40" style={{ width: c.w }}>
                      <div className="h-3 bg-border/60 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && displayRows.length === 0 && (
              <tr>
                <td colSpan={3 + view.cols.length} className="px-3 py-12">
                  <div className="flex flex-col items-center text-center gap-2" data-testid="mastersheet-empty">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-surface text-ink-muted">
                      {exceptionsOnly ? <AlertTriangle size={22} aria-hidden="true" /> : search.trim() ? <Search size={22} aria-hidden="true" /> : <CalendarCheck size={22} aria-hidden="true" />}
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      {exceptionsOnly ? 'No exceptions in view' : search.trim() ? 'No agents match your search' : 'No submissions yet this week'}
                    </p>
                    <p className="text-xs text-ink-muted max-w-xs">
                      {exceptionsOnly
                        ? 'Every filed report in the current view is submitted. Turn off the filter to see the full roster.'
                        : search.trim()
                          ? 'Try a different name, or clear the search to see the full roster.'
                          : 'Reports will appear here as your team submits them. Check back later or send a nudge from Compliance.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loading && displayRows.map((row, ri) => {
              const zebra = ri % 2 === 1;
              const rowBg = zebra ? 'bg-surface-raised' : 'bg-card';
              const gold = row.rank <= 3;
              return (
                <tr key={row.id} className="group cursor-pointer" onClick={() => setViewingSubmission(row._submission)}>
                  {/* Rank */}
                  <td className={`sticky left-0 z-20 ${rowBg} group-hover:bg-surface/60 border-b border-border/60 px-2 py-2 text-center align-middle`} style={{ width: FUNNEL_LEAD_W[0] }}>
                    <span data-testid={`rank-${row.id}`} className={`text-sm font-bold tabular-nums ${gold ? 'text-gold-ink' : 'text-ink-muted'}`}>{row.rank}</span>
                  </td>
                  {/* Agent · Unit */}
                  <td className={`sticky z-20 ${rowBg} group-hover:bg-surface/60 border-b border-border/60 px-2 py-2 text-left align-middle`} style={{ width: FUNNEL_LEAD_W[1], left: FUNNEL_LEAD_LEFT[1] }}>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.name} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-semibold text-ink whitespace-nowrap">{row.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNotesAgent({ agentId: row.id, agentName: row.name, agentUnitId: row._submission?.unitId ?? null });
                            }}
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-primary/10 transition-all"
                            aria-label={`Coaching notes for ${row.name}`}
                            title="Coaching Notes"
                          >
                            <MessageSquare size={13} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="text-[9px] font-medium uppercase tracking-wide text-ink-muted whitespace-nowrap">
                          {row.unitName || 'Unit —'}{!row.logged ? ' · NO LOG' : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Status */}
                  <td className={`sticky z-20 ${rowBg} group-hover:bg-surface/60 border-b border-border/60 ${SEAM_SHADOW} px-2 py-2 text-left align-middle`} style={{ width: FUNNEL_LEAD_W[2], left: FUNNEL_LEAD_LEFT[2] }}>
                    <StatusPill variant={row.status === 'submitted' ? 'success' : 'warning'} label={row.status === 'submitted' ? 'Submitted' : 'Draft'} />
                  </td>
                  {/* Funnel cells */}
                  {view.cols.map((c) => (
                    <FunnelCell key={c.key} col={c} value={row.v[c.key]} terminalKey={terminalKey} rowId={row.id} />
                  ))}
                </tr>
              );
            })}
          </tbody>

          {!loading && displayRows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} className={`sticky bottom-0 left-0 z-30 bg-surface-muted border-t border-[rgb(var(--border-strong-channels))] ${SEAM_SHADOW} px-3 py-2 text-left text-[9px] font-bold tracking-[0.13em] uppercase text-ink-muted whitespace-nowrap`}>
                  Branch · {displayRows.length} agents
                </td>
                {view.cols.map((c) => {
                  const isTerm = c.key === terminalKey;
                  const washCls = isTerm ? `${TERM_WASH} text-primary` : c.kpi ? `${KPI_WASH} text-ink` : 'text-ink-muted';
                  return (
                    <td
                      key={c.key}
                      data-testid={`ftot-${c.key}`}
                      data-value={totals[c.key]}
                      className={`sticky bottom-0 z-20 bg-surface-muted border-t border-[rgb(var(--border-strong-channels))] ${c.groupStart ? RULE_STRONG : ''} px-2.5 py-2 text-right tabular-nums whitespace-nowrap ${washCls} ${isTerm || c.kpi ? 'text-[12px] font-bold' : 'text-[11px] font-medium'}`}
                      style={{ width: c.w }}
                    >
                      {c.money
                        ? <span><span className="text-[8.5px] opacity-60 mr-0.5">TTD</span>{apiText(totals[c.key])}</span>
                        : totals[c.key]}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Footer — counts + the Interviews Kept derivation. */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <span>
            {searchedRows.length} submission{searchedRows.length !== 1 ? 's' : ''} •{' '}
            {searchedRows.filter((r) => r.status === 'submitted').length} submitted •{' '}
            {searchedRows.filter((r) => r.status === 'draft').length} draft
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted" data-testid="funnel-ik-footer">
            <span className="px-1 rounded border border-[rgb(var(--border-strong-channels))] text-[7.5px] font-bold tracking-wide">IK</span>
            FFI + CI Conducted = Interviews Kept · {interviewsKept} this week
          </span>
        </div>
      )}
    </div>
  );
}
