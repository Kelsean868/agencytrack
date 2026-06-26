import { useState, useEffect, useCallback } from 'react';
import { Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import SaveButton from '../ui/SaveButton';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import { getTenantUsers } from '../../services/managerService';
import { confirmSettlement, getSettlementsForUnit, deleteSettlement } from '../../services/settlementService';
import { formatCurrency } from '../../utils/formatters';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

function periodLabel(periodKey) {
  if (!periodKey) return '—';
  const [year, rest] = periodKey.split('-');
  if (rest?.startsWith('Q')) return `Q${rest[1]} ${year}`;
  const mIdx = parseInt(rest, 10) - 1;
  return `${MONTHS[mIdx] ?? rest} ${year}`;
}

function formatTs(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-TT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PAGE_SIZE = 20;

export default function SettlementPanel() {
  const { user, userProfile, role, tenantId } = useAuth();
  const toast = useToast();

  const [agents, setAgents]               = useState([]);
  const [settlements, setSettlements]     = useState([]);
  const [loadingData, setLoadingData]     = useState(true);
  const [error, setError]                 = useState('');

  // Form state
  const [bulkMode, setBulkMode]           = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);
  const [selectedYear, setSelectedYear]   = useState(CURRENT_YEAR);
  const [settledAPI, setSettledAPI]       = useState('');
  const [settledApps, setSettledApps]     = useState('');
  const [persistency, setPersistency]     = useState('');
  const [notes, setNotes]                 = useState('');
  const [saving, setSaving]               = useState(false);
  // Inline validation errors (pre-submit). Post-submit success/failure fires toast.
  const [validationError, setValidationError] = useState('');

  // Bulk form: { [agentId]: { api, apps, persist, error } }
  const [bulkRows, setBulkRows]           = useState({});

  // Pagination
  const [visibleCount, setVisibleCount]   = useState(PAGE_SIZE);

  // Delete confirm
  const [deletingId, setDeletingId]       = useState(null);

  const canAccess = role === 'branch_manager' || role === 'tenant_admin' || role === 'platform_admin' || Boolean(userProfile?.canConfirmSettlements);
  const isReadOnly = role === 'unit_manager' && !userProfile?.canConfirmSettlements;

  const loadData = useCallback(() => {
    if (!tenantId) return;
    setLoadingData(true);
    setError('');
    getTenantUsers(tenantId)
      .then((userList) => {
        // Nullish guard (parity with the financing panels): a null/undefined
        // resolution must not throw on .filter — fall back to an empty list.
        const agentList = (userList ?? []).filter((u) => u.role === 'agent');
        setAgents(agentList);
        const agentIds = agentList.map((a) => a.id);
        return getSettlementsForUnit(tenantId, agentIds, CURRENT_YEAR);
      })
      .then((docs) => {
        setSettlements(docs.sort((a, b) => (b.periodKey ?? '').localeCompare(a.periodKey ?? '')));
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load data.');
      })
      .finally(() => setLoadingData(false));
  }, [tenantId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Initialise bulk rows when agents load
  useEffect(() => {
    const rows = {};
    agents.forEach((a) => {
      rows[a.id] = { api: '', apps: '', persist: '', error: '' };
    });
    setBulkRows(rows);
  }, [agents]);

  function agentName(agentId) {
    const a = agents.find((a) => a.id === agentId);
    return a?.name ?? a?.email ?? agentId;
  }

  function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  // Single save
  async function handleSave(e) {
    e.preventDefault();
    setValidationError('');
    if (!selectedAgent) { setValidationError('Select an agent.'); return; }
    const api = parseFloat(settledAPI);
    const apps = parseFloat(settledApps);
    const pers = parseFloat(persistency);
    if (isNaN(api) || api < 0)          { setValidationError('Enter a valid API amount.'); return; }
    if (isNaN(apps) || apps < 0)        { setValidationError('Enter valid Apps count.'); return; }
    if (isNaN(pers) || pers < 0 || pers > 100) { setValidationError('Persistency must be 0–100.'); return; }
    if (!tenantId) { setValidationError('Tenant context not ready. Please retry.'); return; }

    setSaving(true);
    const confirmedByName = userProfile?.name ?? userProfile?.email ?? 'Manager';
    try {
      await confirmSettlement(
        tenantId, selectedAgent,
        { periodKey: monthKey(selectedYear, selectedMonth), periodType: 'monthly', settledAPI: api, settledApps: apps, persistency: pers, notes },
        user.uid, confirmedByName
      );
      toast.show({
        variant: 'success',
        message: `Settlement saved for ${agentName(selectedAgent)} — ${MONTHS[selectedMonth - 1]} ${selectedYear}.`,
      });
      setSettledAPI(''); setSettledApps(''); setPersistency(''); setNotes('');
      loadData();
    } catch (err) {
      console.error(err);
      toast.show({ variant: 'error', message: "Couldn't save settlement. Please retry." });
    } finally {
      setSaving(false);
    }
  }

  // Bulk save
  async function handleBulkSave() {
    setValidationError('');

    // Validate all rows
    let hasError = false;
    const updated = { ...bulkRows };
    agents.forEach((a) => {
      const row = bulkRows[a.id] ?? {};
      const api = parseFloat(row.api);
      const apps = parseFloat(row.apps);
      const pers = parseFloat(row.persist);
      const errors = [];
      if (row.api !== '' && (isNaN(api) || api < 0))                   errors.push('Invalid API');
      if (row.apps !== '' && (isNaN(apps) || apps < 0))                 errors.push('Invalid Apps');
      if (row.persist !== '' && (isNaN(pers) || pers < 0 || pers > 100)) errors.push('Persistency 0–100');
      updated[a.id] = { ...row, error: errors.join(', ') };
      if (errors.length) hasError = true;
    });
    setBulkRows(updated);
    if (hasError) { setValidationError('Fix row errors before saving.'); return; }

    // Only save rows with at least one value
    const rowsToSave = agents.filter((a) => {
      const row = bulkRows[a.id] ?? {};
      return row.api !== '' || row.apps !== '' || row.persist !== '';
    });
    if (rowsToSave.length === 0) { setValidationError('No data entered.'); return; }
    if (!tenantId) { setValidationError('Tenant context not ready. Please retry.'); return; }

    setSaving(true);
    const confirmedByName = userProfile?.name ?? userProfile?.email ?? 'Manager';
    try {
      await Promise.all(
        rowsToSave.map((a) => {
          const row = bulkRows[a.id];
          return confirmSettlement(
            tenantId, a.id,
            {
              periodKey: monthKey(selectedYear, selectedMonth),
              periodType: 'monthly',
              settledAPI:  parseFloat(row.api)  || 0,
              settledApps: parseFloat(row.apps) || 0,
              persistency: parseFloat(row.persist) || 0,
              notes: '',
            },
            user.uid, confirmedByName
          );
        })
      );
      toast.show({
        variant: 'success',
        message: `Saved ${rowsToSave.length} settlements for ${MONTHS[selectedMonth - 1]} ${selectedYear}.`,
      });
      loadData();
    } catch (err) {
      console.error(err);
      toast.show({ variant: 'error', message: "Couldn't save some rows. Please retry." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(settlement) {
    if (deletingId !== settlement.id) { setDeletingId(settlement.id); return; }
    if (!tenantId) return;
    try {
      await deleteSettlement(tenantId, settlement.agentId, settlement.periodKey, settlement.year);
      setDeletingId(null);
      loadData();
    } catch (err) {
      console.error(err);
      setError('Delete failed. Please try again.');
    }
  }

  if (!canAccess && !isReadOnly) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">You do not have access to the Settlement panel.</p>
      </div>
    );
  }

  const inputCls = 'h-10 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full';
  const labelCls = 'block text-xs font-semibold text-ink-muted mb-1';

  if (isReadOnly) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/8 border border-primary/20">
          <p className="text-sm text-primary">
            Settlement figures are entered by your Branch Manager. Contact them to correct any errors.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink mb-3">Confirmed Settlements — Your Unit</p>

          {loadingData ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-border/30 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{error}</div>
          ) : settlements.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm text-ink-muted">No settlements recorded yet.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="bg-surface border-b border-border">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-ink-muted whitespace-nowrap">Agent</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-ink-muted">Period</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-ink-muted">API</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-ink-muted">Apps</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-ink-muted">Persist</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-ink-muted">By</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-ink-muted">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {settlements.slice(0, visibleCount).map((s) => (
                      <tr key={s.id} className="hover:bg-surface/60 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-ink whitespace-nowrap">{agentName(s.agentId)}</td>
                        <td className="px-3 py-2.5 text-ink-muted whitespace-nowrap">{periodLabel(s.periodKey)}</td>
                        <td className="px-3 py-2.5 text-right text-ink whitespace-nowrap">{formatCurrency(s.settledAPI)}</td>
                        <td className="px-3 py-2.5 text-right text-ink">{s.settledApps ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right text-ink">{s.persistency != null ? `${s.persistency}%` : '—'}</td>
                        <td className="px-3 py-2.5 text-ink-muted text-xs whitespace-nowrap">{s.confirmedByName ?? '—'}</td>
                        <td className="px-3 py-2.5 text-ink-muted text-xs whitespace-nowrap">{formatTs(s.confirmedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {settlements.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="mt-3 w-full h-10 rounded-lg border border-border bg-card text-sm font-medium text-ink-muted hover:text-ink transition-colors"
                >
                  Load More ({settlements.length - visibleCount} remaining)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (!loadingData && agents.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="card text-center py-10">
          <p className="text-sm text-ink-muted">
            No agents in your unit yet. Add agents in the Agent Management panel before recording settlements.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Section 1: Enter Settlements ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-ink">Enter Monthly Settlements</p>
          <button
            onClick={() => setBulkMode((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dark transition-colors py-3 min-h-[44px]"
          >
            {bulkMode ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {bulkMode ? 'Single entry' : 'Bulk entry'}
          </button>
        </div>

        {/* Period selector (shared) */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label htmlFor="settlement-month" className={labelCls}>Month</label>
            <select
              id="settlement-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className={inputCls}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="settlement-year" className={labelCls}>Year</label>
            <select
              id="settlement-year"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={inputCls}
            >
              {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Single entry form */}
        {!bulkMode && (
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div>
              <label htmlFor="settlement-agent" className={labelCls}>Agent</label>
              <select
                id="settlement-agent"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className={inputCls}
              >
                <option value="">Select agent…</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name ?? a.email}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label htmlFor="settlement-api" className={labelCls}>Settled API (TTD)</label>
                <input id="settlement-api" type="number" min="0" step="0.01" value={settledAPI} onChange={(e) => setSettledAPI(e.target.value)} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label htmlFor="settlement-apps" className={labelCls}>Settled Apps</label>
                <input id="settlement-apps" type="number" min="0" step="1" value={settledApps} onChange={(e) => setSettledApps(e.target.value)} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label htmlFor="settlement-persistency" className={labelCls}>Persistency %</label>
                <input id="settlement-persistency" type="number" min="0" max="100" step="0.1" value={persistency} onChange={(e) => setPersistency(e.target.value)} placeholder="0" className={inputCls} />
              </div>
            </div>

            <div>
              <label htmlFor="settlement-notes" className={labelCls}>Notes (optional)</label>
              <textarea
                id="settlement-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. From Feb production circular"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              />
            </div>

            {validationError && <p className="text-xs text-danger-ink">{validationError}</p>}

            <SaveButton
              onClick={handleSave}
              saving={saving}
              label="Save Settlement"
            />
          </form>
        )}

        {/* Bulk entry */}
        {bulkMode && (
          <div className="flex flex-col gap-3">
            {loadingData ? (
              <div className="h-20 bg-border/30 rounded-xl animate-pulse" />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="bg-surface">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-ink-muted">Agent</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-ink-muted">API (TTD)</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-ink-muted">Apps</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-ink-muted">Persist %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {agents.map((a) => {
                      const row = bulkRows[a.id] ?? {};
                      return (
                        <tr key={a.id}>
                          <td className="px-3 py-2 font-medium text-ink whitespace-nowrap">{a.name ?? a.email}</td>
                          <td className="px-2 py-1">
                            <input
                              type="number" min="0" step="0.01"
                              value={row.api ?? ''}
                              onChange={(e) => setBulkRows((prev) => ({ ...prev, [a.id]: { ...prev[a.id], api: e.target.value } }))}
                              placeholder="0"
                              className="h-9 w-24 px-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number" min="0" step="1"
                              value={row.apps ?? ''}
                              onChange={(e) => setBulkRows((prev) => ({ ...prev, [a.id]: { ...prev[a.id], apps: e.target.value } }))}
                              placeholder="0"
                              className="h-9 w-16 px-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                          </td>
                          <td className="px-2 py-1">
                            <input
                              type="number" min="0" max="100" step="0.1"
                              value={row.persist ?? ''}
                              onChange={(e) => setBulkRows((prev) => ({ ...prev, [a.id]: { ...prev[a.id], persist: e.target.value } }))}
                              placeholder="0"
                              className="h-9 w-16 px-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                            />
                            {row.error && <p className="text-[10px] text-danger-ink mt-0.5">{row.error}</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {validationError && <p className="text-xs text-danger-ink">{validationError}</p>}

            <SaveButton
              onClick={handleBulkSave}
              saving={saving}
              label={`Save All (${MONTHS[selectedMonth - 1]} ${selectedYear})`}
            />
          </div>
        )}
      </div>

      {/* ── Section 2: History Table ── */}
      <div>
        <p className="text-sm font-semibold text-ink mb-3">Settlement History</p>

        {loadingData ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-border/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error && settlements.length === 0 ? (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{error}</div>
        ) : settlements.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-sm text-ink-muted">No settlements recorded yet.</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-3 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{error}</div>
            )}
            <div className="overflow-x-auto rounded-xl border border-border bg-surface-raised">
              <table className="text-sm w-full">
                <thead>
                  <tr className="bg-surface border-b border-border">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-ink-muted whitespace-nowrap">Agent</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-ink-muted">Period</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-ink-muted">API</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-ink-muted">Apps</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold text-ink-muted">Persist</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-ink-muted">By</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-ink-muted">Date</th>
                    <th className="px-3 py-2.5 text-center text-xs font-semibold text-ink-muted">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {settlements.slice(0, visibleCount).map((s) => (
                    <tr key={s.id} className="hover:bg-surface/60 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-ink whitespace-nowrap">{agentName(s.agentId)}</td>
                      <td className="px-3 py-2.5 text-ink-muted whitespace-nowrap">{periodLabel(s.periodKey)}</td>
                      <td className="px-3 py-2.5 text-right text-ink whitespace-nowrap">{formatCurrency(s.settledAPI)}</td>
                      <td className="px-3 py-2.5 text-right text-ink">{s.settledApps ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right text-ink">{s.persistency != null ? `${s.persistency}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-ink-muted text-xs whitespace-nowrap">{s.confirmedByName ?? '—'}</td>
                      <td className="px-3 py-2.5 text-ink-muted text-xs whitespace-nowrap">{formatTs(s.confirmedAt)}</td>
                      <td className="px-3 py-2.5 text-center">
                        {deletingId === s.id ? (
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-[10px] text-danger-ink leading-tight max-w-[100px]">
                              Delete {agentName(s.agentId)} — {periodLabel(s.periodKey)}?
                            </p>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setDeletingId(null)}
                                className="h-6 px-2 rounded border border-border text-[10px] text-ink-muted hover:text-ink transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDelete(s)}
                                className="h-6 px-2 rounded bg-danger text-white text-[10px] font-semibold hover:bg-danger/90 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDelete(s)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-danger/60 hover:text-danger hover:bg-danger/10 transition-colors mx-auto"
                            aria-label="Delete settlement"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {settlements.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="mt-3 w-full h-10 rounded-lg border border-border bg-card text-sm font-medium text-ink-muted hover:text-ink transition-colors"
              >
                Load More ({settlements.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
