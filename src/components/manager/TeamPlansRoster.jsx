// PR-GPM1 — TeamPlansRoster (UM/BM read-only view of consent-shared Money Needs).
//
// Makes the agent's "Share with my Unit Manager & Branch Manager" toggle honest:
// a shared worksheet actually lands in front of the UM/BM. The G5 rules arms
// (firestore.rules moneyNeeds block, PR #354) grant the read; this surface ONLY
// renders the DERIVED coaching projection (see projectSharedWorksheet in
// moneyNeedsService — K9-style allow-list; expense line items and sub-calculator
// internals never reach components, let alone the DOM).
//
// Consent posture: every unit/branch agent gets a row. Shared rows show the
// headline SHOWN figures + View; not-shared rows show a NEUTRAL "Not shared"
// state — opting in is the agent's call, so there is no nudge copy and a
// manager cannot distinguish "not shared" from "no worksheet" (the service maps
// permission-denied to notShared by design).
//
// Fan-out = per-agent GETs (K10a UnitFinancingRoster pattern): allSettled, on
// PARTIAL failure show the resolved rows ONLY and suppress the shared-count
// summary — never imply a complete team picture from a partial read.
//
// TA/PA: no rules read arm exists, and this surface is never mounted for them —
// PRODUCING_MANAGER_NAV only routes unit_manager/branch_manager, and the role
// guard below is defense-in-depth on top of that.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EyeOff, RefreshCw, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getTenantUsers } from '../../services/managerService';
import { getSharedMoneyNeeds } from '../../services/moneyNeedsService';
import { formatCurrency, initials } from '../../utils/formatters';
import AgentPlanDrawer from './AgentPlanDrawer';
import CoachingNotesModal from './CoachingNotesModal';

const CURRENT_YEAR = new Date().getFullYear();
const ALLOWED_ROLES = ['unit_manager', 'branch_manager'];

export default function TeamPlansRoster({ tenantId }) {
  const { role } = useAuth();
  const [state, setState] = useState({ status: 'loading' });
  const [drawerRow, setDrawerRow] = useState(null);
  const [coachTarget, setCoachTarget] = useState(null);
  // Guards against a stale fan-out completing after a newer load and
  // overwriting fresh state (K10a pattern).
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setState({ status: 'loading' });
    if (!tenantId) return;

    try {
      const users = await getTenantUsers(tenantId); // UM → own unit, BM → own branch (role-scoping free)
      const agents = (users || []).filter((u) => u.role === 'agent');

      // Fan-out: one consent-gated worksheet read per agent. allSettled so a
      // single agent's failed read degrades to resolved-rows-only, never a
      // whole-surface error. A notShared result is a RESOLVED row, not a failure.
      const settled = await Promise.allSettled(
        agents.map(async (agent) => {
          const result = await getSharedMoneyNeeds(tenantId, agent.id, CURRENT_YEAR);
          return { agent, result };
        }),
      );

      let anyFailed = false;
      const rows = [];
      settled.forEach((res) => {
        if (res.status === 'rejected') { anyFailed = true; return; }
        const { agent, result } = res.value;
        rows.push({
          agentId: agent.id,
          agentName: agent.name || agent.displayName || agent.email || agent.id,
          agentUnitId: agent.unitId ?? null,
          shared: result.shared === true,
          plan: result.shared === true ? result.plan : null,
        });
      });

      // Shared plans first, then name — the coachable rows lead.
      rows.sort((a, b) => (Number(b.shared) - Number(a.shared)) || a.agentName.localeCompare(b.agentName));

      if (seq !== loadSeq.current) return; // a newer load superseded this one

      if (rows.length === 0) {
        // A total fan-out failure (some agents failed, none resolved) is an
        // error, not a legitimate "empty team".
        setState(anyFailed ? { status: 'error' } : { status: 'empty' });
        return;
      }

      setState({ status: 'ready', rows, partial: anyFailed });
    } catch (e) {
      if (seq !== loadSeq.current) return; // stale failure — a newer load owns the state
      console.error('[TeamPlansRoster] load failed', e);
      setState({ status: 'error' });
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Defense-in-depth: the nav gates this to UM/BM (TA/PA have no rules read arm
  // and never route through PRODUCING_MANAGER_NAV), but the render switch itself
  // is not role-gated, so guard here too.
  if (role && !ALLOWED_ROLES.includes(role)) {
    return (
      <div className="card text-center py-10" data-testid="team-plans-roster" data-loading="false">
        <p className="text-sm text-ink-muted">Team Plans is the Unit and Branch Manager view of worksheets agents chose to share.</p>
      </div>
    );
  }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-4" data-testid="team-plans-roster" data-loading="true">
        <div className="h-8 w-48 rounded-lg bg-border/40 animate-pulse" />
        <div className="h-16 rounded-xl bg-border/30 animate-pulse" />
        <div className="h-40 rounded-xl bg-border/30 animate-pulse" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="flex flex-col gap-4" data-testid="team-plans-roster" data-loading="false">
        <Topbar />
        <div className="p-4 rounded-xl border border-danger/30 bg-danger/10 text-danger-ink text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>We couldn't load your team's plans right now. Nothing is shown rather than a partial picture.</span>
          <button
            type="button"
            onClick={load}
            data-testid="team-plans-retry"
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
      <div className="flex flex-col gap-4" data-testid="team-plans-roster" data-loading="false">
        <Topbar />
        <div className="p-8 rounded-xl border border-border bg-card-raised text-center" data-testid="team-plans-empty">
          <p className="text-ink font-semibold mb-1">No agents on your team yet.</p>
          <p className="text-sm text-ink-muted">Agents appear here once they join your {role === 'branch_manager' ? 'branch' : 'unit'}.</p>
        </div>
      </div>
    );
  }

  const { rows, partial } = state;
  const sharedCount = rows.filter((r) => r.shared).length;

  return (
    <div className="flex flex-col gap-5" data-testid="team-plans-roster" data-loading="false">
      <Topbar />

      {/* Partial-read notice — resolved rows only, no summary count */}
      {partial && (
        <div className="p-3 rounded-xl border border-warning/30 bg-warning/10 text-warning-ink text-sm" data-testid="team-plans-partial">
          Some agents didn't load. Showing the agents that resolved — the shared count is hidden so nothing implies a complete picture from a partial read.
        </div>
      )}

      {/* Summary strip — only on a full read (never an aggregate from a partial fan-out) */}
      {!partial && (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 flex-wrap" data-testid="team-plans-summary">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted leading-tight">Plans<br />shared</span>
            <span className="font-display text-3xl font-extrabold text-ink" data-testid="team-plans-shared-count">{sharedCount}</span>
            <span className="text-sm text-ink-muted">of {rows.length} agent{rows.length === 1 ? '' : 's'}</span>
          </div>
          <p className="ml-auto text-[11px] text-ink-muted max-w-md">
            Sharing is each agent's choice from their Money Needs worksheet. You see the derived coaching figures only — never the household budget itself.
          </p>
        </div>
      )}

      {/* Roster */}
      <div className="rounded-xl border border-border bg-card overflow-hidden" data-testid="team-plans-table">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card-raised flex-wrap">
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">
            {role === 'branch_manager' ? 'Branch' : 'Unit'} agents · {rows.length}
          </span>
          <span className="ml-auto text-[11px] text-ink-muted">Read-only · {CURRENT_YEAR} worksheets</span>
        </div>
        {/* Clarity mask — personal financial data (shared Money Needs figures); do not remove. */}
        <ul data-clarity-mask="True" className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.agentId} className="flex items-center gap-3 px-4 py-3 flex-wrap" data-testid={`team-plans-row-${r.agentId}`}>
              <span className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-[12px] shrink-0">
                {initials(r.agentName)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">{r.agentName}</p>
                {r.shared ? (
                  <p className="text-xs text-ink-muted mt-0.5">
                    Needs <span className="font-semibold text-ink" data-testid={`team-plans-fyc-${r.agentId}`}>{formatCurrency(r.plan.firstYearCommissionsRequired)}</span> first-year commissions
                    · income {formatCurrency(r.plan.totalAnnualAfterTax)} after tax
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted mt-0.5">Worksheet not shared with you.</p>
                )}
              </div>
              {r.shared ? (
                <button
                  type="button"
                  onClick={() => setDrawerRow(r)}
                  data-testid={`team-plans-view-${r.agentId}`}
                  className="min-h-[44px] inline-flex items-center px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  View
                </button>
              ) : (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wide bg-surface-muted text-ink-muted border border-border"
                  data-testid={`team-plans-notshared-${r.agentId}`}
                >
                  <EyeOff size={11} aria-hidden="true" /> Not shared
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {drawerRow && (
        <AgentPlanDrawer
          row={drawerRow}
          tenantId={tenantId}
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
      <h2 className="font-display font-extrabold text-lg text-ink">Team Plans</h2>
      <span
        className="ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold font-mono uppercase tracking-wide bg-card border border-border text-ink-muted"
        data-testid="team-plans-readonly-tag"
      >
        <MessageSquare size={11} aria-hidden="true" /> Shared by the agent · read-only
      </span>
    </div>
  );
}
