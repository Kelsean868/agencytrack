// Persistency Manager v2 — S1: Reality Bar + At-Risk Book + Banded Roster.
// Entry-drawer restyle → S2. What-if playground + share → S3.
// Read/derive only — no writes or rules changes in this slice.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Printer, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import {
  getPersistencyForBranch,
  getPersistencyForUnit,
  getAvailableMonths,
} from '../../services/persistencyService';
import {
  aggregatePersistency,
  computeBarStats,
} from '../../lib/persistency/calculations';
import { persistencyModelFor, LABELS } from '../../lib/persistency/model';
import { getTenantUsers } from '../../services/managerService';
import { escapeCsvField } from '../../lib/csvExport';
import PersRealityBar from './PersRealityBar';
import PersAtRiskBook from './PersAtRiskBook';
import PersRoster from './PersRoster';
import CoachingNotesModal from './CoachingNotesModal';
import PersistencyEntryForm from './PersistencyEntryForm';
import PersistencyPlayground from '../persistency/PersistencyPlayground';

// BM starts at 'branch'; UM is fixed at 'unit'.
const ROLE_DEFAULT_SCOPE = {
  unit_manager:   'unit',
  branch_manager: 'branch',
  sales_manager:  'branch',
  tenant_admin:   'branch',
  platform_admin: 'branch',
};

// SEC-15: escapeCsvField (src/lib/csvExport.js) neutralizes formula-
// injection trigger characters before RFC4180 quote-escaping.
function buildCSV(rows) {
  return rows.map((r) => r.map(escapeCsvField).join(',')).join('\n');
}

export default function PersistencyTab() {
  const { user, userProfile, role, tenantId } = useAuth();
  const toast = useToast();

  // Scope: BM can toggle unit↔branch; other roles are fixed.
  const defaultScope = ROLE_DEFAULT_SCOPE[role] ?? 'branch';
  const [scope, setScope] = useState(defaultScope);
  const showScopeToggle = role === 'branch_manager';

  const scopeId = useMemo(() => {
    if (scope === 'unit')   return userProfile?.unitId   ?? null;
    if (scope === 'branch') return userProfile?.branchId ?? null;
    return userProfile?.tenantId ?? null;
  }, [scope, userProfile]);

  const scopeLabel = scope === 'unit' ? 'Unit'
    : scope === 'branch' ? 'Branch' : 'Tenant';

  const [monthKeys, setMonthKeys]   = useState([]);
  const [monthKey, setMonthKey]     = useState(null);
  const [records, setRecords]       = useState([]);
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [sparkData, setSparkData]   = useState([]);

  // Modal states
  const [coachingAgent, setCoachingAgent]         = useState(null); // { agentId, agentName, agentUnitId }
  const [editingAgentUid, setEditingAgentUid]     = useState(null);
  const [playgroundAgentUid, setPlaygroundAgentUid] = useState(null);

  // Load available months. Extracted to a stable callback so the error
  // card's Retry button (§1(b) four-states holdouts) can re-invoke it
  // alongside loadRecords below — either load can be the one that failed.
  const loadMonths = useCallback(async () => {
    if (!scopeId) return;
    try {
      setError('');
      const months = await getAvailableMonths(tenantId, scope, scopeId);
      setMonthKeys(months);
      setMonthKey((prev) => prev ?? months[0] ?? null);
    } catch (e) {
      setError(e.message ?? 'Failed to load months.');
    }
  }, [scope, scopeId, tenantId]);

  useEffect(() => { loadMonths(); }, [loadMonths]);

  // Load roster + records for selected month.
  const loadRecords = useCallback(async () => {
    if (!monthKey || !scopeId) return;
    setLoading(true);
    setError('');
    try {
      const [allUsers, recs] = await Promise.all([
        getTenantUsers(tenantId),
        scope === 'unit'
          ? getPersistencyForUnit(tenantId, monthKey, scopeId)
          : getPersistencyForBranch(tenantId, monthKey, scopeId),
      ]);
      const filtered = scope === 'unit'
        ? allUsers.filter((u) => u.unitId === scopeId && u.role === 'agent')
        : allUsers.filter((u) => u.branchId === scopeId && u.role === 'agent');
      setUsers(filtered);
      setRecords(recs);
    } catch (e) {
      setError(e.message ?? 'Failed to load persistency.');
    } finally {
      setLoading(false);
    }
  }, [monthKey, scopeId, scope, tenantId]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  // Retry affordance for the error card below — re-invokes both loaders
  // since either one may have been the source of the failure.
  const handleRetry = useCallback(() => {
    loadMonths();
    loadRecords();
  }, [loadMonths, loadRecords]);

  // Load sparkline data: last 6 available months' branch/unit aggregate.
  useEffect(() => {
    if (!scopeId || monthKeys.length === 0) return;
    let aborted = false;
    const window = monthKeys.slice(0, 6).reverse(); // oldest-first
    (async () => {
      const results = await Promise.all(
        window.map(async (mk) => {
          try {
            const recs = scope === 'unit'
              ? await getPersistencyForUnit(tenantId, mk, scopeId)
              : await getPersistencyForBranch(tenantId, mk, scopeId);
            const agg = aggregatePersistency(recs);
            return {
              monthKey: mk,
              aggregatedPersistency: recs.length > 0 ? agg.aggregatedPersistency : null,
            };
          } catch {
            return { monthKey: mk, aggregatedPersistency: null };
          }
        }),
      );
      if (!aborted) setSparkData(results);
    })();
    return () => { aborted = true; };
  }, [monthKeys, scopeId, scope, tenantId]);

  // Derived data.
  const aggregate = useMemo(() => aggregatePersistency(records), [records]);
  const barStats  = useMemo(() => computeBarStats(records), [records]);

  const recordByAgent = useMemo(() => {
    const m = {};
    records.forEach((r) => { m[r.agentId] = r; });
    return m;
  }, [records]);

  // Roster rows sorted by persistency desc, missing records last.
  const sortedRows = useMemo(() => {
    const rows = users.map((u) => ({ user: u, record: recordByAgent[u.id] ?? null }));
    rows.sort((a, b) => {
      const pa = a.record?.persistency ?? -1;
      const pb = b.record?.persistency ?? -1;
      return pb - pa;
    });
    return rows;
  }, [users, recordByAgent]);

  // At-risk book: resolved agents below floor, sorted worst-first.
  const atRiskRows = useMemo(
    () => sortedRows
      .filter(({ record: r }) => r && Number.isFinite(r.persistency) && r.persistency < 0.80)
      .sort((a, b) => (a.record?.persistency ?? 1) - (b.record?.persistency ?? 1)),
    [sortedRows],
  );

  const editingRecord = editingAgentUid ? recordByAgent[editingAgentUid] : null;
  const editingUser   = editingAgentUid ? users.find((u) => u.id === editingAgentUid) : null;
  const playgroundRec  = playgroundAgentUid ? recordByAgent[playgroundAgentUid] : null;
  const playgroundUser = playgroundAgentUid ? users.find((u) => u.id === playgroundAgentUid) : null;

  const handleCoach = useCallback(({ user: u }) => {
    setCoachingAgent({ agentId: u.id, agentName: u.name ?? u.email ?? u.id, agentUnitId: u.unitId });
  }, []);

  const handleDownloadCSV = () => {
    // Header uses the memo's vocabulary for the derived denominator ("Net Gross
    // Settled") — month-aware when a month is selected (matches the labels the
    // entry form and awards surfaces use for that month), falling back to the
    // current-model words when no month is selected yet.
    const grossHeaderLabel = monthKey
      ? persistencyModelFor(monthKey).labels.grossSettled
      : LABELS.grossSettled;
    const header = [
      'Agent', 'Persistency %', `${grossHeaderLabel} (TTD)`, 'Net Settled (TTD)',
      'Lapses (TTD)', 'Reinstatements (TTD)', 'Source', 'Last Edited',
    ];
    const body = sortedRows.map(({ user: u, record: r }) => [
      u.name ?? u.email ?? u.id,
      r ? (r.persistency * 100).toFixed(1) : '',
      r ? Math.round(r.grossSettled) : '',
      r ? Math.round(r.netSettled) : '',
      r ? Math.round(r.lapses) : '',
      r ? Math.round(r.reinstatements) : '',
      r?.enteredByRole ?? '',
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

  if (!scopeId) {
    return (
      <div className="card flex items-center gap-3 text-sm text-ink-muted">
        <AlertCircle size={16} />
        Contact your branch manager to be assigned to a unit so you can view persistency data.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="persistency-tab">
      {/* Reality bar */}
      <PersRealityBar
        monthKey={monthKey}
        monthKeys={monthKeys}
        onMonthChange={setMonthKey}
        scope={scope}
        showScopeToggle={showScopeToggle}
        onScopeChange={setScope}
        scopeLabel={scopeLabel}
        aggregate={aggregate}
        barStats={barStats}
        totalAgents={users.length}
        sparkData={sparkData}
        loading={loading}
      />

      {error && (
        <div role="alert" className="card flex items-center gap-2 text-sm text-danger-ink">
          <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="min-h-[44px] px-3 rounded-lg border border-border bg-card text-ink text-xs font-semibold hover:bg-surface transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Export toolbar (compact) */}
      {!loading && records.length > 0 && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleDownloadCSV}
            className="h-9 px-3 rounded-lg border border-border text-xs font-medium text-ink flex items-center gap-1.5 hover:bg-card-raised transition-colors"
            data-testid="pers-csv-btn"
          >
            <Download size={12} /> CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-lg border border-border text-xs font-medium text-ink flex items-center gap-1.5 hover:bg-card-raised transition-colors"
            data-testid="pers-print-btn"
          >
            <Printer size={12} /> Print
          </button>
        </div>
      )}

      {/* At-risk book (celebration arm when empty; hidden during load) */}
      {!loading && (
        <PersAtRiskBook
          rows={atRiskRows}
          onCoach={handleCoach}
        />
      )}

      {/* Banded roster */}
      {!loading && (
        <PersRoster
          rows={sortedRows}
          onEdit={setEditingAgentUid}
          onOpenPlayground={setPlaygroundAgentUid}
        />
      )}

      {/* Roster skeleton */}
      {loading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-border/40 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Coaching modal */}
      {coachingAgent && (
        <CoachingNotesModal
          agentId={coachingAgent.agentId}
          agentName={coachingAgent.agentName}
          agentUnitId={coachingAgent.agentUnitId}
          onClose={() => setCoachingAgent(null)}
        />
      )}

      {/* Entry form modal (S2 will restyle this) */}
      {editingAgentUid && (
        <PersistencyEntryForm
          tenantId={tenantId}
          monthKey={monthKey}
          agentUid={editingAgentUid}
          agentName={editingUser?.name ?? editingUser?.email ?? editingAgentUid}
          existingRecord={editingRecord}
          writerRole={role}
          writerUid={user?.uid}
          onClose={() => setEditingAgentUid(null)}
          onSaved={() => {
            const savedName = editingUser?.name ?? editingUser?.email ?? 'agent';
            setEditingAgentUid(null);
            toast.show({ variant: 'success', message: `Persistency saved for ${savedName}` });
            loadRecords();
          }}
        />
      )}

      {/* Playground modal (S3 will enhance; visible from roster only) */}
      {playgroundAgentUid && (
        <PersistencyPlayground
          mode="coaching"
          agentName={playgroundUser?.name ?? playgroundUser?.email ?? playgroundAgentUid}
          currentRecord={playgroundRec}
          onClose={() => setPlaygroundAgentUid(null)}
        />
      )}
    </div>
  );
}
