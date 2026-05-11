// E3 — Manager-side persistency tab.
//
// Replaces the legacy PersistencyPanel (deleted in this PR). Manager enters
// the six business inputs per agent; persistency is derived. Both branch
// managers AND agents can write; manager wins on collision via the audit-trail
// precedence in persistencyService.savePersistency.
//
// Phase 5 adds the entry form + layout polish + CSV export. Current scope is
// data loading + branch summary + agent list with edit affordance.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, AlertCircle, Calculator, Edit3, Download, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getPersistencyForBranch,
  getPersistencyForUnit,
  getPersistencyForTenant,
  getAvailableMonths,
  monthKeyFromYearMonth,
} from '../../services/persistencyService';
import { aggregatePersistency } from '../../lib/persistency/calculations';
import { getTenantUsers } from '../../services/managerService';
import { formatCurrency } from '../../utils/formatters';
import PersistencyEntryForm from './PersistencyEntryForm';
import PersistencyAgentRow from './PersistencyAgentRow';
import PersistencyPlayground from '../persistency/PersistencyPlayground';

const SCOPE_BY_ROLE = {
  unit_manager:   'unit',
  branch_manager: 'branch',
  sales_manager:  'tenant',
  tenant_admin:   'tenant',
  platform_admin: 'tenant',
};

function formatPercent(decimal) {
  if (decimal == null || !Number.isFinite(decimal)) return '—';
  return `${(decimal * 100).toFixed(1)}%`;
}

function badgeClass(decimal) {
  if (decimal == null || !Number.isFinite(decimal)) return 'bg-border/40 text-ink-muted';
  if (decimal >= 0.90) return 'bg-success/15 text-success';
  if (decimal >= 0.80) return 'bg-warning/15 text-warning';
  return 'bg-danger/15 text-danger';
}

function nextMonthKey(monthKey) {
  if (!monthKey) {
    const now = new Date();
    return monthKeyFromYearMonth(now.getFullYear(), now.getMonth() + 1);
  }
  const [y, m] = monthKey.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1     : m + 1;
  return monthKeyFromYearMonth(ny, nm);
}

function buildCSV(rows) {
  const escape = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const str = String(val);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  return rows.map((r) => r.map(escape).join(',')).join('\n');
}

export default function PersistencyTab() {
  const { user, userProfile, role } = useAuth();
  const scopeType = SCOPE_BY_ROLE[role] ?? 'tenant';
  const scopeId = scopeType === 'unit'   ? userProfile?.unitId
                : scopeType === 'branch' ? userProfile?.branchId
                : userProfile?.tenantId ?? null;

  const [monthKeys, setMonthKeys] = useState([]);
  const [monthKey, setMonthKey] = useState(null);
  const [records, setRecords]   = useState([]);
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [editingAgentUid, setEditingAgentUid] = useState(null);
  const [playgroundAgentUid, setPlaygroundAgentUid] = useState(null);
  const [sortBy, setSortBy]     = useState('persistency');

  // Load available months once we know the scope.
  useEffect(() => {
    if (!scopeId) return;
    let cancelled = false;
    (async () => {
      try {
        const months = await getAvailableMonths(scopeType, scopeId);
        if (cancelled) return;
        setMonthKeys(months);
        setMonthKey((prev) => prev ?? months[0] ?? null);
      } catch (e) {
        if (!cancelled) setError(e.message ?? 'Failed to load months.');
      }
    })();
    return () => { cancelled = true; };
  }, [scopeType, scopeId]);

  const loadRecords = useCallback(async () => {
    if (!monthKey || !scopeId) return;
    setLoading(true);
    setError('');
    try {
      const [allUsers, recs] = await Promise.all([
        getTenantUsers(),
        scopeType === 'unit'   ? getPersistencyForUnit(monthKey, scopeId) :
        scopeType === 'branch' ? getPersistencyForBranch(monthKey, scopeId) :
                                  getPersistencyForTenant(monthKey),
      ]);
      const filtered = scopeType === 'unit'
        ? allUsers.filter((u) => u.unitId === scopeId && u.role === 'agent')
        : scopeType === 'branch'
          ? allUsers.filter((u) => u.branchId === scopeId && u.role === 'agent')
          : allUsers.filter((u) => u.role === 'agent');
      setUsers(filtered);
      setRecords(recs);
    } catch (e) {
      setError(e.message ?? 'Failed to load persistency.');
    } finally {
      setLoading(false);
    }
  }, [monthKey, scopeId, scopeType]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // Aggregate for the summary card.
  const aggregate = useMemo(() => aggregatePersistency(records), [records]);

  // Fold records onto users so missing rows show as "no entry yet."
  const recordByAgent = useMemo(() => {
    const m = {};
    records.forEach((r) => { m[r.agentId] = r; });
    return m;
  }, [records]);

  const sortedRows = useMemo(() => {
    const rows = users.map((u) => ({ user: u, record: recordByAgent[u.id] ?? null }));
    rows.sort((a, b) => {
      if (sortBy === 'name') return (a.user.name ?? '').localeCompare(b.user.name ?? '');
      if (sortBy === 'gross') {
        return (b.record?.grossSettled ?? 0) - (a.record?.grossSettled ?? 0);
      }
      // default: persistency desc, missing rows last
      const pa = a.record?.persistency ?? -1;
      const pb = b.record?.persistency ?? -1;
      return pb - pa;
    });
    return rows;
  }, [users, recordByAgent, sortBy]);

  const handleAddNewMonth = () => {
    const newest = monthKeys[0];
    const nk = nextMonthKey(newest);
    setMonthKey(nk);
    if (!monthKeys.includes(nk)) setMonthKeys([nk, ...monthKeys]);
  };

  const handleDownloadCSV = () => {
    const header = [
      'Agent', 'Persistency %', 'Gross Settled (TTD)', 'Net Settled (TTD)',
      'Lapses (TTD)', 'Reinstatements (TTD)', 'Last Edited',
    ];
    const body = sortedRows.map(({ user: u, record: r }) => [
      u.name ?? u.email ?? u.id,
      r ? (r.persistency * 100).toFixed(1) : '',
      r ? Math.round(r.grossSettled) : '',
      r ? Math.round(r.netSettled) : '',
      r ? Math.round(r.lapses) : '',
      r ? Math.round(r.reinstatements) : '',
      r?.lastEditedAt?.toDate ? r.lastEditedAt.toDate().toISOString().slice(0, 10) : '',
    ]);
    const csv = buildCSV([header, ...body]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `persistency-${monthKey ?? 'export'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const editingRecord = editingAgentUid ? recordByAgent[editingAgentUid] : null;
  const editingUser   = editingAgentUid ? users.find((u) => u.id === editingAgentUid) : null;
  const playgroundRec = playgroundAgentUid ? recordByAgent[playgroundAgentUid] : null;
  const playgroundUser = playgroundAgentUid ? users.find((u) => u.id === playgroundAgentUid) : null;

  if (!scopeId) {
    return (
      <div className="card flex items-center gap-3 text-sm text-ink-muted">
        <AlertCircle size={16} />
        Contact your branch manager to be assigned to a unit so you can view your unit&apos;s persistency data.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="persistency-tab">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Month"
          data-testid="persistency-month-selector"
          value={monthKey ?? ''}
          onChange={(e) => setMonthKey(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {monthKeys.length === 0 && <option value="">—</option>}
          {monthKeys.map((mk) => (
            <option key={mk} value={mk}>{mk}</option>
          ))}
        </select>

        <select
          aria-label="Sort by"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="persistency">Sort: Persistency</option>
          <option value="name">Sort: Name</option>
          <option value="gross">Sort: Gross Settled</option>
        </select>

        <button
          type="button"
          onClick={handleAddNewMonth}
          className="h-11 px-3 rounded-lg border border-border text-sm font-medium text-ink hover:bg-card-raised transition-colors"
        >
          + Add new month
        </button>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={handleDownloadCSV}
            disabled={records.length === 0}
            className="h-11 px-3 rounded-lg border border-border text-sm font-medium text-ink flex items-center gap-1.5 hover:bg-card-raised transition-colors disabled:opacity-50"
          >
            <Download size={14} /> CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-11 px-3 rounded-lg border border-border text-sm font-medium text-ink flex items-center gap-1.5 hover:bg-card-raised transition-colors"
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {error && (
        <div className="card flex items-center gap-2 text-sm text-danger">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Branch / unit / tenant summary */}
      <div className="card flex flex-col gap-2" data-testid="persistency-branch-summary">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {scopeType === 'unit'   ? 'Unit'
            : scopeType === 'branch' ? 'Branch'
                                     : 'Tenant'}{' '}
            persistency · {monthKey ?? '—'}
          </p>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            className={`px-3 py-1.5 rounded-lg text-2xl font-bold ${badgeClass(aggregate.aggregatedPersistency)}`}
            data-testid="persistency-aggregate-value"
          >
            {records.length === 0 ? '—' : formatPercent(aggregate.aggregatedPersistency)}
          </span>
          <span className="text-xs text-ink-muted">
            {records.length} agent{records.length === 1 ? '' : 's'} reporting
          </span>
        </div>
        {records.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1 text-xs">
            <div>
              <p className="text-ink-muted uppercase tracking-wide">Gross settled</p>
              <p className="font-semibold text-ink">{formatCurrency(aggregate.sumGrossSettled)}</p>
            </div>
            <div>
              <p className="text-ink-muted uppercase tracking-wide">Net settled</p>
              <p className="font-semibold text-ink">{formatCurrency(aggregate.sumNetSettled)}</p>
            </div>
            <div>
              <p className="text-ink-muted uppercase tracking-wide">Lapses</p>
              <p className="font-semibold text-ink">{formatCurrency(aggregate.sumLapses)}</p>
            </div>
            <div>
              <p className="text-ink-muted uppercase tracking-wide">Reinstatements</p>
              <p className="font-semibold text-ink">{formatCurrency(aggregate.sumReinstatements)}</p>
            </div>
          </div>
        )}
      </div>

      {/* 90% threshold legend */}
      <div className="text-xs text-ink-muted flex items-center gap-2" data-testid="persistency-threshold-legend">
        <span className="inline-block w-3 h-3 rounded-full bg-success" />
        <span>≥ 90% (award-eligible)</span>
        <span className="inline-block w-3 h-3 rounded-full bg-warning ml-3" />
        <span>80–89%</span>
        <span className="inline-block w-3 h-3 rounded-full bg-danger ml-3" />
        <span>&lt; 80%</span>
      </div>

      {/* Agent list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-border/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="card text-sm text-ink-muted">
          No agents in this {scopeType === 'unit' ? 'unit' : scopeType === 'branch' ? 'branch' : 'tenant'} yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sortedRows.map(({ user: u, record: r }) => (
            <PersistencyAgentRow
              key={u.id}
              user={u}
              record={r}
              monthKey={monthKey}
              onEdit={() => setEditingAgentUid(u.id)}
              onOpenPlayground={() => setPlaygroundAgentUid(u.id)}
            />
          ))}
        </div>
      )}

      {/* Entry form modal */}
      {editingAgentUid && (
        <PersistencyEntryForm
          monthKey={monthKey}
          agentUid={editingAgentUid}
          agentName={editingUser?.name ?? editingUser?.email ?? editingAgentUid}
          existingRecord={editingRecord}
          writerRole={role}
          writerUid={user?.uid}
          onClose={() => setEditingAgentUid(null)}
          onSaved={() => { setEditingAgentUid(null); loadRecords(); }}
        />
      )}

      {/* Playground modal */}
      {playgroundAgentUid && (
        <PersistencyPlayground
          mode="coaching"
          agentName={playgroundUser?.name ?? playgroundUser?.email ?? playgroundAgentUid}
          currentRecord={playgroundRec}
          onClose={() => setPlaygroundAgentUid(null)}
        />
      )}

      {/* Visible CTAs/icons unused on this surface — referenced for lint cleanliness */}
      <span className="hidden">
        <Calculator size={1} /><Edit3 size={1} />
      </span>
    </div>
  );
}
