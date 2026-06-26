// Track K · K7 — FinancingRiskPanel (Risk sub-view of the financing tab).
//
// The termination-risk monitor (manager Validation Dashboard mockup, K7 portion):
//   • the 7.2c consecutive-miss counter on the CONFIRMED basis (amber at 2,
//     critical at 3 = the termination CONDITION met) — FLAG ONLY: K7 never
//     auto-terminates, never changes financingStatus, never touches
//     LEGAL_TRANSITIONS. The disposition stays with a human/admin.
//   • the clause-5.3 >10% downward-adjustment flag → the BM-notify duty, fired
//     via the manager-confirmed "Notify Sales Admin" affordance (server-side
//     recipient resolution, 24h cooldown). Disabled "no recipient configured"
//     when the tenant has not set financingConfig.notifyRecipientUid.
//
// Pure verdict math lives in lib/financingMissEngine; this panel loads the agent
// ledger + config and renders. BM-and-up only (UM excluded — contract 5.3; nav
// gates, the guard here is defense-in-depth). The roster / status chips /
// aggregate stat cards / per-agent table from the mockup are K8's dashboard.
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AlertTriangle, Mail, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import useToast from '../../hooks/useToast';
import { getTenantUsers } from '../../services/managerService';
import { listFinancingMonths } from '../../services/financingService';
import { getFinancingConfig } from '../../services/financingConfigService';
import {
  notifyFinancingAdjustment,
  getFinancingNotifyRecord,
  FINANCING_NOTIFY_COOLDOWN_MS,
} from '../../services/financingNotifyService';
import {
  computeConsecutiveMisses,
  findAdjustmentFlags,
  MISS_CRITICAL_AT,
} from '../../lib/financingMissEngine';

const WRITE_ROLES = ['branch_manager', 'sales_manager', 'tenant_admin', 'platform_admin'];

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const monthLabel = (key) => {
  if (typeof key !== 'string' || !/^\d{4}_\d{2}$/.test(key)) return key ?? '—';
  const [y, m] = key.split('_');
  return `${MON[Number(m) - 1] ?? m} ${y.slice(2)}`;
};
// adjustmentPct > 0 is a cut BELOW the amount in effect → shown −X%.
const cutLabel = (frac) => {
  const n = parseFloat(frac);
  if (!Number.isFinite(n)) return '—';
  return `−${Math.round(Math.abs(n) * 100)}%`;
};

// One progress dot toward the 3-consecutive-miss (7.2c) trigger.
function dotClass(i, count, severity) {
  if (count >= MISS_CRITICAL_AT) {
    return i <= MISS_CRITICAL_AT
      ? 'bg-danger/15 border-danger text-danger-ink'
      : 'border-border text-ink-muted';
  }
  if (i <= count) {
    return severity === 'amber'
      ? 'bg-warning/15 border-warning text-warning-ink'
      : 'bg-warning/10 border-warning/50 text-warning-ink';
  }
  if (i === count + 1) return 'border-dashed border-danger text-danger bg-card';
  return 'border-border text-ink-muted';
}

function MissDots({ count, severity }) {
  return (
    <div className="flex gap-2" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-10 w-10 rounded-xl border-2 flex items-center justify-center text-sm font-extrabold font-display ${dotClass(i, count, severity)}`}
        >
          {i}
        </div>
      ))}
    </div>
  );
}

export default function FinancingRiskPanel() {
  const { role, tenantId } = useAuth();
  const toast = useToast();

  const [agents, setAgents]               = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentsError, setAgentsError]     = useState('');

  const [selectedAgent, setSelectedAgent] = useState('');
  const [months, setMonths]               = useState([]);   // financing ledger rows
  const [recipientUid, setRecipientUid]   = useState(null); // configured notify recipient
  const [loading, setLoading]             = useState(false);

  const [notifyRecord, setNotifyRecord]   = useState(null); // active-flag cooldown millis | null
  const [notifying, setNotifying]         = useState(false);

  const latestAgentReqRef = useRef('');
  const canWrite = WRITE_ROLES.includes(role);

  const inputCls = 'h-11 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 w-full';
  const labelCls = 'block text-xs font-semibold text-ink-muted mb-1';

  const agentName = useCallback(
    (id) => {
      const a = agents.find((x) => x.id === id);
      return a?.name ?? a?.email ?? 'the agent';
    },
    [agents],
  );

  // ── Derived verdicts (pure engine) ──────────────────────────────────────────
  const missResult = useMemo(() => computeConsecutiveMisses(months), [months]);
  const flags = useMemo(() => findAdjustmentFlags(months), [months]);
  const activeFlag = flags.length > 0 ? flags[flags.length - 1] : null;

  // ── Load agents (mirror FinancingProrationPanel) ────────────────────────────
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

  // ── Load the selected agent's ledger + the tenant notify recipient ──────────
  const loadAgent = useCallback((agentId) => {
    latestAgentReqRef.current = agentId;
    setNotifyRecord(null);
    if (!tenantId || !agentId) { setMonths([]); setRecipientUid(null); setLoading(false); return; }
    setLoading(true);
    Promise.all([
      listFinancingMonths(tenantId, agentId),
      getFinancingConfig(tenantId),
    ])
      .then(([ledger, cfg]) => {
        if (latestAgentReqRef.current !== agentId) return;
        setMonths(ledger || []);
        setRecipientUid(cfg?.notifyRecipientUid ?? null);
      })
      .catch((e) => {
        if (latestAgentReqRef.current !== agentId) return;
        console.error(e);
        toast.show({ variant: 'error', message: "Couldn't load the agent's financing data." });
      })
      .finally(() => { if (latestAgentReqRef.current === agentId) setLoading(false); });
  }, [tenantId, toast]);

  const handleSelectAgent = (e) => {
    const id = e.target.value;
    setSelectedAgent(id);
    loadAgent(id);
  };

  // ── Cooldown read for the active flagged month (deterministic-ID GET) ────────
  useEffect(() => {
    let cancelled = false;
    if (!tenantId || !selectedAgent || !activeFlag?.month) { setNotifyRecord(null); return undefined; }
    getFinancingNotifyRecord(tenantId, selectedAgent, activeFlag.month)
      .then((millis) => { if (!cancelled) setNotifyRecord(millis); })
      .catch(() => { if (!cancelled) setNotifyRecord(null); });
    return () => { cancelled = true; };
  }, [tenantId, selectedAgent, activeFlag?.month]);

  const onCooldown = notifyRecord != null && (Date.now() - notifyRecord) < FINANCING_NOTIFY_COOLDOWN_MS;
  const recipientConfigured = !!recipientUid;

  const handleNotify = async () => {
    if (!activeFlag || !recipientConfigured || onCooldown || notifying) return;
    const firedAgent = selectedAgent; // pin the target against an agent switch mid-flight
    setNotifying(true);
    try {
      const res = await notifyFinancingAdjustment(firedAgent, activeFlag.month, {
        adjustmentPct: activeFlag.adjustmentPct,
        monthLabel: monthLabel(activeFlag.month),
        agentName: agentName(firedAgent),
      });
      if (res?.success) {
        // Only stamp the cooldown if the panel still shows the agent we fired for —
        // an agent switch mid-request must not paint a cooldown chip on the new view.
        if (latestAgentReqRef.current === firedAgent) setNotifyRecord(Date.now());
        toast.show({ variant: 'success', message: 'Sales Admin notified — clause 5.3 duty logged.' });
      } else if (res?.reason === 'no-recipient') {
        toast.show({ variant: 'error', message: 'No notify recipient configured for this tenant.' });
      } else if (res?.reason === 'recipient-not-found') {
        toast.show({ variant: 'error', message: 'The configured recipient no longer exists — update the financing config.' });
      } else {
        toast.show({ variant: 'error', message: 'Notify failed. Please try again.' });
      }
    } catch (e) {
      console.error('[FinancingRiskPanel] notify failed:', e);
      toast.show({ variant: 'error', message: 'Notify failed. Please try again.' });
    } finally {
      setNotifying(false);
    }
  };

  // ── Access guard (defense-in-depth) ─────────────────────────────────────────
  if (!canWrite) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">The termination-risk monitor is available to Branch Managers and above.</p>
      </div>
    );
  }

  const missSeverity = missResult.severity;
  const missAccent =
    missSeverity === 'critical' ? 'text-danger-ink'
    : missSeverity === 'amber' ? 'text-warning-ink'
    : 'text-ink';

  return (
    <div className="flex flex-col gap-6">
      {/* Agent selector */}
      <div className="card">
        <p className="text-sm font-semibold text-ink mb-3">Termination-risk monitor</p>
        {loadingAgents ? (
          <div className="h-11 bg-border/30 rounded-lg animate-pulse" />
        ) : agentsError ? (
          <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">{agentsError}</div>
        ) : agents.length === 0 ? (
          <p className="text-sm text-ink-muted">No agents in your scope yet.</p>
        ) : (
          <div>
            <label htmlFor="risk-agent" className={labelCls}>Agent</label>
            <select
              id="risk-agent"
              data-testid="financing-risk-agent-select"
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
        ) : months.length === 0 ? (
          <div className="card">
            <p className="text-sm text-ink-muted">
              No financing ledger for {agentName(selectedAgent)} yet. Confirm a month on the{' '}
              <span className="font-semibold text-ink">Proration</span> tab — the monitor reads the confirmed
              monthly determinations.
            </p>
          </div>
        ) : (
          <>
            {/* ── Consecutive-miss monitor ─────────────────────────────────── */}
            <div
              className="card flex flex-col gap-4"
              data-testid="financing-risk-miss-monitor"
              data-severity={missSeverity}
              data-count={missResult.count}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {missSeverity === 'critical'
                    ? <ShieldAlert size={16} className="text-danger-ink" aria-hidden="true" />
                    : missSeverity === 'amber'
                      ? <AlertTriangle size={16} className="text-warning-ink" aria-hidden="true" />
                      : null}
                  <p className="text-sm font-semibold text-ink">Consecutive-miss monitor — {agentName(selectedAgent)}</p>
                </div>
                <span className="inline-flex items-center text-[10px] font-bold tracking-widest uppercase font-mono px-2 py-1 rounded-full bg-primary/10 text-primary">
                  Confirmed basis
                </span>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <MissDots count={missResult.count} severity={missSeverity} />
                <div className="flex-1 min-w-[180px]">
                  <p className={`text-base font-extrabold font-display ${missAccent}`}>
                    {missResult.count === 0
                      ? 'No consecutive misses'
                      : `${missResult.count} consecutive miss${missResult.count === 1 ? '' : 'es'}`}
                  </p>
                  <p className="text-xs text-ink-muted mt-1">
                    {missSeverity === 'critical'
                      ? 'The 3rd confirmed miss meets the clause-7.2c termination condition.'
                      : missSeverity === 'amber'
                        ? 'Amber at 2 — the 3rd confirmed miss approaches the termination trigger. Coach now.'
                        : 'On the confirmed basis (pending months hold the count, never reset it).'}
                  </p>
                </div>
              </div>

              {missResult.terminationConditionMet && (
                <div
                  className="rounded-lg bg-danger/10 border border-danger/30 p-3 flex gap-2"
                  data-testid="financing-risk-termination-flag"
                >
                  <ShieldAlert size={16} className="text-danger-ink shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-danger-ink leading-relaxed">
                    <span className="font-bold">Clause 7.2c condition met — not an automatic termination.</span>{' '}
                    Three consecutive confirmed misses meet the contract's termination condition. K7 flags it for
                    review; the disposition is a human/admin decision outside this monitor.
                  </p>
                </div>
              )}
            </div>

            {/* ── Clause-5.3 >10% downward-adjustment flag + notify duty ────── */}
            {activeFlag ? (
              <div
                className="card flex flex-col gap-4"
                data-testid="financing-risk-adjustment-flag"
                data-month={activeFlag.month}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-danger-ink" aria-hidden="true" />
                  <p className="text-sm font-semibold text-ink">Downward-adjustment flag — {agentName(selectedAgent)}</p>
                </div>

                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="text-3xl font-extrabold font-display text-danger-ink" data-testid="financing-risk-adjustment-pct">
                    {cutLabel(activeFlag.adjustmentPct)}
                  </span>
                  <span className="text-sm text-ink-muted">
                    Confirmed financing for <span className="font-semibold text-ink">{monthLabel(activeFlag.month)}</span> is
                    cut more than 10% below the amount in effect (clause 5.3).
                  </span>
                </div>

                <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 flex gap-2">
                  <Mail size={16} className="text-warning-ink shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-warning-ink leading-relaxed">
                    <span className="font-bold">Notification duty — not a termination.</span>{' '}
                    A &gt;10% downward adjustment obliges you to notify Sales Admin. The agent stays on financing;
                    this is a reporting step, logged for the clause-5.3 paper trail.
                  </p>
                </div>

                {/* Notify affordance — disabled when no recipient, on cooldown, or in flight */}
                {!recipientConfigured ? (
                  <div
                    className="flex items-center gap-2 text-xs text-ink-muted"
                    data-testid="financing-notify-no-recipient"
                  >
                    <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
                    No recipient configured — a tenant admin must set the financing notify recipient before this duty can be discharged.
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={handleNotify}
                      disabled={onCooldown || notifying}
                      data-testid="financing-notify-btn"
                      className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg text-sm font-semibold text-white bg-primary dark:bg-primary-dark hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Mail size={15} aria-hidden="true" />
                      {notifying ? 'Notifying…' : 'Notify Sales Admin'}
                    </button>
                    {onCooldown && (
                      <span className="text-xs text-ink-muted" data-testid="financing-notify-cooldown">
                        Notified — re-enables in 24h.
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="card">
                <p className="text-sm text-ink-muted">
                  No &gt;10% downward adjustments flagged. Routine proration does not raise the clause-5.3 duty.
                </p>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
