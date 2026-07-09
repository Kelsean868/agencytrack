import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { CalendarClock, Plus, RotateCw, ArrowRight, CheckCircle2, ClipboardCheck } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';
import useFocusTrap from '../../hooks/useFocusTrap';
import { getTodayTT } from '../../utils/dateInputs';
import { formatCurrency } from '../../utils/formatters';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../utils/weeklyActivityFloors';
import { getProspectInfo } from '../../services/prospectInfoService';
import {
  getAgentWeek, createAppointment, updateAppointment,
  setAppointmentStatus, postponeWithRebook,
} from '../../services/plannerService';
import {
  weekRange, buildWeekDates, groupByDate, sortByStartTime,
  deriveFollowups, deriveSeedFromKept, formatTime12, dayLabel,
  RETIRED_STATUSES,
} from './planner.helpers';
import { ActivityChip, ApptStatusPill } from './plannerPrimitives';
import AppointmentSheet from './AppointmentSheet';

const VIEWS = [
  { key: 'today',     label: 'Today' },
  { key: 'week',      label: 'Week' },
  { key: 'followups', label: 'Follow-ups' },
];

// Week-counter rows: booked (non-retired) planner appts of a type vs the weekly
// floor for the matching activity.
const WEEK_COUNTER_ROWS = [
  { type: 'CI',  floorKey: 'closingInterviewsKept', label: 'C.I' },
  { type: 'FFI', floorKey: 'factFindsCompleted',    label: 'F.F.I' },
  { type: 'PC',  floorKey: 'callsMade',             label: 'P.C' },
];

/** One appointment row — time · type · prospect/free label · status. */
function AppointmentCard({ appt, prospectName, onChurn }) {
  const retired = RETIRED_STATUSES.has(appt.status);
  const label = appt.type === 'FREE'
    ? (appt.freeBlockLabel || 'Free block')
    : (prospectName || 'Prospect');
  return (
    <button
      type="button"
      onClick={() => onChurn(appt)}
      data-testid={`appt-card-${appt.id}`}
      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        retired
          ? 'bg-card border-border/50 opacity-60'
          : 'bg-card border-border hover:border-primary/40'
      }`}
    >
      <div className="shrink-0 w-16">
        <span className={`text-sm font-semibold tabular-nums ${retired ? 'text-ink-muted line-through' : 'text-ink'}`}>
          {formatTime12(appt.startTime)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ActivityChip type={appt.type} />
          <span className={`text-sm font-medium truncate ${retired ? 'text-ink-muted line-through' : 'text-ink'}`}>
            {label}
          </span>
        </div>
        {appt.note && <p className="text-xs text-ink-muted mt-0.5 truncate">{appt.note}</p>}
      </div>
      <ApptStatusPill status={appt.status} />
    </button>
  );
}

/** Churn action dialog (screen 5) — Kept · Reschedule · Postpone · Cancel. */
function ChurnDialog({ appt, onAction, onClose, saving }) {
  const trapRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving });
  const actions = [
    { key: 'kept',      label: 'Mark kept',   variant: 'primary' },
    { key: 'reschedule', label: 'Reschedule', variant: 'plain' },
    { key: 'postpone',  label: 'Postpone',    variant: 'plain' },
    { key: 'cancel',    label: 'Cancel appointment', variant: 'danger' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Appointment actions"
        data-testid="churn-dialog"
        className="relative w-full sm:max-w-xs bg-card rounded-t-2xl sm:rounded-2xl shadow-lg p-4 flex flex-col gap-2"
      >
        <p className="text-sm font-semibold text-ink mb-1">{formatTime12(appt.startTime)} · <ActivityChip type={appt.type} /></p>
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            disabled={saving}
            onClick={() => onAction(a.key, appt)}
            className={`min-h-[44px] rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
              a.variant === 'primary'
                ? 'bg-primary dark:bg-primary-dark text-white hover:bg-primary/90'
                : a.variant === 'danger'
                ? 'border border-danger/40 text-danger-ink hover:bg-danger/5'
                : 'border border-border text-ink hover:bg-surface'
            }`}
          >
            {a.label}
          </button>
        ))}
        <button type="button" onClick={onClose} disabled={saving} className="min-h-[44px] text-sm font-semibold text-ink-muted hover:text-ink">
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * AgentPlannerPanel — the agent's Planner surface (handoff screens 1-9, scoped
 * to Today / Week / Follow-ups + the plan→actual handoff). All Firestore via
 * plannerService; four-states throughout; §4 dialogs on the book/churn sheets.
 *
 * The plan→actual handoff (screen 9) derives a Daily-Capture seed from today's
 * kept appointments and hands it to the EXISTING Daily Capture path via
 * `onCarryToDaily(seed)` — the agent confirms/edits in DailyCaptureV2 (its real
 * save flow), never re-types. (Integration choice: a "carry into today's log"
 * affordance + a blank-fill seed on DailyCaptureV2, rather than embedding DCv2's
 * internals — see the panel notes in docs/fable-build-progress.md item 3.2.)
 */
export default function AgentPlannerPanel({
  tenantId,
  agentId,
  agentUnitId,
  agentBranchId,
  callerRole = 'agent',
  weeklyFloors = null,
  onCarryToDaily,
}) {
  const today = useMemo(() => getTodayTT(), []);
  const { start: weekStart, end: weekEnd } = useMemo(() => weekRange(today), [today]);
  const weekDates = useMemo(() => buildWeekDates(today), [today]);
  const floors = weeklyFloors ?? DEFAULT_WEEKLY_ACTIVITY_FLOORS;

  const [view, setView] = useState('today');
  const [appts, setAppts] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Book/edit sheet
  const [sheet, setSheet] = useState(null); // null | { mode, initial, rebookFrom }
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState('');

  // Churn dialog
  const [churn, setChurn] = useState(null);
  const [churnSaving, setChurnSaving] = useState(false);

  const load = useCallback(() => {
    if (!tenantId || !agentId) return;
    setLoading(true);
    setError(false);
    Promise.all([
      getAgentWeek(tenantId, agentId, weekStart, weekEnd),
      getProspectInfo({ tenantId, agentId, callerRole, callerUid: agentId }).catch(() => []),
    ])
      .then(([a, p]) => { setAppts(a); setProspects(p); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tenantId, agentId, weekStart, weekEnd, callerRole]);

  useEffect(() => { load(); }, [load]);

  const prospectName = useCallback(
    (id) => prospects.find((p) => p.id === id)?.clientName || null,
    [prospects],
  );

  const byDate = useMemo(() => groupByDate(appts), [appts]);
  const todayAppts = useMemo(() => sortByStartTime(byDate.get(today) || []), [byDate, today]);
  const followups = useMemo(
    () => deriveFollowups(prospects, appts, today), [prospects, appts, today],
  );
  const seed = useMemo(() => deriveSeedFromKept(appts, today), [appts, today]);

  const meta = useMemo(
    () => ({ agentId, agentUnitId, agentBranchId }), [agentId, agentUnitId, agentBranchId],
  );

  // Week counters — booked (non-retired) count per type vs floor.
  const weekCounters = useMemo(() => {
    const weekAppts = appts.filter((a) => !RETIRED_STATUSES.has(a.status));
    return WEEK_COUNTER_ROWS.map((row) => ({
      ...row,
      booked: weekAppts.filter((a) => a.type === row.type).length,
      target: Number(floors?.[row.floorKey]) || 0,
    }));
  }, [appts, floors]);

  // ── Write handlers ─────────────────────────────────────────────────────────
  const openBook = (presetDate) =>
    setSheet({ mode: 'create', initial: presetDate ? { date: presetDate, startTime: '09:00' } : { date: today, startTime: '09:00' } });

  const handleSheetSave = async (data, addAnother) => {
    setSheetSaving(true);
    setSheetError('');
    try {
      if (sheet?.rebookFrom) {
        await postponeWithRebook(tenantId, sheet.rebookFrom, data, meta);
      } else if (sheet?.mode === 'edit' && sheet.initial?.id) {
        await updateAppointment(tenantId, sheet.initial.id, data);
      } else {
        await createAppointment(tenantId, data, meta);
      }
      await load();
      if (!addAnother) setSheet(null);
    } catch {
      setSheetError('Could not save — check your connection and try again.');
    } finally {
      setSheetSaving(false);
    }
  };

  const handleChurnAction = async (action, appt) => {
    if (action === 'reschedule' || action === 'postpone') {
      // Rebook: retain the original as postponed + link forward to the new appt.
      setChurn(null);
      setSheet({
        mode: 'create',
        rebookFrom: appt.id,
        initial: {
          type: appt.type, date: appt.date, startTime: appt.startTime,
          durationMin: appt.durationMin, prospectId: appt.prospectId,
          freeBlockLabel: appt.freeBlockLabel, note: appt.note,
        },
      });
      return;
    }
    setChurnSaving(true);
    try {
      await setAppointmentStatus(tenantId, appt.id, action === 'cancel' ? 'cancelled' : 'kept');
      await load();
      setChurn(null);
    } catch {
      // Surface via a reload of the churn dialog's parent error is overkill;
      // keep the dialog open so the user can retry the tap.
    } finally {
      setChurnSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 screen-enter">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={20} className="text-primary" aria-hidden="true" />
          <h1 className="text-lg font-bold text-ink">Planner</h1>
        </div>
        <button
          type="button"
          onClick={() => openBook(view === 'today' ? today : weekStart)}
          data-testid="planner-book"
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary transition-colors"
        >
          <Plus size={16} aria-hidden="true" /> Book
        </button>
      </div>

      {/* View pills */}
      <div className="flex gap-2 mb-4" role="tablist" aria-label="Planner views">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            data-testid={`planner-view-${v.key}`}
            className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold border transition-colors ${
              view === v.key
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'bg-card border-border text-ink-muted hover:text-ink'
            }`}
          >
            {v.label}
            {v.key === 'followups' && followups.length > 0 && (
              <span className="ml-1.5 text-[11px] font-mono">({followups.length})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <PanelSkeleton variant="list" count={4} label="Loading your planner…" />
      ) : error ? (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/30 p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-danger-ink">Could not load your planner.</p>
          <button
            type="button"
            onClick={load}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface"
          >
            <RotateCw size={15} aria-hidden="true" /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* ── TODAY ── */}
          {view === 'today' && (
            <div className="flex flex-col gap-3 stagger">
              {todayAppts.length === 0 ? (
                <div data-testid="planner-today-empty" className="rounded-xl bg-card border border-border p-8 text-center">
                  <p className="text-base font-semibold text-ink">Nothing booked today</p>
                  <p className="text-sm text-ink-muted mt-1">Book your first appointment to start the day.</p>
                  <button
                    type="button"
                    onClick={() => openBook(today)}
                    className="mt-4 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90"
                  >
                    <Plus size={16} aria-hidden="true" /> Book appointment
                  </button>
                </div>
              ) : (
                todayAppts.map((a) => (
                  <AppointmentCard key={a.id} appt={a} prospectName={prospectName(a.prospectId)} onChurn={setChurn} />
                ))
              )}

              {/* Evening handoff (screen 9) — pre-fill from kept, confirm in Daily Capture. */}
              {seed.keptCount > 0 && (
                <div data-testid="planner-handoff" className="mt-2 rounded-xl bg-primary/5 border border-primary/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardCheck size={16} className="text-primary" aria-hidden="true" />
                    <h2 className="text-sm font-semibold text-ink">End-of-day handoff</h2>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {seed.keptCount} kept {seed.keptCount === 1 ? 'appointment' : 'appointments'} today
                    {seed.newBusiness.api > 0 && <> · {formatCurrency(seed.newBusiness.api)} API written</>}.
                    Carry them into today's Daily Capture — confirm, don't re-type.
                  </p>
                  <button
                    type="button"
                    onClick={() => onCarryToDaily?.({ ...seed.counts, newBusiness: seed.newBusiness })}
                    data-testid="planner-carry-daily"
                    disabled={!onCarryToDaily}
                    className="mt-3 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
                  >
                    Carry into today's log <ArrowRight size={15} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── WEEK ── */}
          {view === 'week' && (
            <div className="flex flex-col gap-4">
              {/* Weekly counters vs floor */}
              <div className="grid grid-cols-3 gap-2" data-testid="planner-week-counters">
                {weekCounters.map((c) => {
                  const short = c.target > 0 && c.booked < c.target;
                  return (
                    <div key={c.type} className="rounded-xl bg-card border border-border p-3 text-center">
                      <div className="flex items-center justify-center mb-1"><ActivityChip type={c.type} /></div>
                      <p className={`text-lg font-bold tabular-nums ${short ? 'text-warning-ink' : 'text-ink'}`}>
                        {c.booked}<span className="text-ink-muted text-sm font-medium">/{c.target || '–'}</span>
                      </p>
                      <p className="text-[10px] font-mono uppercase tracking-wide text-ink-muted">booked</p>
                    </div>
                  );
                })}
              </div>

              {/* 7-day list */}
              <div className="flex flex-col gap-3 stagger">
                {weekDates.map((d) => {
                  const dayAppts = sortByStartTime(byDate.get(d) || []);
                  return (
                    <div key={d} className="rounded-xl bg-card border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-semibold ${d === today ? 'text-primary' : 'text-ink'}`}>
                          {dayLabel(d)}{d === today && ' · Today'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openBook(d)}
                          aria-label={`Book on ${dayLabel(d)}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline min-h-[44px] px-2"
                        >
                          <Plus size={14} aria-hidden="true" /> Add
                        </button>
                      </div>
                      {dayAppts.length === 0 ? (
                        <p className="text-xs text-ink-muted italic">No appointments</p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {dayAppts.map((a) => (
                            <AppointmentCard key={a.id} appt={a} prospectName={prospectName(a.prospectId)} onChurn={setChurn} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── FOLLOW-UPS ── */}
          {view === 'followups' && (
            <div className="flex flex-col gap-3 stagger">
              {followups.length === 0 ? (
                <div data-testid="planner-followups-empty" className="rounded-xl bg-card border border-border p-8 text-center">
                  <CheckCircle2 size={28} className="text-primary mx-auto mb-2" aria-hidden="true" />
                  <p className="text-base font-semibold text-ink">All caught up</p>
                  <p className="text-sm text-ink-muted mt-1">No prospects are waiting on a callback.</p>
                </div>
              ) : (
                followups.map((f) => (
                  <div key={f.id} data-testid={`followup-row-${f.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{f.clientName}</p>
                      <p className="text-xs text-ink-muted">
                        {f.overdue ? 'Overdue · ' : 'Due '}intended {f.intendedAppointmentDate}
                      </p>
                    </div>
                    {f.overdue && <ApptStatusPill status="postponed" />}
                    <button
                      type="button"
                      onClick={() => setSheet({ mode: 'create', initial: { date: today, startTime: '09:00', prospectId: f.id, type: 'FFI' } })}
                      className="min-h-[44px] px-3 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
                    >
                      Book
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {sheet && (
        <AppointmentSheet
          mode={sheet.mode}
          initial={sheet.initial}
          prospects={prospects}
          saving={sheetSaving}
          error={sheetError}
          onSave={handleSheetSave}
          onClose={() => { setSheet(null); setSheetError(''); }}
        />
      )}

      {churn && (
        <ChurnDialog
          appt={churn}
          saving={churnSaving}
          onAction={handleChurnAction}
          onClose={() => setChurn(null)}
        />
      )}
    </div>
  );
}
