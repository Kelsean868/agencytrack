// Track K · K10a — UnitFinancingRoster (UM view + coach, read-only).
//
// The Unit Manager's team-financing surface: the same financing signals a Branch
// Manager works, scoped to the UM's OWN unit and dialled down to view + escalate.
// The UM SEES every status, balance, miss streak and >10% adjustment flag and can
// COACH; confirming draws, the clause-5.3 Sales-Admin notify, status changes and
// reconciliation stay with the Branch Manager.
//
// RE-SCOPE (K10a): there is no shipped K8 BM roster to role-gate — K8 was never
// built (recon @ 2d34de2d; git history K1–K7,K9, no K8). This BUILDS the unit
// roster fresh from the shipped single-agent engines + a fan-out, in a NEW UM-only
// read-only surface (distinct nav tabId `unit-financing`, never the BM `financing`
// tab). EscalateToBM (tracked/ack collection) is DEFERRED to K10b.
//
// Security posture (a): a UM reads their unit's agents' financing via canManage
// (which already admits a UM on every financing read arm) + UI fan-out scoping.
// Unit membership comes from getTenantUsers, which self-scopes a UM to
// where('unitId','==',callerUid). NO rules/schema/migration change. Documented
// residual: a UM with a raw out-of-unit agentId could read that financing doc at
// the rules layer (the SAME residual settlements carry) — but this surface never
// surfaces out-of-unit agents (the fan-out only ever iterates the UM's unit).
//
// Fan-out = per-agent GETs (Compliance-v2 pattern). On PARTIAL failure: show the
// resolved rows ONLY and suppress the unit aggregates — never imply a complete
// unit picture (or a trigger count) from a partial read.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, AlertTriangle, ShieldAlert, MessageSquare, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTenantUsers } from '../../services/managerService';
import {
  getFinancingTerms,
  listFinancingMonths,
  financingCeiling,
} from '../../services/financingService';
import { computeMonthsFromDate } from '../../utils/dateInputs';
import { formatCurrency, formatAdjustmentPct, initials } from '../../utils/formatters';
import { MISS_CRITICAL_AT } from '../../lib/financingMissEngine';
import {
  assembleRosterRow,
  computeRosterAggregates,
  isActivelyFinanced,
} from '../../lib/unitFinancingRoster';
import FinancingStatusBadge from '../manager/FinancingStatusBadge';
import CoachingNotesModal from '../manager/CoachingNotesModal';
import AgentFinancingDrawer from './AgentFinancingDrawer';

const AGREEMENT_TERM_MONTHS = 12; // the year-1 financing term (contract) — display only.

// Sort worst-risk first (critical miss > adj flag > amber miss > clean), then name.
function riskScore(row) {
  if (row.terminationConditionMet) return 3;
  if (row.hasAdjFlag) return 2;
  if (row.missSeverity !== 'none') return 1;
  return 0;
}

function MissDots({ count }) {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {[1, 2, 3].map((i) => {
        const hit = i <= count;
        const critical = count >= MISS_CRITICAL_AT;
        return (
          <span
            key={i}
            className={[
              'h-4 w-4 rounded-md border flex items-center justify-center text-[9px] font-bold font-display',
              hit
                ? critical
                  ? 'bg-danger/15 border-danger text-danger-ink'
                  : 'bg-warning/15 border-warning text-warning-ink'
                : 'border-border text-ink-muted',
            ].join(' ')}
          >
            {i}
          </span>
        );
      })}
    </div>
  );
}

function Stat({ label, value, tone = 'ink', testId }) {
  const toneCls = tone === 'warning' ? 'text-warning-ink' : tone === 'danger' ? 'text-danger-ink' : 'text-ink';
  return (
    <div className="text-right">
      <p className="font-mono text-[8.5px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className={`mt-0.5 font-display text-lg font-extrabold ${toneCls}`} data-testid={testId}>{value}</p>
    </div>
  );
}

export default function UnitFinancingRoster({ tenantId }) {
  const { role } = useAuth();
  const [state, setState] = useState({ status: 'loading' });
  const [drawerRow, setDrawerRow] = useState(null);
  const [coachTarget, setCoachTarget] = useState(null);
  // Guards against a stale fan-out completing after a newer load (e.g. a slow
  // mount-load resolving after a Retry) and overwriting fresh state.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setState({ status: 'loading' });
    if (!tenantId) return;

    try {
      const users = await getTenantUsers(tenantId); // UM → self-scoped to own unit
      const agents = (users || []).filter((u) => u.role === 'agent');

      // Fan-out: one terms + ledger read per unit agent. allSettled so a single
      // agent's failed read degrades to "resolved rows only", never a whole-surface error.
      const settled = await Promise.allSettled(
        agents.map(async (agent) => {
          const [terms, ledger] = await Promise.all([
            getFinancingTerms(tenantId, agent.id),
            listFinancingMonths(tenantId, agent.id),
          ]);
          return { agent, terms, ledger };
        }),
      );

      let anyFailed = false;
      const rows = [];
      settled.forEach((res) => {
        if (res.status === 'rejected') { anyFailed = true; return; }
        const { agent, terms, ledger } = res.value;
        if (!isActivelyFinanced(terms)) return; // not on financing → not on the roster
        const ceiling = financingCeiling(terms.currentMonthlyFinancing);
        rows.push(assembleRosterRow({ agent, terms, ledger: ledger ?? [], ceiling }));
      });

      rows.sort((a, b) => (riskScore(b) - riskScore(a)) || a.agentName.localeCompare(b.agentName));

      if (seq !== loadSeq.current) return; // a newer load superseded this one

      if (rows.length === 0) {
        // A total fan-out failure (some agents failed, none resolved) is an error,
        // not a legitimate "empty unit".
        setState(anyFailed ? { status: 'error' } : { status: 'empty' });
        return;
      }

      // Aggregates are computed ONLY from a fully-resolved read (Compliance-v2:
      // never a unit total from a partial fan-out).
      const aggregates = anyFailed ? null : computeRosterAggregates(rows);
      setState({ status: 'ready', rows, aggregates, partial: anyFailed });
    } catch (e) {
      if (seq !== loadSeq.current) return; // stale failure — a newer load owns the state
      console.error('[UnitFinancingRoster] load failed', e);
      setState({ status: 'error' });
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Defense-in-depth: the nav gates this to unit_manager, and getTenantUsers only
  // UNIT-scopes for a UM (a BM would get a branch-wide list mislabeled "unit"). The
  // render switch itself is not role-gated, so guard here.
  if (role && role !== 'unit_manager') {
    return (
      <div className="card text-center py-10" data-testid="unit-financing-roster" data-loading="false">
        <p className="text-sm text-ink-muted">Unit Financing is the Unit Manager's view of their own unit. Branch Managers use the full Financing tab.</p>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-4" data-testid="unit-financing-roster" data-loading="true">
        <div className="h-8 w-48 rounded-lg bg-border/40 animate-pulse" />
        <div className="h-16 rounded-xl bg-border/30 animate-pulse" />
        <div className="h-40 rounded-xl bg-border/30 animate-pulse" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-4" data-testid="unit-financing-roster" data-loading="false">
        <div className="p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger-ink text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>We couldn't load your unit's financing right now. Nothing is shown rather than a partial picture.</span>
          <button
            type="button"
            onClick={load}
            data-testid="unit-financing-retry"
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (state.status === 'empty') {
    return (
      <div className="flex flex-col gap-4" data-testid="unit-financing-roster" data-loading="false">
        <Topbar />
        <div className="p-8 rounded-xl border border-border bg-card-raised text-center" data-testid="unit-financing-empty">
          <p className="text-ink font-semibold mb-1">No agents on financing in your unit.</p>
          <p className="text-sm text-ink-muted">New agents appear here once your Branch Manager sets their financing terms.</p>
        </div>
      </div>
    );
  }

  const { rows, aggregates, partial } = state;
  const missRows = rows.filter((r) => r.missSeverity !== 'none');
  const flagRows = rows.filter((r) => r.hasAdjFlag);

  return (
    <div className="flex flex-col gap-5" data-testid="unit-financing-roster" data-loading="false">
      <Topbar />

      {/* Partial-read notice — resolved rows only, no aggregates */}
      {partial && (
        <div className="p-3 rounded-xl border border-warning/30 bg-warning/10 text-warning-ink text-sm flex items-start gap-2" data-testid="unit-financing-partial">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>Some agents didn't load. Showing the agents that resolved — unit totals are hidden so nothing implies a complete picture from a partial read.</span>
        </div>
      )}

      {/* Reality strip — unit aggregates (only on a full read) */}
      {aggregates && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-5 flex-wrap" data-testid="unit-financing-reality">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted leading-tight">On<br />financing</span>
            <span className="font-display text-3xl font-extrabold text-ink" data-testid="ufr-on-financing">{aggregates.onFinancing}</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <Stat label="Total drawn · unit" value={formatCurrency(aggregates.totalDrawn)} testId="ufr-total-drawn" />
          <Stat label="Confirmed · this mo" value={formatCurrency(aggregates.confirmedThisMonth)} testId="ufr-confirmed" />
          <div className="ml-auto flex items-center gap-5">
            <Stat label="At risk" value={aggregates.atRisk} tone={aggregates.atRisk ? 'warning' : 'ink'} testId="ufr-at-risk" />
            <Stat label="≥2 misses" value={aggregates.twoPlusMisses} tone={aggregates.twoPlusMisses ? 'danger' : 'ink'} testId="ufr-two-misses" />
            <Stat label=">10% adj · with BM" value={aggregates.adjWithBm} tone={aggregates.adjWithBm ? 'danger' : 'ink'} testId="ufr-adj-bm" />
          </div>
        </div>
      )}

      {/* Risk monitor — read-only, per flagged agent */}
      {(missRows.length > 0 || flagRows.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="unit-financing-monitor">
          {missRows.map((r) => (
            <div
              key={`miss-${r.agentId}`}
              className="rounded-xl border border-warning/30 bg-card overflow-hidden"
              data-testid={`unit-financing-miss-${r.agentId}`}
              data-severity={r.missSeverity}
              data-count={r.missCount}
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-warning/10">
                {r.terminationConditionMet
                  ? <ShieldAlert size={15} className="text-danger-ink" aria-hidden="true" />
                  : <AlertTriangle size={15} className="text-warning-ink" aria-hidden="true" />}
                <p className="text-sm font-semibold text-ink">Consecutive-miss monitor — {r.agentName}</p>
                <span className="ml-auto font-mono text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">Confirmed basis</span>
              </div>
              <div className="p-4 flex items-center gap-3 flex-wrap">
                <MissDots count={r.missCount} />
                <div className="flex-1 min-w-[160px]">
                  <p className={`font-display text-sm font-extrabold ${r.terminationConditionMet ? 'text-danger-ink' : 'text-warning-ink'}`}>
                    {r.missCount} consecutive miss{r.missCount === 1 ? '' : 'es'}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {r.terminationConditionMet
                      ? 'The 3rd confirmed miss meets the clause-7.2c termination condition — coach and escalate.'
                      : 'Coach now — a 3rd confirmed miss approaches the termination trigger. Provisional months show but never count.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCoachTarget(r)}
                  data-testid={`unit-financing-coach-miss-${r.agentId}`}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <MessageSquare size={14} aria-hidden="true" /> Coach
                </button>
              </div>
            </div>
          ))}

          {flagRows.map((r) => (
            <div
              key={`adj-${r.agentId}`}
              className="rounded-xl border border-border bg-card overflow-hidden"
              data-testid={`unit-financing-adj-${r.agentId}`}
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                <AlertTriangle size={15} className="text-danger-ink" aria-hidden="true" />
                <p className="text-sm font-semibold text-ink">Downward-adjustment flag — {r.agentName}</p>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-display text-2xl font-extrabold text-danger-ink" data-testid={`unit-financing-adj-pct-${r.agentId}`}>
                    {formatAdjustmentPct(r.adjFlagPct)}
                  </span>
                  <span className="text-sm text-ink-muted">Confirmed draw is more than 10% below the agreed schedule (clause 5.3).</span>
                </div>
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-surface-muted border border-border">
                  <Lock size={13} className="text-ink-muted shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-ink-muted leading-relaxed">
                    The notify duty is your <span className="font-semibold text-ink">Branch Manager's</span> — a &gt;10% cut obliges the BM to notify Sales Admin.
                    You see the flag so you can coach on production; the agent stays on financing.
                  </p>
                </div>
                <span
                  className="self-start inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wide bg-surface-muted text-ink-muted border border-border"
                  data-testid={`unit-financing-notify-status-${r.agentId}`}
                >
                  <Lock size={10} aria-hidden="true" /> Notify Sales Admin · with Branch Manager
                </span>
                <button
                  type="button"
                  onClick={() => setCoachTarget(r)}
                  data-testid={`unit-financing-coach-adj-${r.agentId}`}
                  className="self-start min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <MessageSquare size={14} aria-hidden="true" /> Coach
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Roster */}
      <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="unit-financing-table">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card-raised flex-wrap">
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">Agents on financing · {rows.length}</span>
          <span className="ml-auto text-[11px] text-ink-muted">Confirmed draw &amp; adjustment % are set by your Branch Manager — shown read-only</span>
        </div>
        <div
          className="overflow-x-auto"
          role="region"
          aria-label="Unit financing roster (scroll horizontally to see all columns)"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <table className="w-full text-sm border-separate border-spacing-0 whitespace-nowrap">
            <thead>
              <tr className="bg-card-raised">
                {['#', 'Agent · status', 'Term · misses', 'Confirmed draw 🔒', 'Balance vs ceiling', 'Adj % 🔒', 'Act'].map((h, i) => (
                  <th
                    key={h}
                    className={[
                      'py-2 px-3 font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted border-b border-border',
                      i === 0 ? 'text-center' : i === 6 ? 'text-right' : 'text-left',
                    ].join(' ')}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const serviceMonths = r.effectiveDate ? Math.min(computeMonthsFromDate(r.effectiveDate), AGREEMENT_TERM_MONTHS) : null;
                const ceilPct = (r.ceiling && r.runningBalance != null && r.ceiling > 0)
                  ? Math.max(0, Math.min(100, Math.round((r.runningBalance / r.ceiling) * 100)))
                  : null;
                return (
                  <tr key={r.agentId} data-testid={`unit-financing-row-${r.agentId}`} className={idx % 2 ? 'bg-card-raised' : ''}>
                    <td className="py-2.5 px-3 text-center font-display font-extrabold text-xs text-ink-muted border-b border-border">{idx + 1}</td>
                    <td className="py-2.5 px-3 border-b border-border">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-[11px] shrink-0">{initials(r.agentName)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{r.agentName}</p>
                          <div className="mt-0.5"><FinancingStatusBadge status={r.status} /></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-b border-border">
                      <p className="font-mono text-[11px] text-ink-muted">{serviceMonths != null ? `Month ${serviceMonths} / ${AGREEMENT_TERM_MONTHS}` : '—'}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <MissDots count={r.missCount} />
                        <span className={`font-mono text-[10px] ${r.missSeverity === 'critical' ? 'text-danger-ink' : r.missSeverity === 'amber' ? 'text-warning-ink' : 'text-ink-muted'}`}>
                          {r.missCount} miss{r.missCount === 1 ? '' : 'es'} · confirmed
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-b border-border" data-testid={`unit-financing-draw-${r.agentId}`}>
                      <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 py-1">
                        <Lock size={11} className="text-ink-muted" aria-hidden="true" />
                        <span className="font-display font-extrabold text-sm text-ink">{r.confirmedDraw != null ? formatCurrency(r.confirmedDraw) : '—'}</span>
                        <span className="font-mono text-[8px] text-ink-muted uppercase">BM</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-b border-border">
                      {r.runningBalance == null ? (
                        <span className="text-ink-muted">—</span>
                      ) : (
                        <div className="min-w-[120px]">
                          <p className={`font-display font-extrabold text-sm ${r.isSurplus ? 'text-success-ink' : r.overCeiling ? 'text-danger-ink' : 'text-ink'}`}>
                            {formatCurrency(r.runningBalance)}
                          </p>
                          <div className="mt-1 h-1.5 rounded bg-surface-muted overflow-hidden">
                            <div
                              className={`h-full rounded ${r.overCeiling ? 'bg-warning' : 'bg-primary'}`}
                              style={{ width: `${r.isSurplus ? 4 : (ceilPct ?? 0)}%` }}
                            />
                          </div>
                          <p className={`mt-0.5 font-mono text-[8px] ${r.isSurplus ? 'text-success-ink' : 'text-ink-muted'}`}>
                            {r.isSurplus ? 'surplus — owed to agent' : r.ceiling != null ? `${ceilPct ?? 0}% of ${formatCurrency(r.ceiling)} ceiling` : ''}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center border-b border-border" data-testid={`unit-financing-adjcell-${r.agentId}`}>
                      <div className="inline-flex items-center gap-1">
                        <span className={`font-display font-extrabold text-sm ${r.hasAdjFlag ? 'text-danger-ink' : 'text-ink-muted'}`}>{formatAdjustmentPct(r.adjustmentPct)}</span>
                        {r.hasAdjFlag && <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />}
                      </div>
                      <p className="font-mono text-[8px] text-ink-muted uppercase mt-0.5">{r.hasAdjFlag ? 'with BM' : r.adjustmentPct ? 'confirmed' : 'at full'}</p>
                    </td>
                    <td className="py-2.5 px-3 border-b border-border">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCoachTarget(r)}
                          data-testid={`unit-financing-coach-${r.agentId}`}
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 rounded-lg bg-primary/10 text-primary border border-primary/30 text-xs font-bold hover:bg-primary/15 transition-colors"
                        >
                          <MessageSquare size={13} aria-hidden="true" /> Coach
                        </button>
                        <button
                          type="button"
                          onClick={() => setDrawerRow(r)}
                          data-testid={`unit-financing-view-${r.agentId}`}
                          className="min-h-[36px] inline-flex items-center px-2.5 rounded-lg bg-card border border-border text-ink text-xs font-bold hover:bg-surface transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {drawerRow && (
        <AgentFinancingDrawer
          row={drawerRow}
          onClose={() => setDrawerRow(null)}
          onCoach={(r) => { setDrawerRow(null); setCoachTarget(r); }}
        />
      )}

      {coachTarget && (
        <CoachingNotesModal
          agentId={coachTarget.agentId}
          agentName={coachTarget.agentName}
          agentUnitId={coachTarget.agentUnitId}
          onClose={() => setCoachTarget(null)}
        />
      )}
    </div>
  );
}

function Topbar() {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <h2 className="font-display font-extrabold text-lg text-ink">Unit Financing</h2>
      <span
        className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wide bg-card border border-border text-ink-muted"
        data-testid="unit-financing-readonly-tag"
      >
        <Lock size={11} aria-hidden="true" /> Read-only · confirm &amp; notify with your BM
      </span>
    </div>
  );
}
