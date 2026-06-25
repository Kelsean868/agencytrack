// Track K · K1 — FinancingTermsSetup (manager screen, port of mockup #3).
//
// BM-and-up only (unit_manager excluded per contract 5.3; nav gates this, the
// access guard below is defense-in-depth). Self-contained: an internal agent
// dropdown (getTenantUsers, mirroring SettlementPanel), the per-agent terms
// form (agreed / current / validatingAPI / effectiveDate), and the forward-only
// status machine control. Derived ceiling/clocks are intentionally NOT here
// (deferred to K2/K6 — see FOLLOW_UPS).
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import SaveButton from '../ui/SaveButton';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import { getTenantUsers } from '../../services/managerService';
import {
  getFinancingTerms,
  setFinancingTerms,
  transitionFinancingStatus,
  allowedNextStatuses,
  DEFAULT_FINANCING_STATUS,
  FINANCING_STATUS_LABELS,
} from '../../services/financingService';
import FinancingStatusBadge from './FinancingStatusBadge';
import { getTodayTT } from '../../utils/dateInputs';
import { formatCurrency } from '../../utils/formatters';

const WRITE_ROLES = ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'];

const EMPTY_FORM = { agreed: '', current: '', validatingAPI: '', effectiveDate: '' };

export default function FinancingTermsSetup() {
  const { userProfile, role, tenantId } = useAuth();
  const toast = useToast();

  const [agents, setAgents]                 = useState([]);
  const [loadingAgents, setLoadingAgents]   = useState(true);
  const [agentsError, setAgentsError]       = useState('');

  const [selectedAgent, setSelectedAgent]   = useState('');
  const [terms, setTerms]                   = useState(null);   // existing doc or null
  const [status, setStatus]                 = useState(DEFAULT_FINANCING_STATUS);
  const [loadingTerms, setLoadingTerms]     = useState(false);

  const [form, setForm]                     = useState(EMPTY_FORM);
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving]                 = useState(false);

  const [pendingTransition, setPendingTransition] = useState('');
  const [transitioning, setTransitioning]   = useState(false);

  // Latest-request guard (Gemini #2): on rapid agent switching, a slower
  // getFinancingTerms for a previously selected agent can resolve last and
  // overwrite the form. Because Save targets `selectedAgent` with the DISPLAYED
  // values, a stale resolution is a money-write hazard (agent A's figures onto
  // agent B's doc), not just a display glitch. Track the latest requested agentId
  // and drop any resolution that is no longer current.
  const latestAgentReqRef = useRef('');

  const canWrite = WRITE_ROLES.includes(role);

  // ── Load agents (mirror SettlementPanel) ────────────────────────────────────
  const loadAgents = useCallback(() => {
    if (!tenantId) return;
    setLoadingAgents(true);
    setAgentsError('');
    getTenantUsers(tenantId)
      .then((userList) => setAgents(userList.filter((u) => u.role === 'agent')))
      .catch((e) => { console.error(e); setAgentsError('Failed to load agents.'); })
      .finally(() => setLoadingAgents(false));
  }, [tenantId]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  // ── Load the selected agent's terms ─────────────────────────────────────────
  const loadTerms = useCallback((agentId) => {
    latestAgentReqRef.current = agentId;
    if (!tenantId || !agentId) { setTerms(null); setStatus(DEFAULT_FINANCING_STATUS); setForm(EMPTY_FORM); return; }
    setLoadingTerms(true);
    setValidationError('');
    setPendingTransition('');
    getFinancingTerms(tenantId, agentId)
      .then((doc) => {
        if (latestAgentReqRef.current !== agentId) return; // stale — a newer agent was selected
        if (doc) {
          setTerms(doc);
          setStatus(doc.financingStatus ?? DEFAULT_FINANCING_STATUS);
          setForm({
            agreed:        String(doc.agreedMonthlyFinancing ?? ''),
            current:       String(doc.currentMonthlyFinancing ?? ''),
            validatingAPI: String(doc.validatingAPI ?? ''),
            effectiveDate: doc.effectiveDate ?? '',
          });
        } else {
          setTerms(null);
          setStatus(DEFAULT_FINANCING_STATUS);
          setForm({ ...EMPTY_FORM, effectiveDate: getTodayTT() });
        }
      })
      .catch((e) => {
        if (latestAgentReqRef.current !== agentId) return; // stale — ignore
        console.error(e);
        toast.show({ variant: 'error', message: "Couldn't load financing terms." });
      })
      .finally(() => {
        if (latestAgentReqRef.current !== agentId) return; // stale — leave the newer request's loading state alone
        setLoadingTerms(false);
      });
  }, [tenantId, toast]);

  function handleSelectAgent(e) {
    const id = e.target.value;
    setSelectedAgent(id);
    loadTerms(id);
  }

  function agentName(id) {
    const a = agents.find((x) => x.id === id);
    return a?.name ?? a?.email ?? id;
  }

  // ── Save terms ──────────────────────────────────────────────────────────────
  async function handleSaveTerms(e) {
    e?.preventDefault?.();
    setValidationError('');
    if (!selectedAgent) { setValidationError('Select an agent.'); return; }

    const agreed   = parseFloat(form.agreed);
    const current  = parseFloat(form.current);
    const validApi = parseFloat(form.validatingAPI);

    if (isNaN(agreed) || agreed < 0)     { setValidationError('Enter a valid agreed monthly financing.'); return; }
    if (isNaN(current) || current < 0)   { setValidationError('Enter a valid current monthly financing.'); return; }
    if (isNaN(validApi) || validApi < 0) { setValidationError('Enter a valid validating API.'); return; }
    if (current > agreed)                { setValidationError('Current monthly financing can’t exceed the agreed maximum.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.effectiveDate)) { setValidationError('Select an effective date.'); return; }
    if (!tenantId) { setValidationError('Tenant context not ready. Please retry.'); return; }

    setSaving(true);
    const actor = { role, name: userProfile?.name ?? userProfile?.email ?? 'Manager' };
    try {
      const saved = await setFinancingTerms(
        tenantId, selectedAgent,
        { agreedMonthlyFinancing: agreed, currentMonthlyFinancing: current, validatingAPI: validApi, effectiveDate: form.effectiveDate },
        actor,
      );
      setTerms(saved);
      setStatus(saved.financingStatus ?? DEFAULT_FINANCING_STATUS);
      toast.show({ variant: 'success', message: `Financing terms saved for ${agentName(selectedAgent)}.` });
    } catch (err) {
      console.error(err);
      toast.show({ variant: 'error', message: "Couldn't save financing terms. Please retry." });
    } finally {
      setSaving(false);
    }
  }

  // ── Status transition (two-step confirm, forward-only) ──────────────────────
  async function handleTransition(toStatus) {
    if (pendingTransition !== toStatus) { setPendingTransition(toStatus); return; }
    if (!tenantId || !selectedAgent) return;
    setTransitioning(true);
    const actor = { role, name: userProfile?.name ?? userProfile?.email ?? 'Manager' };
    try {
      const updated = await transitionFinancingStatus(tenantId, selectedAgent, toStatus, actor);
      setTerms(updated);
      setStatus(updated.financingStatus);
      setPendingTransition('');
      toast.show({ variant: 'success', message: `Status → ${FINANCING_STATUS_LABELS[toStatus]} for ${agentName(selectedAgent)}.` });
    } catch (err) {
      console.error(err);
      toast.show({ variant: 'error', message: "Couldn't change status. Please retry." });
    } finally {
      setTransitioning(false);
    }
  }

  // ── Access guard (defense-in-depth; nav already excludes UM/agents) ─────────
  if (!canWrite) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">Financing terms are set by Branch Managers and above.</p>
      </div>
    );
  }

  const inputCls = 'h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full';
  const labelCls = 'block text-xs font-semibold text-ink-muted mb-1';

  const nextStatuses = allowedNextStatuses(status);
  const currentOverAgreed =
    form.agreed !== '' && form.current !== '' &&
    !isNaN(parseFloat(form.agreed)) && !isNaN(parseFloat(form.current)) &&
    parseFloat(form.current) > parseFloat(form.agreed);

  return (
    <div className="flex flex-col gap-6">
      {/* Agent selector */}
      <div className="card">
        <p className="text-sm font-semibold text-ink mb-3">Financing Terms</p>
        {loadingAgents ? (
          <div className="h-11 bg-border/30 rounded-lg animate-pulse" />
        ) : agentsError ? (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{agentsError}</div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-ink-muted">No agents in your scope yet. Add agents before setting financing terms.</p>
        ) : (
          <div>
            <label htmlFor="financing-agent" className={labelCls}>Agent</label>
            <select
              id="financing-agent"
              data-testid="financing-agent-select"
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

      {/* Terms form + status machine */}
      {selectedAgent && (
        loadingTerms ? (
          <div className="card"><div className="h-40 bg-border/30 rounded-lg animate-pulse" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
            {/* Terms form */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-ink">
                  Agreement · {agentName(selectedAgent)}
                </p>
                <FinancingStatusBadge status={status} />
              </div>

              <form onSubmit={handleSaveTerms} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="financing-agreed" className={labelCls}>Agreed monthly financing (TTD)</label>
                    <input
                      id="financing-agreed" data-testid="financing-agreed"
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={form.agreed}
                      onChange={(e) => setForm((f) => ({ ...f, agreed: e.target.value }))}
                      placeholder="0" className={inputCls}
                    />
                    <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-wide">Full / max draw</p>
                  </div>
                  <div>
                    <label htmlFor="financing-current" className={labelCls}>Current monthly financing (TTD)</label>
                    <input
                      id="financing-current" data-testid="financing-current"
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={form.current}
                      onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
                      placeholder="0" className={inputCls}
                    />
                    <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-wide">Tracked separately · clause 5 may adjust down</p>
                  </div>
                  <div>
                    <label htmlFor="financing-validating-api" className={labelCls}>Validating API (TTD)</label>
                    <input
                      id="financing-validating-api" data-testid="financing-validating-api"
                      type="number" min="0" step="0.01" inputMode="decimal"
                      value={form.validatingAPI}
                      onChange={(e) => setForm((f) => ({ ...f, validatingAPI: e.target.value }))}
                      placeholder="0" className={inputCls}
                    />
                    <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-wide">API for full financing · proration denominator</p>
                  </div>
                  <div>
                    <label htmlFor="financing-effective-date" className={labelCls}>Effective date</label>
                    <input
                      id="financing-effective-date" data-testid="financing-effective-date"
                      type="date"
                      value={form.effectiveDate}
                      onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                      className={inputCls}
                    />
                    <p className="text-[10px] text-ink-muted mt-1 uppercase tracking-wide">Anchors 24-mo term · 12-mo service · waiver clocks</p>
                  </div>
                </div>

                {currentOverAgreed && (
                  <p className="text-xs text-danger-ink" data-testid="financing-current-over-agreed">
                    Current monthly financing can’t exceed the agreed maximum.
                  </p>
                )}
                {validationError && <p className="text-xs text-danger-ink">{validationError}</p>}

                <SaveButton
                  onClick={handleSaveTerms}
                  saving={saving}
                  disabled={currentOverAgreed}
                  label={terms ? 'Update terms' : 'Save terms'}
                  className="self-start"
                />
              </form>
            </div>

            {/* Status machine control */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-ink">Financing status</p>
                <span className="text-[10px] font-bold uppercase tracking-wide text-gold bg-gold-tint rounded-full px-2 py-0.5">Manager-set</span>
              </div>

              {!terms ? (
                <p className="text-sm text-ink-muted">
                  Save financing terms first. The agent defaults to <span className="font-semibold text-ink">Not on financing</span> until terms exist.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-ink-muted">Current:</span>
                    <FinancingStatusBadge status={status} />
                  </div>

                  {nextStatuses.length === 0 ? (
                    <p className="text-xs text-ink-muted">Terminal state — no further transitions.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs font-semibold text-ink">Advance status <span className="font-normal text-ink-muted">(forward-only · gates all financing modules)</span></p>
                      <div className="flex flex-wrap gap-2">
                        {nextStatuses.map((s) => (
                          <button
                            key={s}
                            type="button"
                            data-testid={`financing-transition-${s}`}
                            onClick={() => handleTransition(s)}
                            disabled={transitioning}
                            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-primary/40 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/15 transition-colors disabled:opacity-50"
                          >
                            <ArrowRight size={15} aria-hidden="true" />
                            {FINANCING_STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                      {pendingTransition && (
                        <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg bg-surface-muted border border-border">
                          <span className="text-xs text-ink">
                            Set status to <span className="font-semibold">{FINANCING_STATUS_LABELS[pendingTransition]}</span>? This gates the agent’s financing modules.
                          </span>
                          <div className="flex gap-2 ml-auto">
                            <button
                              type="button"
                              onClick={() => setPendingTransition('')}
                              className="min-h-[44px] px-3 rounded-lg border border-border text-xs font-medium text-ink-muted hover:text-ink transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              data-testid="financing-transition-confirm"
                              onClick={() => handleTransition(pendingTransition)}
                              disabled={transitioning}
                              className="min-h-[44px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-xs font-bold hover:bg-primary-dark transition-colors disabled:opacity-50"
                            >
                              {transitioning ? 'Saving…' : 'Confirm'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    Terms in effect: agreed {formatCurrency(terms.agreedMonthlyFinancing)} · current {formatCurrency(terms.currentMonthlyFinancing)} · validating API {formatCurrency(terms.validatingAPI)}.
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
