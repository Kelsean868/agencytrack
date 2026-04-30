import { useState, useEffect, useMemo } from 'react';
import { Download, Search } from 'lucide-react';
import { getWeeklySubmissions, getTenantUsers } from '../../services/managerService';
import { getLastNSundays } from '../../utils/dateHelpers';
import { formatCurrency } from '../../utils/formatters';
import { formatDateLabel } from '../../utils/validators';

function statusBadge(status) {
  if (status === 'submitted') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success">
        Submitted
      </span>
    );
  }
  if (status === 'draft') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/15 text-warning">
        Draft
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-danger/15 text-danger">
      Missing
    </span>
  );
}

function apiColorClass(apiSold, targetAPI) {
  if (!targetAPI || targetAPI === 0) return 'text-ink';
  const pct = (apiSold / targetAPI) * 100;
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
  const [submissions, setSubmissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const sundays = getLastNSundays(8);

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([getWeeklySubmissions(selectedWeek), getTenantUsers()])
      .then(([subs, userList]) => {
        setSubmissions(subs);
        setUsers(userList.filter((u) => u.role === 'agent'));
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load data. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [selectedWeek]);

  const rows = useMemo(() => {
    const subMap = {};
    submissions.forEach((s) => { subMap[s.agentId ?? s.userId] = s; });

    return users
      .map((u) => {
        const sub = subMap[u.id] ?? null;
        const totalCalls =
          (sub?.referralCalls ?? 0) +
          (sub?.followUpCalls ?? 0) +
          (sub?.coldCalls ?? 0) +
          (sub?.seminarTradeshowCalls ?? 0) +
          (sub?.serviceCalls ?? 0);
        const ffi = sub?.ffiConducted ?? 0;
        const ci = sub?.ciConducted ?? 0;
        const apps = sub?.applicationsSold ?? 0;
        const api = sub?.apiSold ?? 0;
        const target = sub?.targetAPI ?? 0;
        const closingRatio = ci > 0 ? Math.round((apps / ci) * 100) : null;

        return {
          id: u.id,
          name: u.name ?? u.email ?? u.id,
          status: sub?.status ?? 'missing',
          dials: totalCalls,
          telContacts: sub?.qualifiedApproaches ?? 0,
          f2fAttempts: sub?.f2fAttempts ?? 0,
          ffi,
          ci,
          appsSold: apps,
          api,
          targetAPI: target,
          closingRatio,
        };
      })
      .filter((r) =>
        search.trim() === '' ||
        r.name.toLowerCase().includes(search.trim().toLowerCase())
      );
  }, [users, submissions, search]);

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

      {/* Error */}
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
                  {search ? 'No agents match your search.' : 'No agents found for this week.'}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-surface/50 transition-colors">
                  <td className="px-3 py-3 font-medium text-ink whitespace-nowrap">{r.name}</td>
                  <td className="px-3 py-3">{statusBadge(r.status)}</td>
                  <td className="px-3 py-3 text-ink">{r.status === 'missing' ? '—' : r.dials}</td>
                  <td className="px-3 py-3 text-ink">{r.status === 'missing' ? '—' : r.telContacts}</td>
                  <td className="px-3 py-3 text-ink">{r.status === 'missing' ? '—' : r.f2fAttempts}</td>
                  <td className="px-3 py-3 text-ink">{r.status === 'missing' ? '—' : r.ffi}</td>
                  <td className="px-3 py-3 text-ink">{r.status === 'missing' ? '—' : r.ci}</td>
                  <td className="px-3 py-3 text-ink">{r.status === 'missing' ? '—' : r.appsSold}</td>
                  <td className={`px-3 py-3 whitespace-nowrap ${r.status === 'missing' ? 'text-ink-muted' : apiColorClass(r.api, r.targetAPI)}`}>
                    {r.status === 'missing' ? '—' : formatCurrency(r.api)}
                  </td>
                  <td className="px-3 py-3 text-ink">
                    {r.status === 'missing' || r.closingRatio === null ? '—' : `${r.closingRatio}%`}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && (
        <p className="text-xs text-ink-muted">
          {rows.length} agent{rows.length !== 1 ? 's' : ''} •{' '}
          {rows.filter((r) => r.status === 'submitted').length} submitted •{' '}
          {rows.filter((r) => r.status === 'missing').length} missing
        </p>
      )}
    </div>
  );
}
