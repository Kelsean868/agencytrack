import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getPoliciesForManager, confirmPolicy } from '../../services/policiesService';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function buildYearOptions() {
  const current = new Date().getFullYear();
  const opts = [];
  for (let y = current; y >= current - 2; y--) opts.push(y);
  return opts;
}

export default function PolicyReconciliationPanel() {
  const { userProfile, role, tenantId } = useAuth();

  // Mirrors SettlementPanel's canAccess gate: BM / tenant_admin / platform_admin / canConfirmSettlements
  const canAccess =
    role === 'branch_manager' ||
    role === 'tenant_admin'   ||
    role === 'platform_admin' ||
    Boolean(userProfile?.canConfirmSettlements);

  const now = new Date();
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-based

  const [policies, setPolicies] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // Per-policy form state keyed by policyId
  const [formState, setFormState] = useState({});

  const loadPolicies = useCallback(async () => {
    if (!tenantId || !userProfile) return;
    setLoading(true);
    setError(null);
    try {
      const scope = { role, uid: userProfile.uid, branchId: userProfile.branchId };
      const all = await getPoliciesForManager(tenantId, scope);
      // Client-filter: settled, unconfirmed, dateIssued in selected year+month
      const filtered = all.filter((p) => {
        if (p.status !== 'settled') return false;
        if (p.confirmedAt) return false;
        if (!p.dateIssued) return false;
        const d = p.dateIssued.toDate ? p.dateIssued.toDate() : new Date(p.dateIssued);
        return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
      });
      setPolicies(filtered);
      // Initialise form state for policies that don't already have it
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
    } catch (err) {
      setError(err.message ?? 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [tenantId, role, userProfile, selectedYear, selectedMonth]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const handleConfirm = async (policy) => {
    const fs = formState[policy.id];
    if (!fs) return;

    const parsedAPI = parseFloat(fs.managerSettledAPI);
    if (!(parsedAPI > 0)) {
      // Surface inline — no window.alert to stay testable
      setError(`Manager Settled API for "${policy.ownerName ?? policy.id}" must be a positive number.`);
      return;
    }
    setError(null);

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
      await confirmPolicy(tenantId, managerProfile, policy.id, policy, fs.managerSettledAPI, fs.managerNote);

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

      // Reload after a short delay to let the batch land
      setTimeout(loadPolicies, 800);
    } catch (err) {
      setFormState((prev) => ({
        ...prev,
        [policy.id]: { ...prev[policy.id], submitting: false },
      }));
      setError(err.message ?? 'Confirmation failed');
    }
  };

  if (!canAccess) {
    return (
      <div className="bg-card rounded-xl p-8 text-center">
        <p className="text-sm text-text-muted">You do not have access to Policy Reconciliation.</p>
      </div>
    );
  }

  const years = buildYearOptions();

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-text mb-1">Policy Reconciliation</h2>
        <p className="text-sm text-text-muted mb-5">
          Confirm settled policies for a selected month. Manager confirms the settled API; discrepancies notify the agent.
        </p>

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

        {/* ── Status states ── */}
        {loading && (
          <p className="text-sm text-text-muted py-4">Loading…</p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
        )}
        {!loading && !error && policies.length === 0 && (
          <p className="text-sm text-text-muted py-4">
            No unconfirmed settled policies for {MONTHS[selectedMonth - 1]} {selectedYear}.
          </p>
        )}

        {/* ── Policy list ── */}
        {!loading && policies.length > 0 && (
          <div className="space-y-4">
            {policies.map((policy) => {
              const fs = formState[policy.id] ?? {
                managerSettledAPI: '', managerNote: '', submitting: false, done: false,
                confirmedByName: null, localDiscrepancy: false,
              };

              return (
                <div key={policy.id} className="bg-surface rounded-xl border border-border p-5">
                  {/* Policy header */}
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
                    <div>
                      <p className="font-semibold text-text text-sm">
                        {policy.ownerName ?? policy.insuredName ?? policy.policyNumber ?? policy.id}
                      </p>
                      {policy.insuredName && policy.ownerName !== policy.insuredName && (
                        <p className="text-xs text-text-muted">Insured: {policy.insuredName}</p>
                      )}
                      <p className="text-xs text-text-muted mt-1">
                        Agent settled API:{' '}
                        <span className="font-semibold text-text">
                          {policy.settledAPI != null ? `$${Number(policy.settledAPI).toFixed(2)}` : '—'}
                        </span>
                      </p>
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

                  {/* Confirm form — hidden once done */}
                  {!fs.done && (
                    <div className="space-y-3">
                      <div>
                        <label
                          htmlFor={`api-${policy.id}`}
                          className="block text-xs font-medium text-text-muted mb-1"
                        >
                          Manager Settled API (TTD)
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
                          placeholder="0.00"
                          disabled={fs.submitting}
                          className="w-full h-11 rounded-lg border border-border bg-card text-text text-sm px-3 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
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
                        disabled={fs.submitting || !fs.managerSettledAPI}
                        className="h-11 px-6 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                      >
                        {fs.submitting ? 'Confirming…' : 'Confirm'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
