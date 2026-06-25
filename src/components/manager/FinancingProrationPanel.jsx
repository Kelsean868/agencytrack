// Track K · K5 — FinancingProrationPanel (Proration sub-view of the financing tab).
//
// The manager's suggested-vs-confirmed override drawer (manager Validation
// Dashboard mockup). Per agent per month it shows the credit-filtered Gross
// (actualAPI, reusing the K3 engine via financingProration), the month's
// validating target, the computed proration %, the suggested draw, an editable
// confirmed figure (managerFinancing), and the resulting adjustmentPct.
//
// Locked behaviour (K5 brief dispatcher locks):
//   • actualAPI = K3 credit-filtered monthly Gross on the resolved basis (lib).
//   • basis: M1–3 submitted-final · M4+ past settled-confirmed · M4+ current
//     submitted-provisional (a LIVE PROJECTION — display only, never a stored
//     determination, Decision 4 / lock c). On a provisional month the override is
//     READ-ONLY: the manager confirms once the month is operative (final/settled).
//   • adjustmentPct = (currentMonthlyFinancing − managerFinancing) ÷
//     currentMonthlyFinancing — stored only when the manager confirms (lock b).
//   • managerFinancing caps at agreedMonthlyFinancing (agreed = ceiling).
//   • The >10% flag + notify-Sales-Admin duty is K7, NOT here — this panel stores
//     adjustmentPct only.
// BM-and-up only (unit_manager excluded — contract 5.3; nav gates, guard is
// defense-in-depth). Internal agent dropdown mirrors MonthlyStatementEntry.
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import SaveButton from '../ui/SaveButton';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import { getTenantUsers } from '../../services/managerService';
import { getFinancingTerms, listFinancingMonths, setFinancingProration } from '../../services/financingService';
import { getOwnPolicies } from '../../services/policiesService';
import { computeProration } from '../../lib/financingProration';
import { getTodayTT, monthKeyFromDate, monthsBetweenKeys } from '../../utils/dateInputs';
import { formatCurrency } from '../../utils/formatters';
import FinancingBasisBadge from './FinancingBasisBadge';

const WRITE_ROLES = ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'];

// "YYYY-MM" (month input) → "YYYY_MM" (ledger key); '' when malformed.
const toMonthKey = (ym) => (/^\d{4}-\d{2}$/.test(ym) ? ym.replace('-', '_') : '');
const monthLabel = (key) => {
  const [y, m] = key.split('_');
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${MON[Number(m) - 1] ?? m} ${y.slice(2)}`;
};
const pctLabel = (frac) => (frac == null || Number.isNaN(frac) ? '—' : `${Math.round(frac * 100)}%`);
// Signed adjustment readout — adjustmentPct > 0 is a cut BELOW current (shown −X%),
// < 0 is ABOVE current (shown +X%). Computes the sign from the magnitude so a
// negative pct never double-signs (e.g. "−-13%").
const adjustmentLabel = (frac) => {
  if (frac == null || Number.isNaN(frac)) return '—';
  const pct = Math.round(Math.abs(frac) * 100);
  if (frac > 0) return `−${pct}%`;
  if (frac < 0) return `+${pct}%`;
  return '0%';
};

const EMPTY_FORM = { month: '', validatingAPI: '', managerFinancing: '' };

export default function FinancingProrationPanel() {
  const { userProfile, role, tenantId } = useAuth();
  const toast = useToast();

  const [agents, setAgents]               = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentsError, setAgentsError]     = useState('');

  const [selectedAgent, setSelectedAgent] = useState('');
  const [terms, setTerms]                 = useState(null);   // financingTerms doc
  const [policies, setPolicies]           = useState([]);     // agent's policy ledger
  const [months, setMonths]               = useState([]);     // agent's financing ledger rows (stored proration)
  const [loading, setLoading]             = useState(false);

  const [form, setForm]                   = useState(EMPTY_FORM);
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving]               = useState(false);

  // Latest-request guard (money-write hazard parity with MonthlyStatementEntry): a
  // slow load resolving after an agent switch must not write one agent's data onto
  // another's view.
  const latestAgentReqRef = useRef('');

  const canWrite = WRITE_ROLES.includes(role);
  const currentMonthKey = useMemo(() => toMonthKey(getTodayTT().slice(0, 7)), []);

  // ── Load agents (mirror MonthlyStatementEntry) ──────────────────────────────
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

  // ── Load the selected agent's terms + policy ledger ─────────────────────────
  // getOwnPolicies is a by-agentId fetch (where agentId == id); a BM-and-up caller
  // satisfies the policies `list` manager arm and the agentId+createdAt composite
  // index already exists. (LOW FU: rename to a shared getPoliciesByAgent.)
  const loadAgent = useCallback((agentId) => {
    latestAgentReqRef.current = agentId;
    if (!tenantId || !agentId) { setTerms(null); setPolicies([]); setMonths([]); setForm(EMPTY_FORM); return; }
    setLoading(true);
    setValidationError('');
    Promise.all([
      getFinancingTerms(tenantId, agentId),
      getOwnPolicies(tenantId, agentId),
      listFinancingMonths(tenantId, agentId),
    ])
      .then(([termsDoc, pols, ledger]) => {
        if (latestAgentReqRef.current !== agentId) return;
        setTerms(termsDoc);
        setPolicies(pols || []);
        setMonths(ledger || []);
        setForm({ ...EMPTY_FORM, month: getTodayTT().slice(0, 7) });
      })
      .catch((e) => {
        if (latestAgentReqRef.current !== agentId) return;
        console.error(e);
        toast.show({ variant: 'error', message: "Couldn't load the agent's financing data." });
      })
      .finally(() => { if (latestAgentReqRef.current === agentId) setLoading(false); });
  }, [tenantId, toast]);

  // ── Sync the form to the selected month from the PRE-LOADED ledger ──────────
  // Synchronous (no per-month fetch) — mirrors MonthlyStatementEntry. This avoids
  // the race where a late async fetch clobbers the manager's in-progress edits
  // (the effect re-fires only on month/ledger change, never on a keystroke).
  // Selecting a stored month pre-fills its validatingAPI + managerFinancing;
  // selecting an unsaved month clears them.
  const statementMonth = toMonthKey(form.month);
  useEffect(() => {
    if (!statementMonth) return;
    const row = months.find((m) => m.month === statementMonth);
    setForm((f) => ({
      ...f,
      validatingAPI:    row?.validatingAPI != null ? String(row.validatingAPI) : '',
      managerFinancing: row?.managerFinancing != null ? String(row.managerFinancing) : '',
    }));
  }, [statementMonth, months]);

  function handleSelectAgent(e) {
    const id = e.target.value;
    setSelectedAgent(id);
    loadAgent(id);
  }

  function agentName(id) {
    const a = agents.find((x) => x.id === id);
    return a?.name ?? a?.email ?? id;
  }

  // ── Live proration readout (recomputed from the editable inputs) ────────────
  const effectiveValidatingAPI = form.validatingAPI === ''
    ? (terms?.validatingAPI ?? 0)
    : form.validatingAPI;

  const readout = useMemo(() => {
    if (!terms || !statementMonth) return null;
    return computeProration({
      policies,
      effectiveDate: terms.effectiveDate,
      statementMonth,
      currentMonthKey,
      validatingAPI: effectiveValidatingAPI,
      agreedMonthlyFinancing: terms.agreedMonthlyFinancing,
      currentMonthlyFinancing: terms.currentMonthlyFinancing,
      managerFinancing: form.managerFinancing === '' ? undefined : form.managerFinancing,
    });
  }, [policies, terms, statementMonth, currentMonthKey, effectiveValidatingAPI, form.managerFinancing]);

  const isProvisional = readout?.basisSource === 'submitted-provisional';

  // ── Save (confirm the draw) ─────────────────────────────────────────────────
  async function handleSave(e) {
    e?.preventDefault?.();
    setValidationError('');
    if (!selectedAgent) { setValidationError('Select an agent.'); return; }
    if (!terms)         { setValidationError('Set financing terms for this agent first (Terms tab).'); return; }
    if (!statementMonth) { setValidationError('Select a month.'); return; }

    // A month before the effective date has no ledger position.
    if (terms?.effectiveDate) {
      try {
        const firstKey = monthKeyFromDate(terms.effectiveDate);
        if (monthsBetweenKeys(firstKey, statementMonth) < 0) {
          setValidationError(`Month can't be before the financing effective date (${monthLabel(firstKey)}).`);
          return;
        }
      } catch { /* malformed effectiveDate — service guards */ }
    }

    if (isProvisional) {
      setValidationError('This month is a live projection (settlement pending) — confirm once it is final.');
      return;
    }

    const manager = parseFloat(form.managerFinancing);
    if (!Number.isFinite(manager) || manager < 0) { setValidationError('Enter the confirmed financing figure (≥ 0).'); return; }
    const agreed = parseFloat(terms.agreedMonthlyFinancing);
    if (Number.isFinite(agreed) && manager > agreed) {
      setValidationError(`Confirmed financing can't exceed the agreed amount (${formatCurrency(agreed)}).`);
      return;
    }
    if (!readout) { setValidationError('Proration not ready. Please retry.'); return; }
    if (!tenantId) { setValidationError('Tenant context not ready. Please retry.'); return; }

    setSaving(true);
    const actor = { role, name: userProfile?.name ?? userProfile?.email ?? 'Manager' };
    try {
      await setFinancingProration(
        tenantId, selectedAgent, statementMonth,
        {
          validatingAPI:      readout.validatingAPI,
          actualAPI:          readout.actualAPI,
          suggestedFinancing: readout.suggestedFinancing,
          basisSource:        readout.basisSource,
          managerFinancing:   manager,
          adjustmentPct:      readout.adjustmentPct,
        },
        actor,
      );
      // Refresh the ledger so the saved proration persists in the synced form
      // (and survives a re-selection of this month).
      const ledger = await listFinancingMonths(tenantId, selectedAgent);
      if (latestAgentReqRef.current === selectedAgent) setMonths(ledger);
      toast.show({ variant: 'success', message: `${monthLabel(statementMonth)} financing confirmed for ${agentName(selectedAgent)}.` });
    } catch (err) {
      console.error(err);
      toast.show({ variant: 'error', message: "Couldn't save the proration. Please retry." });
    } finally {
      setSaving(false);
    }
  }

  // ── Access guard (defense-in-depth) ─────────────────────────────────────────
  if (!canWrite) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">Financing proration is managed by Branch Managers and above.</p>
      </div>
    );
  }

  const inputCls = 'h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full';
  const labelCls = 'block text-xs font-semibold text-ink-muted mb-1';
  const agreed = terms ? parseFloat(terms.agreedMonthlyFinancing) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Agent selector */}
      <div className="card">
        <p className="text-sm font-semibold text-ink mb-3">Proration — confirm the draw</p>
        {loadingAgents ? (
          <div className="h-11 bg-border/30 rounded-lg animate-pulse" />
        ) : agentsError ? (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{agentsError}</div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-ink-muted">No agents in your scope yet.</p>
        ) : (
          <div>
            <label htmlFor="proration-agent" className={labelCls}>Agent</label>
            <select
              id="proration-agent"
              data-testid="proration-agent-select"
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
              No financing terms for {agentName(selectedAgent)} yet. Set the agreement on the{' '}
              <span className="font-semibold text-ink">Terms</span> tab first — the effective date anchors the
              basis and the validating API seeds the proration target.
            </p>
          </div>
        ) : (
          <>
            {/* Month selector */}
            <div className="card">
              <label htmlFor="proration-month" className={labelCls}>Month</label>
              <input
                id="proration-month" data-testid="proration-month"
                type="month"
                min={terms?.effectiveDate ? terms.effectiveDate.slice(0, 7) : undefined}
                value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                className={`${inputCls} max-w-xs`}
              />
            </div>

            {readout && (
              <>
                {/* Readout: actual / validating / proration / suggested */}
                <div className="card" data-testid="proration-readout" data-basis={readout.basisSource}>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <p className="text-sm font-semibold text-ink">{monthLabel(statementMonth)}</p>
                    <FinancingBasisBadge basis={readout.basisSource} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Actual API</p>
                      <p className="text-lg font-extrabold text-ink" data-testid="proration-actual-api">{formatCurrency(readout.actualAPI)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Validating</p>
                      <p className="text-lg font-extrabold text-ink" data-testid="proration-validating-api">{formatCurrency(readout.validatingAPI)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Proration</p>
                      <p className="text-lg font-extrabold text-primary dark:text-primary-dark" data-testid="proration-ratio">{pctLabel(readout.prorationRatio)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Suggested</p>
                      <p className="text-lg font-extrabold text-ink" data-testid="proration-suggested">{formatCurrency(readout.suggestedFinancing)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-ink-muted">
                    Suggested = {pctLabel(readout.prorationRatio)} × {formatCurrency(agreed)} (agreed). The agreed amount is the ceiling.
                  </p>
                </div>

                {isProvisional ? (
                  // Live projection — display only, no determination stored (Decision 4 / lock c).
                  <div className="card border-gold/30" data-testid="proration-provisional-note">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={16} className="text-gold" aria-hidden="true" />
                      <p className="text-sm font-semibold text-gold">Live projection — settlement pending</p>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">
                      This month is still in flight, so the figures above are a provisional projection off submitted
                      business. Confirm the financing draw once the month is final (settled) — a determination is never
                      stored from a provisional projection.
                    </p>
                  </div>
                ) : (
                  // Override + confirm
                  <div className="card">
                    <form onSubmit={handleSave} className="flex flex-col gap-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="proration-validating-input" className={labelCls}>Validating API (TTD) · this month</label>
                          <input
                            id="proration-validating-input" data-testid="proration-validating-input"
                            type="number" min="0" step="0.01" inputMode="decimal"
                            value={form.validatingAPI}
                            onChange={(e) => setForm((f) => ({ ...f, validatingAPI: e.target.value }))}
                            placeholder={terms?.validatingAPI != null ? String(terms.validatingAPI) : '0'}
                            className={inputCls}
                          />
                          <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-wide">Defaults to the schedule; override for a new Validation Schedule</p>
                        </div>
                        <div>
                          <label htmlFor="proration-manager-input" className={labelCls}>Confirmed financing (TTD)</label>
                          <input
                            id="proration-manager-input" data-testid="proration-manager-input"
                            type="number" min="0" step="0.01" inputMode="decimal"
                            value={form.managerFinancing}
                            onChange={(e) => setForm((f) => ({ ...f, managerFinancing: e.target.value }))}
                            placeholder={readout.suggestedFinancing ? String(readout.suggestedFinancing) : '0'}
                            className={inputCls}
                          />
                          <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-wide">Your final call · caps at {formatCurrency(agreed)} (agreed)</p>
                        </div>
                      </div>

                      {/* adjustmentPct readout (vs current monthly financing) */}
                      <div
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card-raised border border-border"
                        data-testid="proration-adjustment"
                        data-adjustment={readout.adjustmentPct ?? ''}
                      >
                        <div>
                          <p className="text-xs font-semibold text-ink">Adjustment vs current schedule</p>
                          <p className="text-[10px] text-ink-muted uppercase tracking-wide">
                            distance below {formatCurrency(terms.currentMonthlyFinancing)} (current monthly financing)
                          </p>
                        </div>
                        <p className={[
                          'text-xl font-extrabold',
                          readout.adjustmentPct == null ? 'text-ink-muted' : readout.adjustmentPct > 0 ? 'text-ink' : 'text-success-ink',
                        ].join(' ')}>
                          {adjustmentLabel(readout.adjustmentPct)}
                        </p>
                      </div>

                      {validationError && <p className="text-xs text-danger-ink" data-testid="proration-validation-error">{validationError}</p>}

                      <SaveButton
                        onClick={handleSave}
                        saving={saving}
                        label="Confirm financing"
                        className="self-start"
                      />
                    </form>
                  </div>
                )}
              </>
            )}
          </>
        )
      )}
    </div>
  );
}
