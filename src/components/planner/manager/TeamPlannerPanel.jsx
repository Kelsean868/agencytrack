import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarClock, RotateCw, X, ShieldCheck } from 'lucide-react';
import PanelSkeleton from '../../ui/PanelSkeleton';
import useFocusTrap from '../../../hooks/useFocusTrap';
import { getTodayTT } from '../../../utils/dateInputs';
import { getTenantUsers } from '../../../services/managerService';
import { getCompanyMinimums } from '../../../services/goalsService';
import { getTeamWeek } from '../../../services/plannerService';
import {
  weekRange, buildWeekDates, groupByAgent, groupByDate, sortByStartTime,
  formatTime12, dayLabel, RETIRED_STATUSES,
} from '../planner.helpers';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../../utils/weeklyActivityFloors';
import { ActivityChip, ApptStatusPill } from '../plannerPrimitives';

const COUNTER_ROWS = [
  { type: 'CI',  floorKey: 'closingInterviewsKept', label: 'C.I' },
  { type: 'FFI', floorKey: 'factFindsCompleted',    label: 'F.F.I' },
  { type: 'PC',  floorKey: 'callsMade',             label: 'P.C' },
];

/** Read-only coaching drill — one agent's booked week, day by day. No write arm
 *  (upline is READ-ONLY per the locked contract). §4 dialog contract. */
function CoachingDrill({ agentName, agentAppts, weekDates, today, onClose }) {
  const trapRef = useFocusTrap({ onEscape: onClose });
  const byDate = useMemo(() => groupByDate(agentAppts), [agentAppts]);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${agentName} — week`}
        data-testid="coaching-drill"
        className="relative w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-lg max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-card border-b border-border/60">
          <div>
            <h2 className="text-base font-bold text-ink">{agentName}</h2>
            <p className="text-[11px] font-mono uppercase tracking-wide text-ink-muted">This week · read-only</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-ink-muted hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-4 py-4 flex flex-col gap-3">
          {weekDates.map((d) => {
            const dayAppts = sortByStartTime(byDate.get(d) || []);
            return (
              <div key={d}>
                <p className={`text-xs font-semibold mb-1 ${d === today ? 'text-primary' : 'text-ink-muted'}`}>
                  {dayLabel(d)}{d === today && ' · Today'}
                </p>
                {dayAppts.length === 0 ? (
                  <p className="text-xs text-ink-muted italic pl-1">No appointments</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {dayAppts.map((a) => {
                      const retired = RETIRED_STATUSES.has(a.status);
                      return (
                        <div key={a.id} className={`flex items-center gap-2 p-2 rounded-lg border border-border ${retired ? 'opacity-60' : 'bg-card-raised'}`}>
                          <span className={`text-xs font-semibold tabular-nums w-14 ${retired ? 'line-through text-ink-muted' : 'text-ink'}`}>
                            {formatTime12(a.startTime)}
                          </span>
                          <ActivityChip type={a.type} />
                          <span className="flex-1" />
                          <ApptStatusPill status={a.status} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * TeamPlannerPanel — the manager's READ-ONLY view of the team's booked week
 * (handoff manager screen 1 · Team overview, scoped to what the locked contract
 * supports). Reads via getTeamWeek (role-split: UM own unit / BM own branch /
 * SM+/TA tenant-wide). Per-agent booked-vs-floor context from companyMinimums'
 * weeklyActivityFloors. Coaching drill is READ-ONLY (upline has no write arm).
 *
 * SKIP-LOGGED (need collections not in the locked contract — banked for a
 * ruling): the aggregate stalled-pipeline ratio, the escalation inbox, and the
 * recruiting funnel all require server-computed `pipelineStats` / an
 * `escalations` collection / a `recruits` model that item 3.2's data contract
 * (appointments only) does not include. Any mockup coaching WRITE action
 * (schedule joint CI, reply with advice, take the call) is likewise skipped —
 * there is no upline write arm on `appointments`.
 */
export default function TeamPlannerPanel({ tenantId, callerRole, uid, branchId }) {
  const today = useMemo(() => getTodayTT(), []);
  const { start: weekStart, end: weekEnd } = useMemo(() => weekRange(today), [today]);
  const weekDates = useMemo(() => buildWeekDates(today), [today]);

  const [appts, setAppts] = useState([]);
  const [members, setMembers] = useState([]);
  const [floors, setFloors] = useState(DEFAULT_WEEKLY_ACTIVITY_FLOORS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [drillAgentId, setDrillAgentId] = useState(null);

  const load = useCallback(() => {
    if (!tenantId || !callerRole) return;
    setLoading(true);
    setError(false);
    Promise.all([
      getTeamWeek({ tenantId, role: callerRole, uid, branchId, weekStart, weekEnd }),
      getTenantUsers(tenantId).catch(() => []),
      getCompanyMinimums(tenantId).catch(() => null),
    ])
      .then(([a, m, mins]) => {
        setAppts(a);
        setMembers(m);
        if (mins?.weeklyActivityFloors) setFloors(mins.weeklyActivityFloors);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tenantId, callerRole, uid, branchId, weekStart, weekEnd]);

  useEffect(() => { load(); }, [load]);

  const nameOf = useCallback(
    (id) => members.find((m) => m.id === id)?.name || `Agent ${String(id).slice(0, 6)}`,
    [members],
  );

  const byAgent = useMemo(() => groupByAgent(appts), [appts]);
  // Roster rows: every agent who has a booking this week (read is honest to the
  // contract — never-booked agents aren't in the appointments query).
  const rows = useMemo(() => {
    return [...byAgent.entries()]
      .map(([agentId, list]) => {
        const active = list.filter((a) => !RETIRED_STATUSES.has(a.status));
        return {
          agentId,
          name: nameOf(agentId),
          total: active.length,
          counters: COUNTER_ROWS.map((r) => ({
            ...r,
            booked: active.filter((a) => a.type === r.type).length,
            target: Number(floors?.[r.floorKey]) || 0,
          })),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [byAgent, nameOf, floors]);

  const drillAppts = useMemo(
    () => (drillAgentId ? (byAgent.get(drillAgentId) || []) : []),
    [drillAgentId, byAgent],
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 screen-enter">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock size={20} className="text-primary" aria-hidden="true" />
        <h1 className="text-lg font-bold text-ink">Team Planner</h1>
      </div>
      <p className="text-sm text-ink-muted mb-4">
        Your team's booked week — a leading-indicator, coaching view. Read-only.
      </p>

      {loading ? (
        <PanelSkeleton variant="list" count={4} label="Loading team planner…" />
      ) : error ? (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/30 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-danger-ink">Could not load the team planner.</p>
          <button
            type="button"
            onClick={load}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface"
          >
            <RotateCw size={15} aria-hidden="true" /> Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div data-testid="team-planner-empty" className="rounded-xl bg-card border border-border p-8 text-center">
          <p className="text-base font-semibold text-ink">No bookings this week</p>
          <p className="text-sm text-ink-muted mt-1">
            When your team books appointments, their week appears here to coach around.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 stagger" data-testid="team-planner-rows">
          {rows.map((r) => (
            <button
              key={r.agentId}
              type="button"
              onClick={() => setDrillAgentId(r.agentId)}
              data-testid={`team-row-${r.agentId}`}
              className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{r.name}</p>
                <p className="text-xs text-ink-muted">{r.total} booked this week</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.counters.map((c) => {
                  const short = c.target > 0 && c.booked < c.target;
                  return (
                    <div key={c.type} className="text-center min-w-[42px]">
                      <p className={`text-sm font-bold tabular-nums ${short ? 'text-warning-ink' : 'text-ink'}`}>
                        {c.booked}<span className="text-ink-muted text-[11px]">/{c.target || '–'}</span>
                      </p>
                      <p className="text-[9px] font-mono uppercase tracking-wide text-ink-muted">{c.label}</p>
                    </div>
                  );
                })}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Trust-constraint marker (handoff manager §2): this surface is the
          private manager↔team coaching context — never a public/kiosk ranking. */}
      {!loading && !error && rows.length > 0 && (
        <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
          <ShieldCheck size={13} aria-hidden="true" /> Private coaching view · booked activity is not a public ranking
        </p>
      )}

      {drillAgentId && (
        <CoachingDrill
          agentName={nameOf(drillAgentId)}
          agentAppts={drillAppts}
          weekDates={weekDates}
          today={today}
          onClose={() => setDrillAgentId(null)}
        />
      )}
    </div>
  );
}
