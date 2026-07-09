import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import StatusPill from '../ui/StatusPill';
import Avatar from '../ui/Avatar';
import DataSourceBadge from '../productionReport/DataSourceBadge';
import { Download, Search, MessageSquare, CalendarCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getWeeklySubmissions, getTenantUsers } from '../../services/managerService';
import { getLastNSundays } from '../../utils/dateHelpers';
import { formatCurrency, formatDateFriendly } from '../../utils/formatters';
import { extractFields, computeRatios, extractTotalProductionCredit } from '../../utils/extractFields';
import { deriveExceptions } from '../../utils/managerExceptions';
import SubmissionViewer from '../submissions/SubmissionViewer';
import CoachingNotesModal from './CoachingNotesModal';

// Column definitions — drives both header and cell rendering.
// `rank` (leading #) + `name` are the two sticky-left identity columns (0.3's
// "first 2 columns sticky" contract, now rank+name to match the mastersheet-v2
// matrix mockup which pins # · Agent and lets Status scroll). Every other column
// is a per-week activity numeral.
const COLS = [
  { key: 'rank',                label: '#',                  sticky: true,  left: 'left-0',       minW: 'w-12',        rankCol: true },
  { key: 'name',                label: 'Agent',              sticky: true,  left: 'left-[48px]',  minW: 'min-w-[180px]' },
  { key: 'status',              label: 'Status',                                                  minW: 'min-w-[110px]' },
  { key: 'prospectingTouches',  label: 'Prospect. Touches',                                       minW: 'min-w-[80px]'  },
  { key: 'personsReached',      label: 'Persons Reached',                                          minW: 'min-w-[80px]'  },
  { key: 'totalTelAttempts',    label: 'Tel Attempts',                                             minW: 'min-w-[80px]'  },
  { key: 'f2fAttempts',         label: 'F2F Att.',                                                 minW: 'min-w-[80px]'  },
  { key: 'contactsMade',        label: 'Contacts Made',                                            minW: 'min-w-[80px]'  },
  { key: 'qualifiedApproaches', label: 'Qual. App.',                                               minW: 'min-w-[80px]'  },
  { key: 'ffisScheduled',       label: 'FFI Sched.',                                               minW: 'min-w-[80px]'  },
  { key: 'ffiConducted',        label: 'FFI Done',                                                 minW: 'min-w-[80px]'  },
  { key: 'solutionPresentations',label: 'Solutions',                                               minW: 'min-w-[80px]'  },
  { key: 'newCIBooked',         label: 'New CI',                                                   minW: 'min-w-[80px]'  },
  { key: 'oldCIBooked',         label: 'Old CI',                                                   minW: 'min-w-[80px]'  },
  { key: 'ciConducted',         label: 'Total CI',                                                 minW: 'min-w-[80px]'  },
  { key: 'applicationsSold',    label: 'Sales',                                                    minW: 'min-w-[80px]'  },
  { key: 'livesSold',           label: 'Lives',                                                    minW: 'min-w-[80px]'  },
  { key: 'totalProductionCredit', label: 'API (TTD)',         currency: true, conditional: true,   minW: 'min-w-[110px]' },
  { key: 'daysWorked',          label: 'Days Wkd',           daysWorked: true,                    minW: 'min-w-[80px]'  },
  { key: 'weekendWorked',       label: 'Weekend',            weekend: true,                       minW: 'min-w-[90px]'  },
  { key: 'weekendApi',          label: 'Wknd API',           currency: true,                      minW: 'min-w-[110px]' },
  { key: 'policiesDelivered',   label: 'Delivered',                                                minW: 'min-w-[80px]'  },
  { key: 'serviceContacts',     label: 'Service',                                                  minW: 'min-w-[80px]'  },
  { key: 'totalNewNames',       label: 'New Names',                                                minW: 'min-w-[80px]'  },
  { key: 'targetAPI',           label: 'Next Wk API',         currency: true,                      minW: 'min-w-[110px]' },
  { key: 'targetAppsSold',      label: 'Next Wk Apps',                                             minW: 'min-w-[80px]'  },
  { key: 'closingRatio',        label: 'Closing %',           ratio: true,                         minW: 'min-w-[80px]'  },
];

// Column presets (MasterActionBar in mastersheet-v2-shared). Identity columns
// (# / Agent / Status) are always visible; each preset reveals a domain subset
// of the ~25 activity columns. The live weekly WAR sheet carries no native
// agent-recruiting or persistency-% columns (those live on the Recruiting tab /
// monthly manager-entered persistency), so those two presets map to the nearest
// honest single-week analogs (top-of-funnel name generation; post-sale
// delivery/service) — documented as a mockup-vs-repo divergence, not fabricated.
//
// PERSISTENCE: preset lives in session-local useState (default 'All'). A saved
// master-sheet view-default is Settings v2's job (item 2.4) — intentionally NOT
// wired to localStorage/Firestore here.
const IDENTITY_KEYS = new Set(['rank', 'name', 'status']);
const PRESETS = {
  All: null, // null = every column
  Production: new Set([
    'qualifiedApproaches', 'ffisScheduled', 'ffiConducted', 'solutionPresentations',
    'newCIBooked', 'oldCIBooked', 'ciConducted', 'applicationsSold', 'livesSold',
    'totalProductionCredit', 'weekendApi', 'targetAPI', 'targetAppsSold', 'closingRatio',
  ]),
  Recruiting: new Set([
    'prospectingTouches', 'totalNewNames', 'personsReached', 'totalTelAttempts',
    'f2fAttempts', 'contactsMade', 'qualifiedApproaches',
  ]),
  Compliance: new Set([
    'daysWorked', 'weekendWorked', 'weekendApi', 'policiesDelivered',
    'serviceContacts', 'targetAPI', 'targetAppsSold',
  ]),
  Persistency: new Set(['policiesDelivered', 'serviceContacts', 'livesSold']),
};
const PRESET_ORDER = ['All', 'Production', 'Recruiting', 'Compliance', 'Persistency'];

// §5 dense-table contract: identity/status/rank columns stay left/center-aligned
// text; every other column (counts, currency, ratios, days worked) is a numeral
// and renders right-aligned + tabular-nums (inherited from the td onto its child
// spans — font-variant-numeric is an inherited property).
function isNumericCol(col) {
  if (col.key === 'name' || col.key === 'status' || col.key === 'rank') return false;
  if (col.weekend) return false; // Yes/No/— badge, not a numeral
  return true;
}

function resolveName(sub, userNameMap) {
  if (sub.agentName)   return sub.agentName;
  if (sub.displayName) return sub.displayName;
  if (sub.userName)    return sub.userName;
  const uid = sub.agentId ?? sub.userId ?? '';
  if (uid && userNameMap[uid]) return userNameMap[uid];
  return uid ? `Agent ${uid.slice(-6)}` : '—';
}


function apiColorClass(apiSold, targetAPI) {
  if (!targetAPI) return '';
  const pct = (apiSold / targetAPI) * 100;
  if (pct >= 80) return 'text-success-ink font-semibold';
  if (pct >= 50) return 'text-warning-ink font-semibold';
  return 'text-danger-ink font-semibold';
}

function SkeletonRow({ cols }) {
  return (
    <tr>
      {cols.map((c) => (
        <td key={c.key} className={`px-3 py-3 border-b border-border/40 ${c.minW}`}>
          <div className="h-3 bg-border/60 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function MasterSheet({ selectedWeek, setSelectedWeek }) {
  const { tenantId } = useAuth();
  const [submissions, setSubmissions]       = useState([]);
  const [users, setUsers]                   = useState([]);
  const [userNameMap, setUserNameMap]       = useState({});
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [search, setSearch]                 = useState('');
  const [preset, setPreset]                 = useState('All');
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState(null);
  // F1 coaching notes: agentId/agentName/agentUnitId of the agent whose notes panel is open
  const [notesAgent, setNotesAgent] = useState(null);

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
        userList.forEach((u) => {
          nameMap[u.id] = u.name ?? u.displayName ?? u.email ?? null;
        });
        setUserNameMap(nameMap);
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load data. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [selectedWeek, tenantId]);

  // Per-agent unit/level identity metadata, from the tenant user docs already
  // loaded (no new read). Rendered only when present — never fabricated, never
  // raw uids.
  const userMeta = useMemo(() => {
    const m = {};
    users.forEach((u) => {
      m[u.id] = {
        unitName: u.unitName ?? u.unit ?? null,
        level:    u.levelTitle ?? u.careerLevel ?? null,
      };
    });
    return m;
  }, [users]);

  // All loaded rows, ranked by this-week production credit (descending). Rank is
  // a true standing over the full loaded set — computed BEFORE search/exception
  // filters so it stays stable as the operator filters.
  const allRows = useMemo(() => {
    return submissions
      .map((sub) => {
        const f = extractFields(sub);
        const ratios = computeRatios(f);
        const personsReached = f.telContacts + f.f2fContacts;
        const uid = sub.agentId ?? sub.userId ?? sub.id;
        const meta = userMeta[uid] ?? {};
        return {
          id:                   uid,
          _submission:          sub,
          name:                 resolveName(sub, userNameMap),
          unitName:             meta.unitName ?? null,
          level:                meta.level ?? null,
          status:               sub.status ?? 'draft',
          prospectingTouches:   f.prospectingTouches,
          personsReached,
          totalTelAttempts:     f.totalTelAttempts,
          f2fAttempts:          f.f2fAttempts,
          contactsMade:         personsReached,
          qualifiedApproaches:  f.qualifiedApproaches,
          ffisScheduled:        f.ffisScheduled,
          ffiConducted:         f.ffiConducted,
          solutionPresentations: f.solutionPresentations,
          newCIBooked:          f.newCIBooked,
          oldCIBooked:          f.oldCIBooked,
          ciConducted:          f.ciConducted,
          applicationsSold:     f.applicationsSold,
          livesSold:            f.livesSold,
          totalProductionCredit: extractTotalProductionCredit(sub),
          daysWorked:           f.daysWorked,
          weekendWorked:        f.weekendWorked,
          weekendApi:           f.weekendApi,
          targetAPI:            f.targetAPI,
          policiesDelivered:    f.policiesDelivered,
          serviceContacts:      f.serviceContacts,
          totalNewNames:        f.totalNewNames,
          targetAppsSold:       f.targetAppsSold,
          closingRatio:         ratios.closingRatio,
        };
      })
      .sort((a, b) => (b.totalProductionCredit || 0) - (a.totalProductionCredit || 0))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [submissions, userNameMap, userMeta]);

  // A row is a single-week "exception" if its report is not yet submitted (draft
  // = unfinished this week). This is the only honest PER-ROW exception on a
  // single-week surface — floor/pace/persistency/gone-quiet all require YTD +
  // config that this surface intentionally does not load (see reality-bar note).
  const rowIsException = (r) => r.status !== 'submitted';

  const searchedRows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          search.trim() === '' ||
          r.name.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [allRows, search]
  );

  const displayRows = useMemo(
    () => (exceptionsOnly ? searchedRows.filter(rowIsException) : searchedRows),
    [searchedRows, exceptionsOnly]
  );

  // ── Reality bar stats (read-light) ────────────────────────────────────────
  // MasterSheet loads ONLY the selected week (getWeeklySubmissions) — no YTD
  // subs, no settlements, no companyMinimums. So the design's "YTD SETTLED API"
  // cannot be shown honestly here; a heavy YTD/settlement fan-out is out of scope
  // (read-light). We surface the WEEK's total production credit instead, badged
  // "Estimated" via the shared DataSourceBadge (submitted, not settled),
  // matching the app's settled-vs-submitted provenance pattern.
  //
  // ON PACE / EXCEPTIONS: the floor/pace exception classes in managerExceptions
  // need YTD + the tenure floor config (neither loaded). Feeding single-week
  // data to the engine would flag every filer "below floor" (one week vs the
  // 200k default floor pro-rated) — misleading. So we reuse deriveExceptions for
  // only the class it can derive honestly at single-week granularity: `report`
  // (roster agents with no submission for the selected week). Floor/pace triage
  // is the Team-Dashboard overview's job (item 1.5, which loads YTD; it applied
  // the same read-light SKIP-AND-LOG boundary for persistency/quiet).
  const agentUsers = useMemo(() => users.filter((u) => u?.role === 'agent'), [users]);
  const reportExceptions = useMemo(
    () =>
      deriveExceptions({ users: agentUsers, subs: submissions, companyMins: null })
        .filter((e) => e.type === 'report'),
    [agentUsers, submissions]
  );

  const weekApiTotal = useMemo(
    () => allRows.reduce((s, r) => s + (typeof r.totalProductionCredit === 'number' ? r.totalProductionCredit : 0), 0),
    [allRows]
  );
  const filerCount    = allRows.length;
  const submittedCount = useMemo(() => allRows.filter((r) => r.status === 'submitted').length, [allRows]);
  const draftCount    = filerCount - submittedCount;
  const rosterCount   = agentUsers.length || filerCount;
  const nonFilerCount = reportExceptions.length;
  const exceptionCount = nonFilerCount + draftCount;

  const visibleCols = useMemo(
    () =>
      COLS.filter(
        (c) => IDENTITY_KEYS.has(c.key) || preset === 'All' || PRESETS[preset]?.has(c.key)
      ),
    [preset]
  );

  // CSV export is RECORDS-COMPLETE: it always emits every column (ignores the
  // active preset) and every row in the current SEARCH scope, ignoring the
  // "only exceptions" toggle. Least-surprising for an exported record — a
  // filtered on-screen view should not silently truncate the export. (Search is
  // the one pre-existing filter export has always respected; left unchanged.)
  const exportCSV = () => {
    const headers = COLS.map((c) => c.label);
    const csvRows = [
      headers.join(','),
      ...searchedRows.map((r) =>
        COLS.map((c) => {
          const v = r[c.key];
          if (c.key === 'rank')   return v;
          if (c.key === 'name')   return `"${v}"`;
          if (c.key === 'status') return v;
          if (c.ratio)            return v === null ? '—' : `${v}%`;
          if (c.weekend)          return v === true ? 'Yes' : v === false ? 'No' : '—';
          if (c.currency)         return typeof v === 'number' ? v.toFixed(2) : '—';
          return v ?? '—';
        }).join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-sheet-${selectedWeek}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function cellContent(col, row) {
    const v = row[col.key];
    if (col.key === 'rank') {
      // Gold top-3 treatment. Rank is small/normal text → text-gold-ink per the
      // gold rule (vivid --color-gold is decoration-only in light; both roles map
      // to #E0AA3E in dark). See gold-split-audit.md rank-medal precedent.
      const gold = row.rank <= 3;
      return (
        <span
          data-testid={`rank-${row.id}`}
          className={`text-sm font-bold tabular-nums ${gold ? 'text-gold-ink' : 'text-ink-muted'}`}
        >
          {row.rank}
        </span>
      );
    }
    if (col.key === 'name') {
      const subline = [row.unitName, row.level].filter(Boolean).join(' · ');
      return (
        <div className="flex items-center gap-2.5">
          <Avatar name={v} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink whitespace-nowrap">{v}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotesAgent({
                    agentId:    row.id,
                    agentName:  v,
                    agentUnitId: row._submission?.unitId ?? null,
                  });
                }}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-primary hover:bg-primary/10 transition-all"
                aria-label={`Coaching notes for ${v}`}
                title="Coaching Notes"
              >
                <MessageSquare size={13} aria-hidden="true" />
              </button>
            </div>
            {subline && (
              <div className="text-[11px] text-ink-muted whitespace-nowrap">{subline}</div>
            )}
          </div>
        </div>
      );
    }
    if (col.key === 'status') {
      return <StatusPill variant={v === 'submitted' ? 'success' : 'warning'} label={v === 'submitted' ? 'Submitted' : 'Draft'} />;
    }
    if (col.daysWorked) {
      // Emergent effort: distinct days the agent logged. Absent (weekly-mode
      // agent, never logs daily) → `—`, never 0.
      return (
        <span className="text-ink tabular-nums" data-testid={`days-worked-${row.id}`}>
          {v == null ? '—' : v}
        </span>
      );
    }
    if (col.weekend) {
      // Compact marker — info token (not alarm-red). Present iff the agent
      // logged on the opening Sunday or Saturday this week.
      return (
        <span data-testid={`weekend-marker-${row.id}`} data-weekend={v === true ? 'yes' : v === false ? 'no' : 'na'}>
          {v === true ? (
            <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium bg-primary/10 text-primary">
              <CalendarCheck size={13} aria-hidden="true" />
              <span className="sr-only">Worked weekend</span>
              <span aria-hidden="true">Yes</span>
            </span>
          ) : (
            <span className="text-ink-muted">
              <span className="sr-only">{v === false ? 'No weekend work' : 'No daily data'}</span>
              <span aria-hidden="true">—</span>
            </span>
          )}
        </span>
      );
    }
    if (col.currency && col.conditional) {
      return (
        <span className={`whitespace-nowrap ${apiColorClass(row.totalProductionCredit, row.targetAPI)}`}>
          {formatCurrency(v)}
        </span>
      );
    }
    if (col.currency) {
      // weekendApi is null for non-daily submissions — render `—`, not $0.00.
      return (
        <span className="whitespace-nowrap text-ink-muted">
          {v == null ? '—' : formatCurrency(v)}
        </span>
      );
    }
    if (col.ratio) {
      return <span className="text-ink">{v === null ? '—' : `${v}%`}</span>;
    }
    return <span className="text-ink">{v ?? '—'}</span>;
  }

  const thBase =
    'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-ink-muted whitespace-nowrap border-b border-border';
  const tdBase = 'px-3 py-3 text-sm border-b border-border/40';

  const colAlign = (col) =>
    col.rankCol ? 'text-center' : isNumericCol(col) ? 'text-right tabular-nums' : 'text-left';

  return (
    <div className="flex flex-col gap-4">
      {/* F1: Coaching notes modal — per-agent, no submission required */}
      {notesAgent && (
        <CoachingNotesModal
          agentId={notesAgent.agentId}
          agentName={notesAgent.agentName}
          agentUnitId={notesAgent.agentUnitId}
          onClose={() => setNotesAgent(null)}
        />
      )}

      {/* Submission viewer drawer */}
      {viewingSubmission && (
        <SubmissionViewer
          submission={viewingSubmission}
          onClose={() => setViewingSubmission(null)}
        />
      )}

      {/* Reality bar (MasterReality) — anchor-first team state above the table.
          Read-light: every stat is computed from the single week already loaded. */}
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

      {/* Action bar — column presets + exceptions toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1"
          role="group"
          aria-label="Column presets"
        >
          {PRESET_ORDER.map((p) => {
            const active = preset === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                aria-pressed={active}
                className={`min-h-[44px] px-3 rounded-md text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-card text-ink shadow-sm border border-border'
                    : 'text-ink-muted hover:text-ink border border-transparent'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={exceptionsOnly}
          onClick={() => setExceptionsOnly((v) => !v)}
          className={`min-h-[44px] inline-flex items-center gap-2 px-3 rounded-lg border text-sm font-semibold transition-colors ${
            exceptionsOnly
              ? 'bg-warning/15 border-warning/40 text-warning-ink'
              : 'bg-card border-border text-ink-muted hover:text-ink'
          }`}
        >
          <AlertTriangle size={14} aria-hidden="true" />
          Only exceptions
          <span className="tabular-nums text-xs">{exceptionCount}</span>
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          aria-label="Select week"
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
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
            className="w-full h-10 pl-8 pr-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <button
          onClick={exportCSV}
          disabled={loading || searchedRows.length === 0}
          className="h-10 px-4 rounded-lg border border-border bg-card text-ink text-sm font-medium flex items-center gap-2 hover:bg-surface transition-colors disabled:opacity-50"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">
          {error}
        </div>
      )}

      {/* Table — card-scoped vertical + horizontal scroll (§5), sticky header,
          first 2 columns (# + Agent) sticky. Scroll lives inside this card. */}
      <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-border bg-card">
        <table className="text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className={`
                    ${thBase} ${col.minW}
                    sticky top-0 bg-surface
                    ${col.sticky ? `${col.left} z-30` : 'z-20'}
                    ${colAlign(col)}
                  `}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={visibleCols} />)}

            {!loading && displayRows.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length} className="px-3 py-12">
                  {/* Designed empty state (UX-001) — icon + headline + guidance. */}
                  <div
                    className="flex flex-col items-center text-center gap-2"
                    data-testid="mastersheet-empty"
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-surface text-ink-muted">
                      {exceptionsOnly
                        ? <AlertTriangle size={22} aria-hidden="true" />
                        : search.trim()
                          ? <Search size={22} aria-hidden="true" />
                          : <CalendarCheck size={22} aria-hidden="true" />}
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      {exceptionsOnly
                        ? 'No exceptions in view'
                        : search.trim()
                          ? 'No agents match your search'
                          : 'No submissions yet this week'}
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

            {!loading &&
              displayRows.map((row) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer"
                  onClick={() => setViewingSubmission(row._submission)}
                >
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      className={`
                        ${tdBase} ${col.minW}
                        ${colAlign(col)}
                        ${col.sticky
                          ? `sticky ${col.left} z-10 bg-card group-hover:bg-surface/50`
                          : 'group-hover:bg-surface/30'}
                      `}
                    >
                      {cellContent(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-xs text-ink-muted">
          {searchedRows.length} submission{searchedRows.length !== 1 ? 's' : ''} •{' '}
          {searchedRows.filter((r) => r.status === 'submitted').length} submitted •{' '}
          {searchedRows.filter((r) => r.status === 'draft').length} draft
        </p>
      )}
    </div>
  );
}
