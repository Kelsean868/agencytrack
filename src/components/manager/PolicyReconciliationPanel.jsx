import React, { useState, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { getPoliciesForManager, confirmPolicy, lapsePolicy } from '../../services/policiesService';
import { getTenantUsers } from '../../services/managerService';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildYearOptions() {
  const current = new Date().getFullYear();
  const opts = [];
  for (let y = current; y >= current - 2; y--) opts.push(y);
  return opts;
}

/** Group an array by a key function, preserving insertion order. */
function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

/** Format TTD currency value */
function fmtAPI(val) {
  if (val == null) return '—';
  return `$${Number(val).toFixed(2)}`;
}

/** Format a Firestore Timestamp or Date-like value as a readable date string */
function fmtDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function PolicyReconciliationPanel() {
  const { userProfile, role, tenantId } = useAuth();

  // Mirrors SettlementPanel's canAccess gate: BM / tenant_admin / platform_admin / canConfirmSettlements
  const canAccess =
    role === 'branch_manager' ||
    role === 'tenant_admin'   ||
    role === 'platform_admin' ||
    Boolean(userProfile?.canConfirmSettlements);

  // Lapse is BM+ only (not canConfirmSettlements-only)
  const canLapse =
    role === 'branch_manager' ||
    role === 'tenant_admin'   ||
    role === 'platform_admin';

  const now = new Date();
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-based
  const [activeTab,     setActiveTab]     = useState('confirm'); // 'confirm' | 'lapse'

  const [allPoliciesRaw, setAllPoliciesRaw] = useState([]); // unfiltered for both tabs
  const [agentMap,       setAgentMap]       = useState({}); // uid → name
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

  // Per-policy confirm form state keyed by policyId
  const [formState, setFormState] = useState({});

  // Bulk-confirm selection (Set of policyIds)
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkConfirming, setBulkConfirming] = useState(false);

  // Per-policy lapse form state: { dateLapsed: string (YYYY-MM-DD), lapseReason: string, expanded: bool, submitting: bool, done: bool }
  const [lapseState, setLapseState] = useState({});

  const loadData = useCallback(async () => {
    if (!tenantId || !userProfile) return;
    setLoading(true);
    setError(null);
    try {
      const scope = { role, uid: userProfile.uid, branchId: userProfile.branchId };
      const [allPolicies, users] = await Promise.all([
        getPoliciesForManager(tenantId, scope),
        getTenantUsers(tenantId),
      ]);

      // Build agentId → name lookup
      const map = {};
      for (const u of users) map[u.id] = u.name ?? u.email ?? u.id;
      setAgentMap(map);

      // Store raw data for both tabs to filter from
      setAllPoliciesRaw(allPolicies);

      // Client-filter for Confirm tab: settled, unconfirmed, dateIssued in selected year+month
      const filtered = allPolicies.filter((p) => {
        if (p.status !== 'settled') return false;
        if (p.confirmedAt) return false;
        if (!p.dateIssued) return false;
        const d = p.dateIssued.toDate ? p.dateIssued.toDate() : new Date(p.dateIssued);
        return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
      });

      // Initialise form state for confirm-tab policies that don't already have it
      setFormState((prev) => {
        const next = { ...prev };
        filtered.forEach((p) => {
          if (!next[p.id]) {
            next[p.id] = {
              managerSettledAPI: '',
              managerNote:       '',
              submitting:        false,
              done:              false,
              confirmedByName:   null,
              localDiscrepancy:  false,
            };
          }
        });
        return next;
      });

      // Clear selection when data changes
      setSelectedIds(new Set());
    } catch (err) {
      setError(err.message ?? 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [tenantId, role, userProfile, selectedYear, selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Confirm a single policy. resolvedAPIStr overrides the form value (used by bulk-confirm). */
  const confirmOne = async (policy, resolvedAPIStr) => {
    const parsedAPI = parseFloat(resolvedAPIStr);
    if (!(parsedAPI > 0)) return { error: `Manager Settled API for "${policy.ownerName ?? policy.id}" must be a positive number.` };

    setFormState((prev) => ({
      ...prev,
      [policy.id]: { ...prev[policy.id], submitting: true },
    }));

    try {
      const managerProfile = {
        uid:  userProfile.uid,
        name: userProfile.name ?? userProfile.email ?? 'Manager',
        role,
      };
      const noteStr = formState[policy.id]?.managerNote ?? '';
      await confirmPolicy(tenantId, managerProfile, policy.id, policy, resolvedAPIStr, noteStr);

      setFormState((prev) => ({
        ...prev,
        [policy.id]: {
          ...prev[policy.id],
          submitting:       false,
          done:             true,
          confirmedByName:  managerProfile.name,
          localDiscrepancy: parsedAPI !== policy.settledAPI,
        },
      }));
      return { error: null };
    } catch (err) {
      setFormState((prev) => ({
        ...prev,
        [policy.id]: { ...prev[policy.id], submitting: false },
      }));
      return { error: err.message ?? 'Confirmation failed' };
    }
  };

  const handleConfirm = async (policy) => {
    const fs = formState[policy.id];
    if (!fs) return;
    const result = await confirmOne(policy, fs.managerSettledAPI);
    if (result.error) setError(result.error);
    else {
      setError(null);
      setTimeout(loadData, 800);
    }
  };

  const handleBulkConfirm = async () => {
    const toConfirm = [...selectedIds]
      .map((id) => policies.find((p) => p.id === id))
      .filter((p) => p && !formState[p.id]?.done);

    if (toConfirm.length === 0) return;
    setError(null);
    setBulkConfirming(true);

    const errors = [];
    for (const policy of toConfirm) {
      const fs = formState[policy.id];
      // Blank input → default to agent's settledAPI (silent confirmation)
      const resolvedAPI = fs?.managerSettledAPI?.trim()
        ? fs.managerSettledAPI
        : String(policy.settledAPI ?? '');
      const result = await confirmOne(policy, resolvedAPI);
      if (result.error) errors.push(result.error);
    }

    setBulkConfirming(false);
    if (errors.length > 0) setError(errors[0]);
    setTimeout(loadData, 800);
  };

  /** Handle BM lapsing a settled policy */
  const handleLapse = async (policy) => {
    const ls = lapseState[policy.id];
    if (!ls?.dateLapsed) {
      setError('Date lapsed is required.');
      return;
    }
    setError(null);
    setLapseState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], submitting: true } }));
    try {
      const managerProfile = {
        uid:  userProfile.uid,
        name: userProfile.name ?? userProfile.email ?? 'Manager',
        role,
      };
      const dateLapsedTs = Timestamp.fromDate(new Date(ls.dateLapsed));
      const fields = { dateLapsed: dateLapsedTs, lapseReason: ls.lapseReason?.trim() || '' };
      await lapsePolicy(tenantId, managerProfile, policy.id, policy, fields);
      setLapseState((prev) => ({
        ...prev,
        [policy.id]: { ...prev[policy.id], submitting: false, done: true, expanded: false },
      }));
      setTimeout(loadData, 800);
    } catch (err) {
      setLapseState((prev) => ({ ...prev, [policy.id]: { ...prev[policy.id], submitting: false } }));
      setError(err.message ?? 'Lapse failed');
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };


  if (!canAccess) {
    return (
      <div className="bg-card rounded-xl p-8 text-center">
        <p className="text-sm text-text-muted">You do not have access to Policy Reconciliation.</p>
      </div>
    );
  }

  const years = buildYearOptions();

  // Confirm tab: settled, unconfirmed, dateIssued in selected period
  const policies = allPoliciesRaw.filter((p) => {
    if (p.status !== 'settled') return false;
    if (p.confirmedAt) return false;
    if (!p.dateIssued) return false;
    const d = p.dateIssued.toDate ? p.dateIssued.toDate() : new Date(p.dateIssued);
    return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
  });

  // Lapse tab: settled (any confirmation state) + already-lapsed, by dateIssued period
  const lapseTabPolicies = allPoliciesRaw.filter((p) => {
    if (p.status !== 'settled' && p.status !== 'lapsed') return false;
    if (!p.dateIssued) return false;
    const d = p.dateIssued.toDate ? p.dateIssued.toDate() : new Date(p.dateIssued);
    return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
  });

  const grouped = groupBy(policies, (p) => p.agentId);
  const lapseGrouped = groupBy(lapseTabPolicies, (p) => p.agentId);
  const pendingSelectedCount = [...selectedIds].filter((id) => !formState[id]?.done).length;
  const unconfirmedPolicies = policies.filter((p) => !formState[p.id]?.done);
  const allSelected = unconfirmedPolicies.length > 0 && unconfirmedPolicies.every((p) => selectedIds.has(p.id));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unconfirmedPolicies.map((p) => p.id)));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-text mb-1">Policy Reconciliation</h2>
        <p className="text-sm text-text-muted mb-3">
          Confirm settled policies for a selected month. Policies are grouped by agent.
          Leave "Manager API" blank to silently agree with the agent's value.
        </p>

        {/* ── Tab selector ── */}
        <div className="flex gap-1 mb-5 border-b border-border" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'confirm'}
            onClick={() => setActiveTab('confirm')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeTab === 'confirm'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
            data-testid="tab-confirm"
          >
            Confirm
          </button>
          {canLapse && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'lapse'}
              onClick={() => setActiveTab('lapse')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                activeTab === 'lapse'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
              data-testid="tab-lapse"
            >
              Lapse
            </button>
          )}
        </div>

        {/* ── Month selector ── */}
        <div className="flex flex-wrap gap-3 mb-6">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            aria-label="Year"
            className="h-11 rounded-lg border border-border bg-surface text-text text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            aria-label="Month"
            className="h-11 rounded-lg border border-border bg-surface text-text text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>

        {/* ── Status states (shared) ── */}
        {loading && (
          <p className="text-sm text-text-muted py-4" data-testid="reconcil-loading">Loading…</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-4" data-testid="reconcil-error">{error}</p>
        )}
        {!loading && !error && activeTab === 'confirm' && policies.length === 0 && (
          <p className="text-sm text-text-muted py-4" data-testid="reconcil-empty">
            No unconfirmed settled policies for {MONTHS[selectedMonth - 1]} {selectedYear}.
          </p>
        )}
        {!loading && !error && activeTab === 'lapse' && lapseTabPolicies.length === 0 && (
          <p className="text-sm text-text-muted py-4" data-testid="lapse-empty">
            No settled policies for {MONTHS[selectedMonth - 1]} {selectedYear}.
          </p>
        )}

        {/* ── Confirm tab content ── */}
        {/* ── Bulk-confirm toolbar ── */}
        {activeTab === 'confirm' && !loading && policies.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-text-muted">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={handleSelectAll}
                aria-label="Select all unconfirmed policies"
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                data-testid="select-all-checkbox"
              />
              Select all
            </label>
            {pendingSelectedCount > 0 && (
              <button
                type="button"
                onClick={handleBulkConfirm}
                disabled={bulkConfirming}
                className="h-9 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                data-testid="bulk-confirm-btn"
              >
                {bulkConfirming
                  ? 'Confirming…'
                  : `Confirm Selected (${pendingSelectedCount})`}
              </button>
            )}
          </div>
        )}

        {/* ── Grouped policy list (Confirm tab) ── */}
        {activeTab === 'confirm' && !loading && policies.length > 0 && (
          <div className="space-y-8" data-testid="policy-groups">
            {[...grouped.entries()].map(([agentId, agentPolicies]) => (
              <div key={agentId} data-testid={`agent-group-${agentId}`}>
                {/* Agent section header */}
                <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
                  {agentMap[agentId] ?? agentId}
                </h3>

                <div className="space-y-4">
                  {agentPolicies.map((policy) => {
                    const fs = formState[policy.id] ?? {
                      managerSettledAPI: '', managerNote: '', submitting: false, done: false,
                      confirmedByName: null, localDiscrepancy: false,
                    };
                    const isSelected = selectedIds.has(policy.id);

                    return (
                      <div
                        key={policy.id}
                        className="bg-surface rounded-xl border border-border p-5"
                        data-testid={`policy-card-${policy.id}`}
                      >
                        {/* Card header: checkbox + policy name + confirmed chip */}
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                          <div className="flex items-start gap-3">
                            {!fs.done && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(policy.id)}
                                aria-label={`Select policy for ${policy.ownerName ?? policy.id}`}
                                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                data-testid={`policy-checkbox-${policy.id}`}
                              />
                            )}
                            <div>
                              <p className="font-semibold text-text text-sm">
                                {policy.ownerName ?? policy.insuredName ?? policy.policyNumber ?? policy.id}
                              </p>
                              {policy.insuredName && policy.ownerName !== policy.insuredName && (
                                <p className="text-xs text-text-muted">Insured: {policy.insuredName}</p>
                              )}
                              {policy.productLine && (
                                <p className="text-xs text-text-muted capitalize">{policy.productLine}</p>
                              )}
                            </div>
                          </div>

                          {/* Post-confirm indicators */}
                          {fs.done && (
                            <div className="flex flex-wrap gap-2">
                              <span className="inline-flex items-center text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-1 rounded-full">
                                Confirmed by {fs.confirmedByName}
                              </span>
                              {fs.localDiscrepancy && (
                                <span className="inline-flex items-center text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-full">
                                  Discrepancy
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Side-by-side: agent data (left) vs manager input (right) */}
                        {!fs.done && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Left — agent's submitted values */}
                            <div className="bg-card rounded-lg p-4 border border-border/50">
                              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Agent's Entry</p>
                              <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-text-muted">Settled API</span>
                                  <span className="font-semibold text-text" data-testid={`agent-api-${policy.id}`}>
                                    {fmtAPI(policy.settledAPI)}
                                  </span>
                                </div>
                                {policy.policyNumber && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-text-muted">Policy #</span>
                                    <span className="text-text">{policy.policyNumber}</span>
                                  </div>
                                )}
                                {policy.initialPremium != null && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-text-muted">Premium</span>
                                    <span className="text-text">{fmtAPI(policy.initialPremium)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Right — manager input */}
                            <div className="space-y-3">
                              <div>
                                <label
                                  htmlFor={`api-${policy.id}`}
                                  className="block text-xs font-medium text-text-muted mb-1"
                                >
                                  Manager Settled API (TTD){' '}
                                  <span className="font-normal text-text-muted/70">— blank = agree with agent</span>
                                </label>
                                <input
                                  id={`api-${policy.id}`}
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  value={fs.managerSettledAPI}
                                  onChange={(e) =>
                                    setFormState((prev) => ({
                                      ...prev,
                                      [policy.id]: { ...prev[policy.id], managerSettledAPI: e.target.value },
                                    }))
                                  }
                                  placeholder={fmtAPI(policy.settledAPI)}
                                  disabled={fs.submitting}
                                  className="w-full h-11 rounded-lg border border-border bg-card text-text text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                                  data-testid={`manager-api-input-${policy.id}`}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor={`note-${policy.id}`}
                                  className="block text-xs font-medium text-text-muted mb-1"
                                >
                                  Manager Note <span className="font-normal">(optional)</span>
                                </label>
                                <textarea
                                  id={`note-${policy.id}`}
                                  value={fs.managerNote}
                                  onChange={(e) =>
                                    setFormState((prev) => ({
                                      ...prev,
                                      [policy.id]: { ...prev[policy.id], managerNote: e.target.value },
                                    }))
                                  }
                                  placeholder="Optional note…"
                                  disabled={fs.submitting}
                                  rows={2}
                                  className="w-full rounded-lg border border-border bg-card text-text text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary resize-none disabled:opacity-50"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleConfirm(policy)}
                                disabled={fs.submitting}
                                className="h-11 px-6 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                                data-testid={`confirm-btn-${policy.id}`}
                              >
                                {fs.submitting ? 'Confirming…' : 'Confirm'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Lapse tab content ── */}
        {activeTab === 'lapse' && !loading && lapseTabPolicies.length > 0 && (
          <div className="space-y-8" data-testid="lapse-policy-groups">
            {[...lapseGrouped.entries()].map(([agentId, agentPolicies]) => (
              <div key={agentId} data-testid={`lapse-agent-group-${agentId}`}>
                <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
                  {agentMap[agentId] ?? agentId}
                </h3>
                <div className="space-y-4">
                  {agentPolicies.map((policy) => {
                    const ls = lapseState[policy.id] ?? { dateLapsed: '', lapseReason: '', expanded: false, submitting: false, done: false };
                    const isAlreadyLapsed = policy.status === 'lapsed' || ls.done;

                    return (
                      <div
                        key={policy.id}
                        className="bg-surface rounded-xl border border-border p-5"
                        data-testid={`lapse-policy-card-${policy.id}`}
                      >
                        {/* Card header */}
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold text-text text-sm">
                              {policy.ownerName ?? policy.insuredName ?? policy.policyNumber ?? policy.id}
                            </p>
                            {policy.insuredName && policy.ownerName !== policy.insuredName && (
                              <p className="text-xs text-text-muted">Insured: {policy.insuredName}</p>
                            )}
                            {policy.productLine && (
                              <p className="text-xs text-text-muted capitalize">{policy.productLine}</p>
                            )}
                          </div>
                          {isAlreadyLapsed ? (
                            <span className="inline-flex items-center text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/40 px-3 py-1 rounded-full" data-testid={`lapsed-pill-${policy.id}`}>
                              Lapsed{policy.dateLapsed ? ` on ${fmtDate(policy.dateLapsed)}` : ls.done ? '' : ''}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setLapseState((prev) => ({
                                ...prev,
                                [policy.id]: { ...(prev[policy.id] ?? { dateLapsed: '', lapseReason: '', submitting: false, done: false }), expanded: !ls.expanded },
                              }))}
                              className="h-9 px-3 rounded-lg text-xs font-semibold text-danger border border-danger/30 hover:bg-danger/5 transition-colors min-w-[44px]"
                              data-testid={`mark-lapsed-btn-${policy.id}`}
                            >
                              {ls.expanded ? 'Cancel' : 'Mark as Lapsed'}
                            </button>
                          )}
                        </div>

                        {/* Lapse form — only when expanded and not yet lapsed */}
                        {!isAlreadyLapsed && ls.expanded && (
                          <div className="mt-3 space-y-3 pt-3 border-t border-border">
                            <div>
                              <label
                                htmlFor={`date-lapsed-${policy.id}`}
                                className="block text-xs font-medium text-text-muted mb-1"
                              >
                                Date Lapsed <span className="text-danger">*</span>
                              </label>
                              <input
                                id={`date-lapsed-${policy.id}`}
                                type="date"
                                value={ls.dateLapsed}
                                onChange={(e) => setLapseState((prev) => ({
                                  ...prev,
                                  [policy.id]: { ...prev[policy.id], dateLapsed: e.target.value },
                                }))}
                                disabled={ls.submitting}
                                className="w-full h-11 rounded-lg border border-border bg-card text-text text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                                data-testid={`date-lapsed-input-${policy.id}`}
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`lapse-reason-${policy.id}`}
                                className="block text-xs font-medium text-text-muted mb-1"
                              >
                                Lapse Reason <span className="font-normal">(optional)</span>
                              </label>
                              <input
                                id={`lapse-reason-${policy.id}`}
                                type="text"
                                value={ls.lapseReason}
                                onChange={(e) => setLapseState((prev) => ({
                                  ...prev,
                                  [policy.id]: { ...prev[policy.id], lapseReason: e.target.value },
                                }))}
                                placeholder="e.g. Non-payment of premium"
                                disabled={ls.submitting}
                                className="w-full h-11 rounded-lg border border-border bg-card text-text text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                                data-testid={`lapse-reason-input-${policy.id}`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleLapse(policy)}
                              disabled={ls.submitting || !ls.dateLapsed}
                              className="h-11 px-6 rounded-lg bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-50 min-w-[44px]"
                              data-testid={`confirm-lapse-btn-${policy.id}`}
                            >
                              {ls.submitting ? 'Lapsing…' : 'Confirm Lapse'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
