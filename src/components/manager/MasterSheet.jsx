import { useState, useEffect, useMemo } from 'react';
import { Download, Search } from 'lucide-react';
import { getWeeklySubmissions, getTenantUsers } from '../../services/managerService';
import { getLastNSundays } from '../../utils/dateHelpers';
import { formatCurrency } from '../../utils/formatters';

// Normalise any submission schema variant into a common KPI shape.
function extractFields(d) {
  // Nested schema — future format
  if (d.step1 !== undefined || d.step2 !== undefined) {
    return {
      dials: parseFloat(d.step1?.dials || 0),
      telContacts: parseFloat(d.step2?.telContacts || 0),
      f2fAttempts: parseFloat(d.step3?.f2fAttempts || 0),
      ffi:
        parseFloat(d.step3?.ffiConductedNew || 0) +
        parseFloat(d.step3?.ffiConductedOld || 0),
      ci:
        parseFloat(d.step4?.ciConductedNew || 0) +
        parseFloat(d.step4?.ciConductedOld || 0),
      apps:
        parseFloat(d.step4?.appsSoldNew || 0) +
        parseFloat(d.step4?.appsSoldOld || 0),
      api:
        parseFloat(d.step4?.apiNew || 0) +
        parseFloat(d.step4?.apiOld || 0),
      targetAPI: parseFloat(d.step9?.targetAPI || 0),
    };
  }

  // Flat schema — covers both current wizard (referralCalls) and legacy (dials)
  const callSum =
    (d.referralCalls || 0) +
    (d.followUpCalls || 0) +
    (d.coldCalls || 0) +
    (d.seminarTradeshowCalls || 0) +
    (d.serviceCalls || 0);

  return {
    dials: parseFloat(d.dials || d.totalDials || callSum || 0),
    telContacts: parseFloat(d.telContacts || d.telephoneContacts || d.qualifiedApproaches || 0),
    f2fAttempts: parseFloat(d.f2fAttempts || d.f2fContacts || 0),
    ffi: parseFloat(d.ffiConducted || d.ffisScheduled || 0),
    ci: parseFloat(d.ciConducted || d.closingInterviews || 0),
    apps: parseFloat(d.applicationsSold || d.appsSold || 0),
    api: parseFloat(d.apiSold || d.api || d.annualPremium || 0),
    targetAPI: parseFloat(d.targetAPI || 0),
  };
}

function resolveName(sub, userNameMap) {
  if (sub.agentName)  return sub.agentName;
  if (sub.displayName) return sub.displayName;
  if (sub.userName)   return sub.userName;
  const uid = sub.agentId ?? sub.userId ?? '';
  if (uid && userNameMap[uid]) return userNameMap[uid];
  return uid ? `Agent ${uid.slice(-6)}` : '—';
}

function statusBadge(status) {
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success">
        Submitted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/15 text-warning">
      Draft
    </span>
  );
}

function apiColorClass(api, targetAPI) {
  if (!targetAPI || targetAPI === 0) return 'text-ink';
  const pct = (api / targetAPI) * 100;
  if (pct >= 80) return 'text-success font-semibold';
  if (pct >= 50) return 'text-warning font-semibold';
  return 'text-danger font-semibold';
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border/40">
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-border/60 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function MasterSheet({ selectedWeek, setSelectedWeek }) {
  const [submissions, setSubmissions]   = useState([]);
  const [userNameMap, setUserNameMap]   = useState({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [search, setSearch]             = useState('');

  const sundays = getLastNSundays(8);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      getWeeklySubmissions(selectedWeek),
      getTenantUsers().catch(() => []), // best-effort; empty users won't block rows
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
  }, [selectedWeek]);

  const rows = useMemo(() => {
    return submissions
      .map((sub) => {
        const fields = extractFields(sub);
        const closingRatio =
          fields.ci > 0 ? Math.round((fields.apps / fields.ci) * 100) : null;

        return {
          id: sub.agentId ?? sub.userId ?? sub.id,
          name: resolveName(sub, userNameMap),
          status: sub.status ?? 'draft',
          ...fields,
          appsSold: fields.apps,
          closingRatio,
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
    const headers = [
      'Agent', 'Status', 'Dials', 'Tel Contacts', 'F2F Attempts',
      'FFI', 'CI', 'Apps Sold', 'API (TTD)', 'Closing Ratio %',
    ];
    const csvRows = [
      headers.join(','),
      ...rows.map((r) =>
        [
          `"${r.name}"`,
          r.status,
          r.dials,
          r.telContacts,
          r.f2fAttempts,
          r.ffi,
          r.ci,
          r.appsSold,
          r.api.toFixed(2),
          r.closingRatio ?? '—',
        ].join(',')
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

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {sundays.map((d, i) => (
            <option key={d} value={d}>
              {i === 0 ? `This week (${d})` : d}
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
            className="w-full h-10 pl-8 pr-3 rounded-lg border border-border bg-white text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <button
          onClick={exportCSV}
          disabled={loading || rows.length === 0}
          className="h-10 px-4 rounded-lg border border-border bg-white text-ink text-sm font-medium flex items-center gap-2 hover:bg-surface transition-colors disabled:opacity-50"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-border bg-surface">
              {[
                'Agent', 'Status', 'Dials', 'Tel Contacts', 'F2F',
                'FFI', 'CI', 'Apps', 'API (TTD)', 'Closing %',
              ].map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-ink-muted">
                  {search
                    ? 'No agents match your search.'
                    : 'No submissions for this week yet.'}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/40 hover:bg-surface/50 transition-colors"
                >
                  <td className="px-3 py-3 font-medium text-ink whitespace-nowrap">{r.name}</td>
                  <td className="px-3 py-3">{statusBadge(r.status)}</td>
                  <td className="px-3 py-3 text-ink">{r.dials}</td>
                  <td className="px-3 py-3 text-ink">{r.telContacts}</td>
                  <td className="px-3 py-3 text-ink">{r.f2fAttempts}</td>
                  <td className="px-3 py-3 text-ink">{r.ffi}</td>
                  <td className="px-3 py-3 text-ink">{r.ci}</td>
                  <td className="px-3 py-3 text-ink">{r.appsSold}</td>
                  <td className={`px-3 py-3 whitespace-nowrap ${apiColorClass(r.api, r.targetAPI)}`}>
                    {formatCurrency(r.api)}
                  </td>
                  <td className="px-3 py-3 text-ink">
                    {r.closingRatio === null ? '—' : `${r.closingRatio}%`}
                  </td>
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
