// Track K · K7 — FinancingRiskPanel (BM branch financing roster + termination-risk
// monitor). DISPLAY ONLY.
//
// Reshaped from the pre-v2 single-agent dropdown into the mockup's branch view
// (docs/design-system/screens-v2/design_handoff_track_k/Track K Validation
// Dashboard - Manager Build.html): a per-agent roster fan-out with standing status
// chips, branch aggregate cards, the consecutive-miss + >10% downward-adjustment
// risk monitors, and the confirmed-draw / adjustment figures as a READ-ONLY table.
//
// DISPLAY-ONLY mandate (item 2.8): this surface renders standings, trajectories and
// status — it holds NO write path. The two WRITE actions the mockup draws are
// SKIP-LOGGED here, rendered as data/status only:
//   • the per-agent suggested→confirmed OVERRIDE (setFinancingProration — sets the
//     draw) — the drawer input is not built; the confirmed figure shows read-only.
//   • the clause-5.3 "Notify Sales Admin" action (notifyFinancingAdjustment CF) —
//     the >10% flag renders as a duty STATUS callout, not a wired button.
// Both remain available on their own write surfaces (Proration tab / a future
// notify item); this roster is the read view.
//
// Read route (read-light, index reasoning): financing docs are keyed
// financing/{agentId}_{YYYY_MM} and carry NO branchId field, and there is no
// composite index for a branch-wide financing query — so a single collection query
// by branchId is NOT schema-supported. The route is the Compliance-v2 per-agent
// fan-out: getTenantUsers self-scopes a BM to where('branchId','==',claims.branchId),
// then ONE getFinancingTerms + ONE listFinancingMonths per branch agent (each
// listFinancingMonths is an equality-only where('agentId','==',id) — no composite
// index needed). This mirrors the shipped K10a UnitFinancingRoster exactly.
//
// BM-and-up only (UM has its own read-only UnitFinancingRoster; nav gates, this
// guard is defense-in-depth). Pure verdict/roster math lives in
// lib/financingMissEngine (K7) + lib/unitFinancingRoster (K10a); this panel loads
// and renders.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, ShieldAlert, Lock, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTenantUsers } from '../../services/managerService';
import {
  getFinancingTerms,
  listFinancingMonths,
  financingCeiling,
  financingMonthIndex,
} from '../../services/financingService';
import { monthKeyFromDate, getTodayTT } from '../../utils/dateInputs';
import { formatCurrency, formatAdjustmentPct, initials } from '../../utils/formatters';
import { MISS_CRITICAL_AT } from '../../lib/financingMissEngine';
import {
  assembleRosterRow,
  computeRosterAggregates,
  deriveRosterRiskChip,
  isActivelyFinanced,
} from '../../lib/unitFinancingRoster';
import FinancingStatusBadge from './FinancingStatusBadge';
import PanelSkeleton from '../ui/PanelSkeleton';

// BM-and-up. UM is excluded (its own UnitFinancingRoster surface serves the unit).
// platform_admin (tenantId:null) has no tenant context to monitor.
const VIEW_ROLES = ['branch_manager', 'sales_manager', 'tenant_admin'];

// The financing DRAW window (SPEC §5: on_financing = months 1–12). Fixed contract
// clock, not the 24-month agreement term (that clock lives on the K9 self-view).
const FINANCING_DRAW_MONTHS = 12;

// Sort worst-risk first (critical miss > adj flag > amber miss > clean), then name.
function riskScore(row) {
  if (row.terminationConditionMet) return 3;
  if (row.hasAdjFlag) return 2;
  if (row.missSeverity !== 'none') return 1;
  return 0;
}

const CHIP_TONE = {
  success: 'bg-success/15 text-success-ink border border-success/30',
  warning: 'bg-warning/15 text-warning-ink border border-warning/30',
  danger:  'bg-danger/15 text-danger-ink border border-danger/30',
};

function StatusChip({ row }) {
  const chip = deriveRosterRiskChip(row);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide ${CHIP_TONE[chip.tone] ?? CHIP_TONE.success}`}
      data-testid={`financing-risk-status-${row.agentId}`}
      data-chip={chip.key}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${chip.tone === 'danger' ? 'bg-danger' : chip.tone === 'warning' ? 'bg-warning' : 'bg-success'}`} aria-hidden="true" />
      {chip.label}
    </span>
  );
}

function MissDots({ count }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {[1, 2, 3].map((i) => {
        const hit = i <= count;
        const critical = count >= MISS_CRITICAL_AT;
        return (
          <span
            key={i}
            className={[
              'h-8 w-8 rounded-lg border-2 flex items-center justify-center text-xs font-bold font-display',
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
      <p className={`mt-0.5 font-display text-lg font-extrabold tabular-nums ${toneCls}`} data-testid={testId}>{value}</p>
    </div>
  );
}

export default function FinancingRiskPanel() {
  const { role, tenantId } = useAuth();
  const [state, setState] = useState({ status: 'loading' });
  // Guards a stale fan-out completing after a newer load (e.g. Retry) from
  // overwriting fresh state — the deterministic replacement for the old
  // per-agent-switch race guard.
  const loadSeq = useRef(0);

  const canView = VIEW_ROLES.includes(role);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setState({ status: 'loading' });
    if (!tenantId) return;

    try {
      const users = await getTenantUsers(tenantId); // BM → self-scoped to own branch
      const agents = (users || []).filter((u) => u.role === 'agent');

      // Compliance-v2 fan-out: one terms + ledger read per branch agent. allSettled
      // so a single agent's failed read degrades to "resolved rows only", never a
      // whole-surface error. Order preserved by the input map.
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
        setState(anyFailed ? { status: 'error' } : { status: 'empty' });
        return;
      }

      // Aggregates ONLY from a fully-resolved read (never a branch total from a
      // partial fan-out — Compliance-v2).
      const aggregates = anyFailed ? null : computeRosterAggregates(rows);
      setState({ status: 'ready', rows, aggregates, partial: anyFailed });
    } catch (e) {
      if (seq !== loadSeq.current) return; // stale failure — a newer load owns the state
      console.error('[FinancingRiskPanel] load failed', e);
      setState({ status: 'error' });
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // ── Access guard (defense-in-depth) ─────────────────────────────────────────
  if (role && !canView) {
    return (
      <div className="card text-center py-10" data-testid="financing-risk-panel">
        <p className="text-sm text-ink-muted">The termination-risk monitor is available to Branch Managers and above.</p>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-4" data-testid="financing-risk-panel" data-loading="true">
        <PanelSkeleton variant="metric-row" />
        <PanelSkeleton variant="table" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-4" data-testid="financing-risk-panel" data-loading="false">
        <div role="alert" className="p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger-ink text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>We couldn&apos;t load your branch&apos;s financing right now. Nothing is shown rather than a partial picture.</span>
          <button
            type="button"
            onClick={load}
            data-testid="financing-risk-retry"
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
      <div className="flex flex-col gap-4" data-testid="financing-risk-panel" data-loading="false">
        <p className="text-sm font-semibold text-ink">New-Agent Financing — branch roster</p>
        <div className="p-8 rounded-xl border border-border bg-card-raised text-center" data-testid="financing-risk-empty">
          <p className="text-ink font-semibold mb-1">No agents on financing in your branch.</p>
          <p className="text-sm text-ink-muted">Agents appear here once their financing terms are set on the Terms tab.</p>
        </div>
      </div>
    );
  }

  const { rows, aggregates, partial } = state;
  const missRows = rows.filter((r) => r.missSeverity !== 'none');
  const flagRows = rows.filter((r) => r.hasAdjFlag);

  return (
    <div className="flex flex-col gap-5" data-testid="financing-risk-panel" data-loading="false">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="font-display font-extrabold text-lg text-ink">New-Agent Financing — branch roster</p>
        <span
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wide bg-card border border-border text-ink-muted"
          data-testid="financing-risk-readonly-tag"
        >
          <Lock size={11} aria-hidden="true" /> Read-only view · confirm &amp; notify on their own tabs
        </span>
      </div>

      {/* Partial-read notice — resolved rows only, no aggregates */}
      {partial && (
        <div className="p-3 rounded-xl border border-warning/30 bg-warning/10 text-warning-ink text-sm flex items-start gap-2" data-testid="financing-risk-partial">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>Some agents didn&apos;t load. Showing the agents that resolved — branch totals are hidden so nothing implies a complete picture from a partial read.</span>
        </div>
      )}

      {/* Reality strip — branch aggregates (only on a full read) */}
      {aggregates && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-5 flex-wrap" data-testid="financing-risk-reality">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted leading-tight">On<br />financing</span>
            <span className="font-display text-3xl font-extrabold text-ink tabular-nums" data-testid="frp-on-financing">{aggregates.onFinancing}</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <Stat label="Total drawn · branch" value={formatCurrency(aggregates.totalDrawn)} testId="frp-total-drawn" />
          <Stat label="Confirmed · this mo" value={formatCurrency(aggregates.confirmedThisMonth)} testId="frp-confirmed" />
          <div className="ml-auto flex items-center gap-5">
            <Stat label="At risk" value={aggregates.atRisk} tone={aggregates.atRisk ? 'warning' : 'ink'} testId="frp-at-risk" />
            <Stat label="≥2 misses" value={aggregates.twoPlusMisses} tone={aggregates.twoPlusMisses ? 'danger' : 'ink'} testId="frp-two-misses" />
            <Stat label=">10% adj flags" value={aggregates.adjWithBm} tone={aggregates.adjWithBm ? 'danger' : 'ink'} testId="frp-adj-flags" />
          </div>
        </div>
      )}

      {/* Termination-risk monitor — read-only, per flagged agent */}
      {(missRows.length > 0 || flagRows.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="financing-risk-monitor">
          {missRows.map((r) => (
            <div
              key={`miss-${r.agentId}`}
              className="rounded-xl border border-warning/30 bg-card overflow-hidden"
              data-testid={`financing-risk-miss-${r.agentId}`}
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
                      ? 'The 3rd confirmed miss meets the clause-7.2c termination condition — flag for review; the disposition is a human/admin decision.'
                      : 'Amber at 2 — a 3rd confirmed miss approaches the termination trigger. Provisional months show but never count.'}
                  </p>
                </div>
              </div>
              {r.terminationConditionMet && (
                <div className="mx-4 mb-4 rounded-lg bg-danger/10 border border-danger/30 p-3 flex gap-2" data-testid={`financing-risk-termination-${r.agentId}`}>
                  <ShieldAlert size={15} className="text-danger-ink shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-danger-ink leading-relaxed">
                    <span className="font-bold">Clause 7.2c condition met — not an automatic termination.</span>{' '}
                    Three consecutive confirmed misses meet the contract&apos;s termination condition. It is flagged for review; the disposition is a human/admin decision.
                  </p>
                </div>
              )}
            </div>
          ))}

          {flagRows.map((r) => (
            <div
              key={`adj-${r.agentId}`}
              className="rounded-xl border border-border bg-card overflow-hidden"
              data-testid={`financing-risk-adj-${r.agentId}`}
              data-month={r.adjFlagMonth ?? ''}
            >
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                <AlertTriangle size={15} className="text-danger-ink" aria-hidden="true" />
                <p className="text-sm font-semibold text-ink">Downward-adjustment flag — {r.agentName}</p>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-display text-3xl font-extrabold text-danger-ink tabular-nums" data-testid={`financing-risk-adj-pct-${r.agentId}`}>
                    {formatAdjustmentPct(r.adjFlagPct)}
                  </span>
                  <span className="text-sm text-ink-muted">Confirmed financing is cut more than 10% below the amount in effect (clause 5.3).</span>
                </div>
                <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 flex gap-2">
                  <Mail size={16} className="text-warning-ink shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-warning-ink leading-relaxed">
                    <span className="font-bold">Notification duty — not a termination.</span>{' '}
                    A &gt;10% downward adjustment obliges a Sales-Admin notification by the 1st. The agent stays on financing; this is a reporting step for the clause-5.3 paper trail.
                  </p>
                </div>
                {/* DISPLAY ONLY: the notify ACTION is skip-logged — shown as a duty status, not a wired button. */}
                <span
                  className="self-start inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wide bg-surface-muted text-ink-muted border border-border"
                  data-testid={`financing-risk-notify-status-${r.agentId}`}
                >
                  <Mail size={11} aria-hidden="true" /> Notify Sales Admin · duty open
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Roster — read-only figures */}
      <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="financing-risk-table">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card-raised flex-wrap">
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">Agents on financing · {rows.length}</span>
          <span className="ml-auto text-[11px] text-ink-muted">Confirmed draw &amp; adjustment % are set on the Proration tab — shown read-only</span>
        </div>
        <div
          className="overflow-x-auto"
          role="region"
          aria-label="Branch financing roster (scroll horizontally to see all columns)"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          <table className="w-full text-sm border-separate border-spacing-0 whitespace-nowrap">
            <thead>
              <tr className="bg-card-raised">
                {['#', 'Agent · status', 'Term · misses', 'Confirmed draw 🔒', 'Balance vs ceiling', 'Adj % 🔒'].map((h, i) => (
                  <th
                    key={h}
                    className={[
                      'py-2 px-3 font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted border-b border-border',
                      i === 0 ? 'text-center' : 'text-left',
                    ].join(' ')}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const rawMonthIdx = r.effectiveDate ? financingMonthIndex(r.effectiveDate, monthKeyFromDate(getTodayTT())) : null;
                const drawMonthIndex = rawMonthIdx != null && Number.isFinite(rawMonthIdx)
                  ? Math.max(1, Math.min(rawMonthIdx, FINANCING_DRAW_MONTHS))
                  : null;
                const ceilPct = (r.ceiling && r.runningBalance != null && r.ceiling > 0)
                  ? Math.max(0, Math.min(100, Math.round((r.runningBalance / r.ceiling) * 100)))
                  : null;
                return (
                  <tr key={r.agentId} data-testid={`financing-risk-row-${r.agentId}`} className={idx % 2 ? 'bg-card-raised' : ''}>
                    <td className="py-2.5 px-3 text-center font-display font-extrabold text-xs text-ink-muted border-b border-border tabular-nums">{idx + 1}</td>
                    <td className="py-2.5 px-3 border-b border-border">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-[11px] shrink-0">{initials(r.agentName)}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink truncate" title={r.agentName}>{r.agentName}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <FinancingStatusBadge status={r.status} />
                            <StatusChip row={r} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-b border-border">
                      <p className="font-mono text-[11px] text-ink-muted tabular-nums" data-testid={`financing-risk-term-${r.agentId}`}>{drawMonthIndex != null ? `Fin. month ${drawMonthIndex} / ${FINANCING_DRAW_MONTHS}` : '—'}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <MissDots count={r.missCount} />
                        <span className={`font-mono text-[10px] tabular-nums ${r.missSeverity === 'critical' ? 'text-danger-ink' : r.missSeverity === 'amber' ? 'text-warning-ink' : 'text-ink-muted'}`}>
                          {r.missCount} miss{r.missCount === 1 ? '' : 'es'} · confirmed
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-b border-border" data-testid={`financing-risk-draw-${r.agentId}`}>
                      <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2.5 py-1">
                        <Lock size={11} className="text-ink-muted" aria-hidden="true" />
                        <span className="font-display font-extrabold text-sm text-ink tabular-nums">{r.confirmedDraw != null ? formatCurrency(r.confirmedDraw) : '—'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 border-b border-border">
                      {r.runningBalance == null ? (
                        <span className="text-ink-muted">—</span>
                      ) : (
                        <div className="min-w-[120px]">
                          <p className={`font-display font-extrabold text-sm tabular-nums ${r.isSurplus ? 'text-success-ink' : r.overCeiling ? 'text-danger-ink' : 'text-ink'}`}>
                            {formatCurrency(r.runningBalance)}
                          </p>
                          <div className="mt-1 h-1.5 rounded bg-surface-muted overflow-hidden">
                            <div
                              className={`h-full rounded ${r.overCeiling ? 'bg-warning' : 'bg-primary'}`}
                              style={{ width: `${r.isSurplus ? 4 : (ceilPct ?? 0)}%` }}
                            />
                          </div>
                          <p className={`mt-0.5 font-mono text-[8px] tabular-nums ${r.isSurplus ? 'text-success-ink' : 'text-ink-muted'}`}>
                            {r.isSurplus ? 'surplus — owed to agent' : r.ceiling != null ? `${ceilPct ?? 0}% of ${formatCurrency(r.ceiling)} ceiling` : ''}
                          </p>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border-b border-border" data-testid={`financing-risk-adjcell-${r.agentId}`}>
                      <div className="inline-flex items-center gap-1">
                        <span className={`font-display font-extrabold text-sm tabular-nums ${r.hasAdjFlag ? 'text-danger-ink' : 'text-ink-muted'}`}>{formatAdjustmentPct(r.adjustmentPct)}</span>
                        {r.hasAdjFlag && <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />}
                      </div>
                      <p className="font-mono text-[8px] text-ink-muted uppercase mt-0.5">{r.hasAdjFlag ? 'notify due' : r.adjustmentPct ? 'confirmed' : 'at full'}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
