// Track K · K6 — FinancingReconciliationPanel (Reconciliation sub-view of the
// financing tab).
//
// The year-1 wind-down event (or earlier on a 6.5b election). Per agent it shows the
// wind-down clocks (24-month term · 12-month service / waiver-earned · first-3-months
// waiver window), and — driven by the agent's financingStatus — one of:
//   • on_financing            → begin-reconciliation control (month-12 auto OR an
//                               explicit early-election 6.5b) → on_financing → reconciling
//   • reconciling             → the worksheet (drawn − offsets − waiver = closing),
//                               the service-gated waiver readout, and the two outcome
//                               cards (OWING garnish / SURPLUS lump-sum); the outcome
//                               button writes the record + drives reconciling → terminal
//   • post_financing_repayment → the 6.2 garnish projection (months-to-cleared) + a
//                               manager-confirmed "mark cleared" once the authoritative
//                               runningBalance reaches <= 0
//   • cleared                 → the settled record (read-only)
//
// The reconciliation MATH is the pure lib (src/lib/financingReconciliation.js); the
// WRITE + status transitions ride financingService (K1's machine — never re-implemented
// here). BM-and-up only (unit_manager excluded — contract 5.3; nav gates, this guard is
// defense-in-depth). Internal agent dropdown mirrors FinancingProrationPanel.
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import SaveButton from '../ui/SaveButton';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import { getTenantUsers } from '../../services/managerService';
import {
  getFinancingTerms,
  listFinancingMonths,
  getFinancingReconciliation,
  reconcileFinancing,
  transitionFinancingStatus,
  setFinancingMonth,
} from '../../services/financingService';
import {
  computeReconciliation,
  computeGarnishProjection,
  computeWindDownClocks,
  reconMonthIndex,
} from '../../lib/financingReconciliation';
import { computeMonthsFromDate, getTodayTT, monthKeyFromDate, enumerateMonthKeys } from '../../utils/dateInputs';
import { formatCurrency } from '../../utils/formatters';
import FinancingStatusBadge from './FinancingStatusBadge';

const WRITE_ROLES = ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "YYYY_MM" plus N whole months (mirrors enumerateMonthKeys' internal ordinal math —
// kept local so this panel adds no new exported date helper). Used to derive the
// auto_month12 reconciliation month (effectiveDate-month + 11 = ledger month 12).
function monthKeyPlus(key, n) {
  const [y, m] = (key || '').split('_').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return key;
  const total = (y * 12 + (m - 1)) + n;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}_${String((total % 12) + 1).padStart(2, '0')}`;
}

// Human label for a "YYYY_MM" key ("2026_05" → "May 2026").
function monthLabel(key) {
  const [y, m] = (key || '').split('_');
  const idx = parseInt(m, 10) - 1;
  return MONTH_NAMES[idx] ? `${MONTH_NAMES[idx]} ${y}` : key;
}

export default function FinancingReconciliationPanel() {
  const { userProfile, role, tenantId } = useAuth();
  const toast = useToast();

  const [agents, setAgents]               = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentsError, setAgentsError]     = useState('');

  const [selectedAgent, setSelectedAgent] = useState('');
  const [terms, setTerms]                 = useState(null);  // financingTerms doc
  const [months, setMonths]               = useState([]);    // K2 ledger rows
  const [record, setRecord]               = useState(null);  // existing reconciliation record
  const [loading, setLoading]             = useState(false);

  const [earlyElection, setEarlyElection] = useState(false); // 6.5b opt-in (service < 12)
  const [busy, setBusy]                   = useState(false);
  const [actionError, setActionError]     = useState('');

  // K6 amendment — gap-fill (no silent assume-zero). gapEdits holds ONLY the fields the
  // manager has changed (sparse, keyed by monthKey); the displayed value falls back to a
  // synchronous pre-fill default (see gapDefaults) so the field is populated on first
  // render — no empty-flash, no render race. confirmingGap = month-key mid-write.
  const [gapEdits, setGapEdits]           = useState({});  // { [monthKey]: { field: value } } — overrides only
  const [confirmingGap, setConfirmingGap] = useState('');  // monthKey mid-write
  const [gapError, setGapError]           = useState('');

  // Latest-request guard (money-write hazard parity with the proration panel).
  const latestAgentReqRef = useRef('');

  const canWrite = WRITE_ROLES.includes(role);
  const actor = useMemo(
    () => ({ role, name: userProfile?.name ?? userProfile?.email ?? 'Manager' }),
    [role, userProfile],
  );

  // ── Load agents ─────────────────────────────────────────────────────────────
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

  // Reconciliation year = the year of the latest entered ledger month, else this TT year.
  const reconYear = useMemo(() => {
    const latest = months.reduce((a, b) => (a && a.month >= b.month ? a : b), null);
    return latest?.month ? latest.month.slice(0, 4) : getTodayTT().slice(0, 4);
  }, [months]);

  // ── Load the selected agent's terms + ledger + any existing record ───────────
  const loadAgent = useCallback((agentId) => {
    latestAgentReqRef.current = agentId;
    setEarlyElection(false);
    setActionError('');
    setGapEdits({});
    setGapError('');
    // Clear the prior agent's data immediately (Gemini) — no stale terms/months/record
    // while the new agent loads, and no stale data left behind if the load fails.
    setTerms(null);
    setMonths([]);
    setRecord(null);
    if (!tenantId || !agentId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getFinancingTerms(tenantId, agentId),
      listFinancingMonths(tenantId, agentId),
    ])
      .then(async ([termsDoc, ledger]) => {
        if (latestAgentReqRef.current !== agentId) return;
        setTerms(termsDoc);
        setMonths(ledger || []);
        // Best-effort fetch of an existing record for the latest ledger year.
        const latest = (ledger || []).reduce((a, b) => (a && a.month >= b.month ? a : b), null);
        const year = latest?.month ? latest.month.slice(0, 4) : getTodayTT().slice(0, 4);
        let rec = null;
        try {
          rec = await getFinancingReconciliation(tenantId, agentId, year);
        } catch (e) {
          console.error('Failed to fetch financing reconciliation record:', e);
        }
        if (latestAgentReqRef.current === agentId) setRecord(rec);
      })
      .catch((e) => {
        if (latestAgentReqRef.current !== agentId) return;
        console.error(e);
        toast.show({ variant: 'error', message: "Couldn't load the agent's financing data." });
      })
      .finally(() => { if (latestAgentReqRef.current === agentId) setLoading(false); });
  }, [tenantId, toast]);

  function handleSelectAgent(e) {
    const id = e.target.value;
    setSelectedAgent(id);
    loadAgent(id);
  }

  function agentName(id) {
    const a = agents.find((x) => x.id === id);
    return a?.name ?? a?.email ?? id;
  }

  const status = terms?.financingStatus ?? 'not_on_financing';

  const serviceMonths = useMemo(
    () => (terms?.effectiveDate ? computeMonthsFromDate(terms.effectiveDate) : 0),
    [terms],
  );
  const triggeredBy = serviceMonths >= 12 ? 'auto_month12' : 'manual_election';

  // K6 amendment — gap detection (no silent assume-zero). The reconciliation month
  // (end-bound) is the LATER of the trigger month (auto_month12 → effectiveDate-month + 11
  // = ledger month 12; manual_election → current TT month) and the latest entered ledger
  // month, so trailing gaps before the event are surfaced too. enumerateMonthKeys over
  // [effectiveDate-month … end-bound] minus the entered set = the gaps. detectSkippedMonths
  // is deliberately NOT used here — it bounds at the latest-entered month and would miss
  // trailing gaps (the exact case this amendment fixes).
  const reconMonthKey = useMemo(() => {
    if (!terms?.effectiveDate) return null;
    try {
      const anchor = monthKeyFromDate(terms.effectiveDate);
      const triggerKey = triggeredBy === 'auto_month12'
        ? monthKeyPlus(anchor, 11)
        : monthKeyFromDate(getTodayTT());
      const latestEntered = months.reduce((a, b) => (a && a.month >= b.month ? a : b), null)?.month;
      return [triggerKey, latestEntered].filter(Boolean).reduce((a, b) => (a >= b ? a : b));
    } catch {
      return null;
    }
  }, [terms, months, triggeredBy]);

  const gapKeys = useMemo(() => {
    if (!terms?.effectiveDate || !reconMonthKey) return [];
    try {
      const anchor = monthKeyFromDate(terms.effectiveDate);
      const entered = new Set(months.map((m) => m.month).filter(Boolean));
      return enumerateMonthKeys(anchor, reconMonthKey).filter((k) => !entered.has(k));
    } catch {
      return [];
    }
  }, [terms, months, reconMonthKey]);

  // Synchronous pre-fill defaults per gap: flows = 0; runningBalance = the chronologically-
  // preceding ENTERED month's runningBalance (carry-forward). Computed in render (a useMemo,
  // not an effect) so the field is populated the first frame the gap card appears — no flash,
  // no race. The manager must still affirmatively confirm — a pre-fill silently accepted does
  // not count (Decision 3); gapEdits captures any manual change on top of these defaults.
  const gapDefaults = useMemo(() => {
    const carry = (gapKey) => {
      const prior = months
        .filter((m) => typeof m.month === 'string' && m.month < gapKey
          && m.runningBalance != null && Number.isFinite(parseFloat(m.runningBalance)))
        .reduce((a, b) => (a && a.month >= b.month ? a : b), null);
      return prior ? parseFloat(prior.runningBalance) : 0;
    };
    const out = {};
    for (const k of gapKeys) {
      out[k] = {
        financingPaid: '0', netCommission: '0', bonusOffset: '0',
        runningBalance: String(carry(k)), notes: '',
      };
    }
    return out;
  }, [gapKeys, months]);

  // Effective field value = manager edit (if any) over the synchronous default.
  const gapValue = (key, field) => gapEdits[key]?.[field] ?? gapDefaults[key]?.[field] ?? '';

  const clocks = useMemo(
    () => computeWindDownClocks({ serviceMonths, currentMonthlyFinancing: terms?.currentMonthlyFinancing }),
    [serviceMonths, terms],
  );

  // Live reconciliation readout (drives the worksheet + outcome cards while reconciling).
  const readout = useMemo(() => {
    if (!terms) return null;
    return computeReconciliation({ rows: months, effectiveDate: terms.effectiveDate, serviceMonths, triggeredBy });
  }, [terms, months, serviceMonths, triggeredBy]);

  // Garnish projection for the post-financing wind-down.
  const garnish = useMemo(() => {
    const owing = record?.reconciledPosition ?? readout?.reconciledPosition ?? 0;
    return computeGarnishProjection({ rows: months, reconciledPosition: owing });
  }, [months, record, readout]);

  // Authoritative balance for the post-financing cleared-detection (latest statement).
  const latestBalance = useMemo(() => {
    const latest = months.filter((m) => m.runningBalance != null).reduce((a, b) => (a && a.month >= b.month ? a : b), null);
    return latest ? parseFloat(latest.runningBalance) : null;
  }, [months]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleBegin() {
    setActionError('');
    if (serviceMonths < 12 && !earlyElection) {
      setActionError('Confirm the early-election (6.5b) checkbox to reconcile before 12 months.');
      return;
    }
    setBusy(true);
    try {
      await transitionFinancingStatus(tenantId, selectedAgent, 'reconciling', actor,
        `K6 begin reconciliation (${triggeredBy})`);
      loadAgent(selectedAgent);
      toast.show({ variant: 'success', message: `Reconciliation opened for ${agentName(selectedAgent)}.` });
    } catch (err) {
      console.error(err);
      setActionError("Couldn't open reconciliation. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSettle() {
    setActionError('');
    if (!readout) { setActionError('Reconciliation not ready. Please retry.'); return; }
    setBusy(true);
    try {
      await reconcileFinancing(tenantId, selectedAgent, reconYear, readout, actor);
      loadAgent(selectedAgent);
      toast.show({
        variant: 'success',
        message: readout.outcome === 'surplus'
          ? `Cleared — ${formatCurrency(readout.surplusPaid)} surplus paid to ${agentName(selectedAgent)}.`
          : `Garnish started — ${formatCurrency(readout.reconciledPosition)} owing for ${agentName(selectedAgent)}.`,
      });
    } catch (err) {
      console.error(err);
      setActionError("Couldn't write the reconciliation record. Status not advanced — please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkCleared() {
    setActionError('');
    setBusy(true);
    try {
      await transitionFinancingStatus(tenantId, selectedAgent, 'cleared', actor, 'K6 balance cleared (manager-confirmed)');
      loadAgent(selectedAgent);
      toast.show({ variant: 'success', message: `Financing cleared for ${agentName(selectedAgent)}.` });
    } catch (err) {
      console.error(err);
      setActionError("Couldn't mark cleared. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  // ── Gap-fill (K6 amendment) ──────────────────────────────────────────────────
  function updateGapField(key, field, value) {
    setGapEdits((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  // Badge a gap that moves the reconciliation math: the reconciliation/closing month
  // ("affects closing"), or months 1–3 ("affects waiver"). Middle gaps are unbadged
  // (completeness only). Closing takes precedence when a month is both.
  function gapBadge(key) {
    if (key === reconMonthKey) return { label: 'affects closing', cls: 'bg-danger/15 text-danger-ink' };
    const idx = reconMonthIndex(terms?.effectiveDate, key);
    if (idx !== null && idx >= 1 && idx <= 3) return { label: 'affects waiver', cls: 'bg-gold/15 text-gold-ink' };
    return null;
  }

  // Write one confirmed gap month through the deployed K2 path (source flag set), then
  // reload so the month drops out of the gap list and the worksheet recomputes.
  async function handleConfirmGap(monthKey) {
    setGapError('');
    const draft = { ...gapDefaults[monthKey], ...gapEdits[monthKey] };
    if (!gapDefaults[monthKey]) return;
    setConfirmingGap(monthKey);
    try {
      await setFinancingMonth(tenantId, selectedAgent, monthKey, {
        financingPaid:  draft.financingPaid,
        netCommission:  draft.netCommission,
        bonusOffset:    draft.bonusOffset,
        runningBalance: draft.runningBalance,
        notes:          draft.notes,
        source:         'reconciliation_gap_fill',
      }, actor);
      toast.show({ variant: 'success', message: `Confirmed ${monthLabel(monthKey)} for ${agentName(selectedAgent)}.` });
      loadAgent(selectedAgent);
    } catch (err) {
      console.error(err);
      setGapError(`Couldn't confirm ${monthLabel(monthKey)}. Please retry.`);
    } finally {
      setConfirmingGap('');
    }
  }

  // ── Access guard (defense-in-depth) ─────────────────────────────────────────
  if (!canWrite) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">Financing reconciliation is managed by Branch Managers and above.</p>
      </div>
    );
  }

  const inputCls = 'h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full';
  const labelCls = 'block text-xs font-semibold text-ink-muted mb-1';

  return (
    <div className="flex flex-col gap-6">
      {/* Agent selector */}
      <div className="card">
        <p className="text-sm font-semibold text-ink mb-3">Reconciliation — settle the year</p>
        {loadingAgents ? (
          <div className="h-11 bg-border/30 rounded-lg animate-pulse" />
        ) : agentsError ? (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{agentsError}</div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-ink-muted">No agents in your scope yet.</p>
        ) : (
          <div>
            <label htmlFor="recon-agent" className={labelCls}>Agent</label>
            <select
              id="recon-agent"
              data-testid="recon-agent-select"
              value={selectedAgent}
              onChange={handleSelectAgent}
              className={inputCls}
              // Lock the selector while any write is in flight (Gemini) — switching agents
              // mid-transaction (begin/settle/mark-cleared OR a gap confirm) would desync the
              // dropdown against the data the resolving write reloads.
              disabled={busy || !!confirmingGap}
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
              wind-down clocks and the waiver window.
            </p>
          </div>
        ) : (
          <>
            {/* Status + wind-down clocks */}
            <div className="card" data-testid="recon-clocks">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <FinancingStatusBadge status={status} />
                <p className="text-sm font-semibold text-ink">{agentName(selectedAgent)}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Clock_ label="Agreement term" value={`${clocks.serviceMonths} / ${clocks.agreementTermMonths} mo`} sub={`${clocks.termMonthsRemaining} mo remaining`} />
                <Clock_ label="Service" value={clocks.serviceMet ? '12 mo met' : `${clocks.serviceMonths} mo`} sub={clocks.serviceMet ? 'waiver earned' : 'waiver not yet earned'} highlight={clocks.serviceMet} />
                <Clock_ label="Waiver window" value={`${clocks.waiverWindowMonths} months`} sub="first-3-months (6.6)" />
                <Clock_ label="6× ceiling" value={clocks.ceiling != null ? formatCurrency(clocks.ceiling) : '—'} sub="vs current financing" />
              </div>
            </div>

            {/* not_on_financing — nothing to reconcile */}
            {status === 'not_on_financing' && (
              <div className="card" data-testid="recon-none">
                <p className="text-sm text-ink-muted">
                  {agentName(selectedAgent)} is not on financing — there is nothing to reconcile.
                </p>
              </div>
            )}

            {/* on_financing — begin reconciliation */}
            {status === 'on_financing' && readout && (
              <div className="card" data-testid="recon-begin">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-primary" aria-hidden="true" />
                  <p className="text-sm font-semibold text-ink">
                    {serviceMonths >= 12 ? 'Month-12 reached — ready to reconcile' : 'Early election (6.5b)'}
                  </p>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed mb-4">
                  {serviceMonths >= 12
                    ? 'The agent has reached 12 months’ continuous service. The first-3-months waiver applies. Begin reconciliation to compute the closing position.'
                    : 'The agent has not yet reached 12 months’ service. An early election makes the first 3 months’ financing repayable — the waiver does not apply.'}
                </p>
                {serviceMonths < 12 && (
                  <label className="flex items-start gap-2 mb-4 text-xs text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid="recon-early-election"
                      checked={earlyElection}
                      onChange={(e) => setEarlyElection(e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>Confirm early election (6.5b) — first 3 months become repayable.</span>
                  </label>
                )}
                {actionError && <p className="text-xs text-danger-ink mb-2" data-testid="recon-action-error">{actionError}</p>}
                <SaveButton onClick={handleBegin} saving={busy} label="Begin reconciliation" className="self-start" />
              </div>
            )}

            {/* reconciling — gap-fill guard + worksheet + outcome */}
            {status === 'reconciling' && readout && (
              <>
                {/* Gap-fill (K6 amendment): no silent assume-zero. Confirm each missing
                    month — including a genuine $0 — before reconciling. */}
                {gapKeys.length > 0 && (
                  <div className="card border border-warning/40" data-testid="recon-gaps">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} className="text-warning" aria-hidden="true" />
                      <p className="text-sm font-semibold text-ink">
                        {gapKeys.length} missing {gapKeys.length === 1 ? 'month' : 'months'} — confirm before reconciling
                      </p>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed mb-4">
                      Reconciliation runs over a complete ledger. Each missing month must be confirmed — including a
                      genuine $0 — so an assumed zero is never silently used. Confirm each month to write its
                      authoritative statement; the worksheet recomputes as the ledger fills.
                    </p>
                    <div className="flex flex-col gap-3">
                      {gapKeys.map((key) => {
                        const badge = gapBadge(key);
                        return (
                          <div key={key} className="rounded-lg border border-border p-3" data-testid={`recon-gap-${key}`}>
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <p className="text-sm font-semibold text-ink">{monthLabel(key)}</p>
                              {badge && (
                                <span className={['font-mono text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full', badge.cls].join(' ')}>
                                  {badge.label}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                              <GapField id={`gap-${key}-fp`} label="Financing paid"  value={gapValue(key, 'financingPaid')}  onChange={(v) => updateGapField(key, 'financingPaid', v)} />
                              <GapField id={`gap-${key}-nc`} label="Net commission"  value={gapValue(key, 'netCommission')}  onChange={(v) => updateGapField(key, 'netCommission', v)} />
                              <GapField id={`gap-${key}-bo`} label="Bonus offset"    value={gapValue(key, 'bonusOffset')}    onChange={(v) => updateGapField(key, 'bonusOffset', v)} />
                              <GapField id={`gap-${key}-rb`} label="Running balance" value={gapValue(key, 'runningBalance')} onChange={(v) => updateGapField(key, 'runningBalance', v)} />
                            </div>
                            <SaveButton
                              onClick={() => handleConfirmGap(key)}
                              saving={confirmingGap === key}
                              disabled={!!confirmingGap}
                              label="Confirm month"
                              className="self-start"
                            />
                          </div>
                        );
                      })}
                    </div>
                    {gapError && <p className="text-xs text-danger-ink mt-3" data-testid="recon-gap-error">{gapError}</p>}
                  </div>
                )}

                <div className="card" data-testid="recon-worksheet" data-outcome={readout.outcome}>
                  <p className="text-sm font-semibold text-ink mb-3">Worksheet · drawn vs offsets</p>
                  {gapKeys.length > 0 && (
                    <p className="text-[11px] text-warning-ink mb-3" data-testid="recon-worksheet-preliminary">
                      Preliminary — {gapKeys.length} unconfirmed {gapKeys.length === 1 ? 'month' : 'months'}. Confirm the missing months above for an accurate close.
                    </p>
                  )}
                  <WsRow label="Total financing drawn" sub="Σ financingPaid" value={formatCurrency(readout.totalFinancingDrawn)} />
                  <WsRow label="− Total offsets" sub="from the monthly statements" value={`− ${formatCurrency(readout.totalOffsets)}`} tone="success" />
                  <WsRow label="Gross position before waiver" value={formatCurrency(readout.closingBalance)} bold />
                  <WsRow
                    label="− First-3-months waiver"
                    sub={readout.serviceMet ? 'applied at 12-mo service (6.6)' : 'not applied — service < 12 mo (repayable)'}
                    value={`− ${formatCurrency(readout.waiverApplied)}`}
                    tone="waive"
                  />
                  <div
                    className={[
                      'flex items-center justify-between gap-3 mt-2 p-3 rounded-lg border',
                      readout.outcome === 'owing'
                        ? 'bg-danger/10 border-danger/30'
                        : 'bg-success/10 border-success/30',
                    ].join(' ')}
                    data-testid="recon-closing"
                  >
                    <p className="text-sm font-extrabold text-ink">Closing position</p>
                    <p className={['text-xl font-extrabold', readout.outcome === 'owing' ? 'text-danger-ink' : 'text-success-ink'].join(' ')}>
                      {readout.outcome === 'owing'
                        ? `${formatCurrency(readout.reconciledPosition)} owing`
                        : `${formatCurrency(readout.surplusPaid)} surplus`}
                    </p>
                  </div>
                </div>

                {/* Outcome action */}
                <div className="card" data-testid="recon-outcome">
                  {readout.outcome === 'owing' ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-full bg-warning/15 text-warning-ink">▼ Owing</span>
                        <p className="text-sm font-semibold text-ink">Post-financing garnish</p>
                      </div>
                      <p className="text-xs text-ink-muted leading-relaxed">
                        {formatCurrency(readout.reconciledPosition)} still owed after the waiver — repaid by the 6.2 garnish
                        (10% of commissions + 50% of net bonuses, monthly), not a lump demand. The incentive-payments
                        component has no ledger source today and is omitted from the projection.
                      </p>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-ink-muted">
                        <span>reconciling</span><ArrowRight size={12} aria-hidden="true" />
                        <span className="px-2 py-0.5 rounded-full bg-warning text-white">post_financing_repayment</span>
                      </div>
                      {actionError && <p className="text-xs text-danger-ink" data-testid="recon-action-error">{actionError}</p>}
                      {gapKeys.length > 0 && (
                        <p className="text-[11px] text-warning-ink" data-testid="recon-gated-owing">
                          Confirm the {gapKeys.length} missing {gapKeys.length === 1 ? 'month' : 'months'} above before reconciling.
                        </p>
                      )}
                      <SaveButton onClick={handleSettle} saving={busy} disabled={gapKeys.length > 0} label="Start garnish · write record" className="self-start" />
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-full bg-success/15 text-success-ink">▲ Surplus</span>
                        <p className="text-sm font-semibold text-ink">Clear + pay lump sum</p>
                      </div>
                      <p className="text-xs text-ink-muted leading-relaxed">
                        Offsets exceeded draws — {formatCurrency(readout.surplusPaid)} is owed back to {agentName(selectedAgent)} and
                        paid as a single lump sum. Financing closes at zero; the 50% split stops next bonus.
                      </p>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-ink-muted">
                        <span>reconciling</span><ArrowRight size={12} aria-hidden="true" />
                        <span className="px-2 py-0.5 rounded-full bg-success text-white">cleared</span>
                      </div>
                      {actionError && <p className="text-xs text-danger-ink" data-testid="recon-action-error">{actionError}</p>}
                      {gapKeys.length > 0 && (
                        <p className="text-[11px] text-warning-ink" data-testid="recon-gated-surplus">
                          Confirm the {gapKeys.length} missing {gapKeys.length === 1 ? 'month' : 'months'} above before reconciling.
                        </p>
                      )}
                      <SaveButton onClick={handleSettle} saving={busy} disabled={gapKeys.length > 0} label="Clear + pay surplus" className="self-start" />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* post_financing_repayment — garnish projection + mark cleared */}
            {status === 'post_financing_repayment' && (
              <div className="card" data-testid="recon-garnish">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-warning" aria-hidden="true" />
                  <p className="text-sm font-semibold text-ink">6.2 garnish — winding down</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <Clock_ label="Owed" value={formatCurrency(record?.reconciledPosition ?? 0)} sub="from reconciliation" />
                  <Clock_ label="Est. monthly garnish" value={garnish.monthlyGarnish > 0 ? formatCurrency(garnish.monthlyGarnish) : '—'} sub={`avg over ${garnish.basisMonths} mo`} />
                  <Clock_ label="Months to clear" value={garnish.monthsToCleared != null ? String(garnish.monthsToCleared) : '—'} sub="projection (display only)" />
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed mb-4">
                  The projection estimates the wind-down (10% commissions + 50% net bonuses). The actual balance is
                  driven by the monthly statement’s authoritative running balance — when it reaches zero, confirm cleared.
                </p>
                {latestBalance != null && latestBalance <= 0 ? (
                  <>
                    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-success/10 border border-success/30 mb-3" data-testid="recon-cleared-ready">
                      <p className="text-xs font-semibold text-ink">Latest statement balance is {formatCurrency(latestBalance)} — cleared?</p>
                    </div>
                    {actionError && <p className="text-xs text-danger-ink mb-2" data-testid="recon-action-error">{actionError}</p>}
                    <SaveButton onClick={handleMarkCleared} saving={busy} label="Mark cleared" className="self-start" />
                  </>
                ) : (
                  <p className="text-xs text-ink-muted" data-testid="recon-still-owing">
                    Latest statement balance: {latestBalance != null ? formatCurrency(latestBalance) : '—'} — garnish continues.
                  </p>
                )}
              </div>
            )}

            {/* cleared — settled record */}
            {status === 'cleared' && (
              <div className="card" data-testid="recon-settled">
                <div className="flex items-center gap-2 mb-3">
                  <span className="font-mono text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-full bg-success/15 text-success-ink">Cleared</span>
                  <p className="text-sm font-semibold text-ink">Financing settled</p>
                </div>
                {record ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Clock_ label="Outcome" value={record.outcome === 'surplus' ? 'Surplus' : 'Owing'} />
                    <Clock_ label="Closing" value={formatCurrency(record.reconciledPosition)} />
                    <Clock_ label="Waiver applied" value={formatCurrency(record.waiverApplied)} />
                    <Clock_ label="Surplus paid" value={formatCurrency(record.surplusPaid)} />
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">This agent’s financing is cleared.</p>
                )}
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

// Small KPI tile (clock / readout cell).
function Clock_({ label, value, sub, highlight = false }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={['text-lg font-extrabold', highlight ? 'text-success-ink' : 'text-ink'].join(' ')}>{value}</p>
      {sub && <p className="text-[10px] text-ink-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// Gap-fill numeric input (K6 amendment). 44px touch target (h-11), decimal keypad.
function GapField({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1">{label}</label>
      <input
        id={id}
        data-testid={id}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full"
      />
    </div>
  );
}

// Worksheet line.
function WsRow({ label, sub, value, tone, bold = false }) {
  const toneCls = tone === 'success' ? 'text-success-ink' : tone === 'waive' ? 'text-gold-ink' : 'text-ink';
  return (
    <div className={['flex items-center justify-between gap-3 py-2.5 border-b border-border', bold ? 'font-semibold' : ''].join(' ')}>
      <div>
        <p className="text-sm text-ink">{label}</p>
        {sub && <p className="text-[10px] font-mono text-ink-muted mt-0.5">{sub}</p>}
      </div>
      <p className={['font-mono text-sm font-bold whitespace-nowrap', bold ? 'text-ink' : toneCls].join(' ')}>{value}</p>
    </div>
  );
}
