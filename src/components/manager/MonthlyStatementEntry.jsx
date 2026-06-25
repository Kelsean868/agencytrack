// Track K · K2 — MonthlyStatementEntry (Ledger sub-view of the financing tab).
//
// Manual per-agent-month statement entry + the per-agent ledger history. The
// statement's runningBalance is stored AUTHORITATIVE (never derived) and may be
// negative (= surplus owed back to the agent). Shows the running-balance-vs-6×-
// ceiling indicator (ceiling = 6 × currentMonthlyFinancing, contract 2.4/6.3 —
// NOT agreed), the skipped-month reconciliation flag (informational in K2), and
// a render-derived basis badge per month. BM-and-up only (unit_manager excluded;
// the nav gates this, the guard below is defense-in-depth). Internal agent
// dropdown mirrors FinancingTermsSetup / SettlementPanel.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import SaveButton from '../ui/SaveButton';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import { getTenantUsers } from '../../services/managerService';
import {
  getFinancingTerms,
  listFinancingMonths,
  setFinancingMonth,
  detectSkippedMonths,
  deriveBasisSource,
  financingMonthIndex,
  financingCeiling,
} from '../../services/financingService';
import { monthKeyFromDate, monthsBetweenKeys, enumerateMonthKeys, getTodayTT } from '../../utils/dateInputs';
import { formatCurrency } from '../../utils/formatters';
import FinancingBasisBadge from './FinancingBasisBadge';
import LedgerTimelineStrip from './LedgerTimelineStrip';

const WRITE_ROLES = ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'];

// "YYYY-MM" (month input) → "YYYY_MM" (ledger key); '' when malformed.
const toMonthKey = (ym) => (/^\d{4}-\d{2}$/.test(ym) ? ym.replace('-', '_') : '');
const monthLabel = (key) => {
  const [y, m] = key.split('_');
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${MON[Number(m) - 1] ?? m} ${y.slice(2)}`;
};

const EMPTY_FORM = { month: '', financingPaid: '', netCommission: '', bonusOffset: '', runningBalance: '', notes: '' };

export default function MonthlyStatementEntry() {
  const { userProfile, role, tenantId } = useAuth();
  const toast = useToast();

  const [agents, setAgents]               = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentsError, setAgentsError]     = useState('');

  const [selectedAgent, setSelectedAgent] = useState('');
  const [terms, setTerms]                 = useState(null);    // financingTerms doc (effectiveDate + currentMonthlyFinancing)
  const [months, setMonths]               = useState([]);      // ledger rows
  const [loading, setLoading]             = useState(false);

  const [form, setForm]                   = useState(EMPTY_FORM);
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving]               = useState(false);

  // Latest-request guard (K1 Gemini #2 parity): on rapid agent switching a slower
  // load can resolve last and write one agent's ledger onto another's view → a
  // money-write hazard, not just a display glitch. Drop stale resolutions.
  const latestAgentReqRef = useRef('');

  const canWrite = WRITE_ROLES.includes(role);

  // ── Load agents (mirror FinancingTermsSetup) ────────────────────────────────
  const loadAgents = useCallback(() => {
    if (!tenantId) return;
    setLoadingAgents(true);
    setAgentsError('');
    getTenantUsers(tenantId)
      .then((userList) => setAgents((userList || []).filter((u) => u.role === 'agent')))
      .catch((e) => { console.error(e); setAgentsError('Failed to load agents.'); })
      .finally(() => setLoadingAgents(false));
  }, [tenantId]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // ── Load the selected agent's terms + ledger ────────────────────────────────
  const loadLedger = useCallback((agentId) => {
    latestAgentReqRef.current = agentId;
    if (!tenantId || !agentId) { setTerms(null); setMonths([]); setForm(EMPTY_FORM); return; }
    setLoading(true);
    setValidationError('');
    Promise.all([getFinancingTerms(tenantId, agentId), listFinancingMonths(tenantId, agentId)])
      .then(([termsDoc, ledger]) => {
        if (latestAgentReqRef.current !== agentId) return; // stale — newer agent selected
        setTerms(termsDoc);
        setMonths(ledger);
        setForm({ ...EMPTY_FORM, month: getTodayTT().slice(0, 7) });
      })
      .catch((e) => {
        if (latestAgentReqRef.current !== agentId) return;
        console.error(e);
        toast.show({ variant: 'error', message: "Couldn't load the financing ledger." });
      })
      .finally(() => {
        if (latestAgentReqRef.current !== agentId) return;
        setLoading(false);
      });
  }, [tenantId, toast]);

  // Sync the form to the selected statement month (Gemini #1 — HIGH): switching
  // to a NEW month clears the figures (no carry-over of the prior month's values
  // — a money-data-entry hazard); switching to an EXISTING month pre-populates it
  // for editing. Only the statement fields are touched; `month` is preserved.
  useEffect(() => {
    const key = toMonthKey(form.month);
    if (!key) return;
    const existing = months.find((m) => m.month === key);
    setForm((f) => existing
      ? {
          ...f,
          financingPaid:  String(existing.financingPaid ?? ''),
          netCommission:  String(existing.netCommission ?? ''),
          bonusOffset:    String(existing.bonusOffset ?? ''),
          runningBalance: String(existing.runningBalance ?? ''),
          notes:          existing.notes ?? '',
        }
      : { ...f, financingPaid: '', netCommission: '', bonusOffset: '', runningBalance: '', notes: '' });
  }, [form.month, months]);

  function handleSelectAgent(e) {
    const id = e.target.value;
    setSelectedAgent(id);
    loadLedger(id);
  }

  function agentName(id) {
    const a = agents.find((x) => x.id === id);
    return a?.name ?? a?.email ?? id;
  }

  // ── Save the month's statement ──────────────────────────────────────────────
  async function handleSave(e) {
    e?.preventDefault?.();
    setValidationError('');
    if (!selectedAgent) { setValidationError('Select an agent.'); return; }
    if (!terms) { setValidationError('Set financing terms for this agent first (Terms tab).'); return; }

    const monthKey = toMonthKey(form.month);
    if (!monthKey) { setValidationError('Select a statement month.'); return; }

    // A statement month before the effective date has no valid ledger position
    // (month 1 = effectiveDate's month) — block it (Gemini #4).
    if (terms?.effectiveDate) {
      try {
        const firstKey = monthKeyFromDate(terms.effectiveDate);
        if (monthsBetweenKeys(firstKey, monthKey) < 0) {
          setValidationError(`Statement month can't be before the financing effective date (${monthLabel(firstKey)}).`);
          return;
        }
      } catch { /* malformed effectiveDate — fall through, the ledger guards elsewhere */ }
    }

    const financingPaid = parseFloat(form.financingPaid);
    const netCommission = parseFloat(form.netCommission);
    const bonusOffset   = parseFloat(form.bonusOffset);
    const runningBalance = parseFloat(form.runningBalance);

    if (isNaN(financingPaid) || financingPaid < 0) { setValidationError('Enter a valid financing paid (≥ 0).'); return; }
    if (isNaN(netCommission) || netCommission < 0) { setValidationError('Enter a valid net commission (≥ 0).'); return; }
    if (isNaN(bonusOffset)   || bonusOffset   < 0) { setValidationError('Enter a valid bonus offset (≥ 0).'); return; }
    if (isNaN(runningBalance))                     { setValidationError('Enter the running balance (may be negative = surplus).'); return; }
    if (!tenantId) { setValidationError('Tenant context not ready. Please retry.'); return; }

    setSaving(true);
    const actor = { role, name: userProfile?.name ?? userProfile?.email ?? 'Manager' };
    try {
      await setFinancingMonth(
        tenantId, selectedAgent, monthKey,
        { financingPaid, netCommission, bonusOffset, runningBalance, notes: form.notes },
        actor,
      );
      const ledger = await listFinancingMonths(tenantId, selectedAgent);
      if (latestAgentReqRef.current === selectedAgent) setMonths(ledger);
      toast.show({ variant: 'success', message: `${monthLabel(monthKey)} statement saved for ${agentName(selectedAgent)}.` });
    } catch (err) {
      console.error(err);
      toast.show({ variant: 'error', message: "Couldn't save the statement. Please retry." });
    } finally {
      setSaving(false);
    }
  }

  // ── Access guard (defense-in-depth) ─────────────────────────────────────────
  if (!canWrite) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">The financing ledger is managed by Branch Managers and above.</p>
      </div>
    );
  }

  const inputCls = 'h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full';
  const labelCls = 'block text-xs font-semibold text-ink-muted mb-1';

  // ── Derived ledger state ────────────────────────────────────────────────────
  const effectiveDate = terms?.effectiveDate ?? null;
  const ceiling = financingCeiling(terms?.currentMonthlyFinancing);
  const enteredKeys = months.map((m) => m.month);
  const enteredSet = new Set(enteredKeys);
  const skipped = effectiveDate ? detectSkippedMonths(effectiveDate, enteredKeys) : [];
  const formMonthKey = toMonthKey(form.month);
  const monthExists = formMonthKey && enteredSet.has(formMonthKey);

  // Current standing = the most recent entered month's authoritative balance.
  const sorted = [...months].sort((a, b) => (a.month < b.month ? -1 : 1));
  const currentBalance = sorted.length ? sorted[sorted.length - 1].runningBalance : null;
  const overCeiling = ceiling != null && currentBalance != null && currentBalance > ceiling;
  const isSurplus = currentBalance != null && currentBalance < 0;

  // Timeline cells: effectiveDate's first month → max(latest entered, form month).
  let cells = [];
  if (effectiveDate) {
    try {
      const firstKey = monthKeyFromDate(effectiveDate);
      const candidates = [...enteredKeys, formMonthKey].filter(Boolean);
      const lastKey = candidates.reduce(
        (acc, k) => (monthsBetweenKeys(firstKey, k) > monthsBetweenKeys(firstKey, acc) ? k : acc),
        firstKey,
      );
      cells = enumerateMonthKeys(firstKey, lastKey).map((key) => {
        let state = 'future';
        if (enteredSet.has(key)) state = 'entered';
        else if (skipped.includes(key)) state = 'skipped';
        else if (key === formMonthKey) state = 'current';
        const row = months.find((m) => m.month === key);
        return { month: key, label: monthLabel(key), state, balance: row?.runningBalance };
      });
    } catch { cells = []; }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Agent selector */}
      <div className="card">
        <p className="text-sm font-semibold text-ink mb-3">Monthly Ledger</p>
        {loadingAgents ? (
          <div className="h-11 bg-border/30 rounded-lg animate-pulse" />
        ) : agentsError ? (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{agentsError}</div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-ink-muted">No agents in your scope yet.</p>
        ) : (
          <div>
            <label htmlFor="financing-ledger-agent" className={labelCls}>Agent</label>
            <select
              id="financing-ledger-agent"
              data-testid="financing-ledger-agent-select"
              value={selectedAgent}
              onChange={handleSelectAgent}
              className={inputCls}
            >
              <option value="">Select agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name ?? a.email}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selectedAgent && (
        loading ? (
          <div className="card"><div className="h-40 bg-border/30 rounded-lg animate-pulse" /></div>
        ) : !terms ? (
          <div className="card">
            <p className="text-sm text-ink-muted">
              No financing terms for {agentName(selectedAgent)} yet. Set the agreement on the <span className="font-semibold text-ink">Terms</span> tab before entering monthly statements — the effective date anchors the ledger and the current monthly financing drives the 6× ceiling.
            </p>
          </div>
        ) : (
          <>
            {/* Ledger timeline band */}
            <LedgerTimelineStrip cells={cells} />

            {/* Ceiling indicator */}
            <div
              className="card"
              data-testid="financing-ceiling-meter"
              data-ceiling={ceiling ?? ''}
              data-breach={overCeiling ? 'true' : 'false'}
              data-surplus={isSurplus ? 'true' : 'false'}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Running balance vs 6× ceiling</p>
                  <p className="text-sm text-ink-muted mt-0.5">
                    Ceiling = 6 × current monthly financing ({formatCurrency(terms.currentMonthlyFinancing)}) ={' '}
                    <span className="font-semibold text-ink">{ceiling != null ? formatCurrency(ceiling) : '—'}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Current standing</p>
                  <p className={[
                    'text-xl font-extrabold',
                    currentBalance == null ? 'text-ink-muted' : isSurplus ? 'text-success-ink' : overCeiling ? 'text-danger-ink' : 'text-ink',
                  ].join(' ')}>
                    {currentBalance == null ? '—' : formatCurrency(currentBalance)}
                  </p>
                </div>
              </div>
              {isSurplus && (
                <p className="mt-2 text-xs text-success-ink" data-testid="financing-surplus-note">
                  Surplus — balance is below zero, owed back to the agent.
                </p>
              )}
              {overCeiling && (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-danger-ink" data-testid="financing-breach-note">
                  <AlertTriangle size={14} aria-hidden="true" />
                  Over the 6× ceiling.
                </p>
              )}
            </div>

            {/* Skipped-month flag (informational in K2) */}
            {skipped.length > 0 && (
              <div className="card border-danger/30" data-testid="financing-skipped-flag" data-gap-count={skipped.length}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-danger-ink" aria-hidden="true" />
                  <p className="text-sm font-semibold text-danger-ink">Skipped month — reconciliation flag</p>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-danger-ink bg-danger/10 rounded-full px-2 py-0.5">
                    {skipped.length} gap{skipped.length > 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  No statement entered for {skipped.map(monthLabel).join(', ')}. A gap is flagged, never inferred — interpolating would distort the running balance and the ceiling read. Enter the missing month to clear the flag.
                </p>
              </div>
            )}

            {/* Statement entry form */}
            <div className="card">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <p className="text-sm font-semibold text-ink">Enter statement · {agentName(selectedAgent)}</p>
                {formMonthKey && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-gold bg-gold-tint rounded-full px-2 py-0.5">
                    {monthLabel(formMonthKey)} · Month {financingMonthIndex(effectiveDate, formMonthKey) ?? '—'}
                  </span>
                )}
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gold-tint border border-gold/30 mb-4">
                <span className="text-gold shrink-0" aria-hidden="true">🔒</span>
                <p className="text-xs text-gold leading-relaxed">
                  <span className="font-bold">The statement value wins.</span> Enter the figures exactly as the monthly statement shows. The running balance you type is stored as authoritative — it overrides any rolled-forward estimate and self-corrects past drift.
                </p>
              </div>

              <form onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="financing-month" className={labelCls}>Statement month</label>
                    <input
                      id="financing-month" data-testid="financing-month"
                      type="month"
                      min={terms?.effectiveDate ? terms.effectiveDate.slice(0, 7) : undefined}
                      value={form.month}
                      onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="financing-paid" className={labelCls}>Financing paid (TTD)</label>
                    <input
                      id="financing-paid" data-testid="financing-paid"
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={form.financingPaid}
                      onChange={(e) => setForm((f) => ({ ...f, financingPaid: e.target.value }))}
                      placeholder="0" className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="financing-net-commission" className={labelCls}>Net commission (TTD)</label>
                    <input
                      id="financing-net-commission" data-testid="financing-net-commission"
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={form.netCommission}
                      onChange={(e) => setForm((f) => ({ ...f, netCommission: e.target.value }))}
                      placeholder="0" className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="financing-bonus-offset" className={labelCls}>Bonus offset (TTD)</label>
                    <input
                      id="financing-bonus-offset" data-testid="financing-bonus-offset"
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={form.bonusOffset}
                      onChange={(e) => setForm((f) => ({ ...f, bonusOffset: e.target.value }))}
                      placeholder="0" className={inputCls}
                    />
                    <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-wide">Manual statement value · K4 projects it</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="financing-running-balance" className={labelCls}>
                    Running balance (TTD) · authoritative
                  </label>
                  <input
                    id="financing-running-balance" data-testid="financing-running-balance"
                    type="number" step="0.01" inputMode="decimal"
                    value={form.runningBalance}
                    onChange={(e) => setForm((f) => ({ ...f, runningBalance: e.target.value }))}
                    placeholder="0" className={inputCls}
                  />
                  <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-wide">
                    From the statement · stored, not derived · may be negative (= owed to agent)
                  </p>
                </div>

                <div>
                  <label htmlFor="financing-notes" className={labelCls}>Notes</label>
                  <textarea
                    id="financing-notes" data-testid="financing-notes"
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder='e.g. "Statement reissued 3 Jun; corrected April lapse adjustment."'
                    className="px-3 py-2 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full resize-none"
                  />
                </div>

                {monthExists && (
                  <p className="text-xs text-warning-ink" data-testid="financing-month-exists">
                    {monthLabel(formMonthKey)} already has a statement — saving replaces it (statement reissued).
                  </p>
                )}
                {validationError && <p className="text-xs text-danger-ink">{validationError}</p>}

                <SaveButton
                  onClick={handleSave}
                  saving={saving}
                  label={monthExists ? 'Replace statement' : 'Save statement'}
                  className="self-start"
                />
              </form>
            </div>

            {/* Ledger history list (basis badges) */}
            {months.length > 0 && (
              <div className="card" data-testid="financing-ledger-history">
                <p className="text-sm font-semibold text-ink mb-3">Statement history</p>
                <div className="flex flex-col divide-y divide-border">
                  {sorted.map((m) => (
                    <div key={m.month} className="flex items-center gap-3 py-2.5 flex-wrap" data-testid={`financing-row-${m.month}`}>
                      <span className="text-sm font-semibold text-ink w-20">{monthLabel(m.month)}</span>
                      <FinancingBasisBadge basis={deriveBasisSource(effectiveDate, m.month)} />
                      <span className="text-xs text-ink-muted">
                        paid {formatCurrency(m.financingPaid)} · net {formatCurrency(m.netCommission)}
                      </span>
                      <span className={[
                        'ml-auto text-sm font-bold',
                        m.runningBalance < 0 ? 'text-success-ink' : 'text-ink',
                      ].join(' ')}>
                        {formatCurrency(m.runningBalance)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
