import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import StatusPill from '../ui/StatusPill';
import { Download, Search, MessageSquare, CalendarCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getWeeklySubmissions, getTenantUsers } from '../../services/managerService';
import { getLastNSundays } from '../../utils/dateHelpers';
import { formatCurrency, formatDateFriendly } from '../../utils/formatters';
import { extractFields, computeRatios, extractTotalProductionCredit } from '../../utils/extractFields';
import SubmissionViewer from '../submissions/SubmissionViewer';
import CoachingNotesModal from './CoachingNotesModal';

// Column definitions — drives both header and cell rendering
const COLS = [
  { key: 'name',                label: 'Agent',              sticky: true,  left: 'left-0',       minW: 'min-w-[160px]' },
  { key: 'status',              label: 'Status',             sticky: true,  left: 'left-[160px]', minW: 'min-w-[90px]'  },
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

// §5 dense-table contract: identity/status/badge columns stay left-aligned
// text; every other column (counts, currency, ratios, days worked) is a
// numeral and renders right-aligned + tabular-nums (inherited from the td
// onto its child spans — font-variant-numeric is an inherited property).
function isNumericCol(col) {
  if (col.key === 'name' || col.key === 'status') return false;
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

function SkeletonRow() {
  return (
    <tr>
      {COLS.map((c) => (
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
  const [userNameMap, setUserNameMap]       = useState({});
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [search, setSearch]                 = useState('');
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

  const rows = useMemo(() => {
    return submissions
      .map((sub) => {
        const f = extractFields(sub);
        const ratios = computeRatios(f);
        const personsReached = f.telContacts + f.f2fContacts;
        return {
          id:                   sub.agentId ?? sub.userId ?? sub.id,
          _submission:          sub,
          name:                 resolveName(sub, userNameMap),
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
      .filter(
        (r) =>
          search.trim() === '' ||
          r.name.toLowerCase().includes(search.trim().toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [submissions, userNameMap, search]);

  const exportCSV = () => {
    const headers = COLS.map((c) => c.label);
    const csvRows = [
      headers.join(','),
      ...rows.map((r) =>
        COLS.map((c) => {
          const v = r[c.key];
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
    if (col.key === 'name') {
      return (
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
      const state = v === true ? 'yes' : v === false ? 'no' : 'na';
      return (
        <span data-testid={`weekend-marker-${row.id}`} data-weekend={state}>
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
          disabled={loading || rows.length === 0}
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
          first 2 columns sticky. Scroll lives inside this card, never the page. */}
      <div className="overflow-x-auto overflow-y-auto max-h-[70vh] rounded-xl border border-border bg-card">
        <table className="text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={`
                    ${thBase} ${col.minW}
                    sticky top-0 bg-surface
                    ${col.sticky ? `${col.left} z-30` : 'z-20'}
                    ${isNumericCol(col) ? 'text-right' : 'text-left'}
                  `}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="px-3 py-12">
                  {/* Designed empty state (UX-001) — icon + headline + guidance,
                      replacing the bare centered caption. Distinct copy for the
                      search-filtered vs genuinely-empty week. */}
                  <div
                    className="flex flex-col items-center text-center gap-2"
                    data-testid="mastersheet-empty"
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-surface text-ink-muted">
                      {search.trim()
                        ? <Search size={22} aria-hidden="true" />
                        : <CalendarCheck size={22} aria-hidden="true" />}
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      {search.trim() ? 'No agents match your search' : 'No submissions yet this week'}
                    </p>
                    <p className="text-xs text-ink-muted max-w-xs">
                      {search.trim()
                        ? 'Try a different name, or clear the search to see the full roster.'
                        : 'Reports will appear here as your team submits them. Check back later or send a nudge from Compliance.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer"
                  onClick={() => setViewingSubmission(row._submission)}
                >
                  {COLS.map((col) => (
                    <td
                      key={col.key}
                      className={`
                        ${tdBase} ${col.minW}
                        ${isNumericCol(col) ? 'text-right tabular-nums' : 'text-left'}
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
          {rows.length} submission{rows.length !== 1 ? 's' : ''} •{' '}
          {rows.filter((r) => r.status === 'submitted').length} submitted •{' '}
          {rows.filter((r) => r.status === 'draft').length} draft
        </p>
      )}
    </div>
  );
}
