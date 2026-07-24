import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CalendarClock, Plus, RotateCw, ArrowRight, CheckCircle2, ClipboardCheck, HelpCircle, AlertTriangle, ListChecks, Check } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';
import useFocusTrap from '../../hooks/useFocusTrap';
import { getTodayTT } from '../../utils/dateInputs';
import { formatCurrency } from '../../utils/formatters';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../utils/weeklyActivityFloors';
import { getProspectInfo } from '../../services/prospectInfoService';
import {
  getAgentWeek, getSeriesInstances, createAppointment, createRecurringAppointments,
  updateAppointment, setAppointmentStatus, postponeWithRebook, deleteAppointment,
  undoPostpone, bulkUpdateAppointments, addAppointmentNote,
} from '../../services/plannerService';
import {
  listTemplates, saveTemplate, deleteTemplate,
} from '../../services/appointmentTemplateService';
import {
  weekRange, buildWeekDates, groupByDate, sortByStartTime,
  deriveFollowups, deriveSeedFromKept, formatTime12, dayLabel,
  RETIRED_STATUSES, detectConflicts, shiftDateStr,
  readNoteThread, appointmentIsActive,
  findRunningLate, computeLateCascade,
} from './planner.helpers';
import {
  seriesRowLabel, cadenceLabel, nextOccurrenceDate, slotDayLabel, formatShortDate,
} from './recurrence.helpers';
import { ActivityChip, ApptStatusPill } from './plannerPrimitives';
import AppointmentSheet, { SeriesBadge } from './AppointmentSheet';
import SeriesEditChoice from './SeriesEditChoice';
import TemplateNameSheet from './TemplateNameSheet';
import BulkMoveSheet from './BulkMoveSheet';
import BulkCancelConfirmSheet from './BulkCancelConfirmSheet';
import PlannerShortcutsSheet from './PlannerShortcutsSheet';
import usePlannerHistory from './usePlannerHistory';
import PlannerDesktopBoard from './PlannerDesktopBoard';
import RunningLateSheet from './RunningLateSheet';
import useToast from '../../hooks/useToast';
import useIsDesktop from '../../hooks/useIsDesktop';

// Fields openEditSheet hydrates into sheet.initial — the exact set undo/redo
// for an edit compares against to isolate "the fields that were patched"
// (Run 9 A1 requirement 2: undo writes prior values of EXACTLY those keys).
const EDIT_PATCH_FIELDS = [
  'type', 'date', 'startTime', 'durationMin',
  'prospectId', 'freeBlockLabel', 'note', 'apiAmount',
];

// Run 9 F3d: fields that propagate across a series edit ("this and future" /
// "all"). NEVER date (a propagated date collapses the series onto one day),
// never status, never series metadata.
const PROPAGATE_FIELDS = [
  'type', 'startTime', 'durationMin', 'prospectId', 'freeBlockLabel', 'note', 'apiAmount',
];
// Only these statuses are propagation targets — retired (cancelled/postponed) and
// completed (kept/done) instances are records, never rewritten (extends R1).
const PROPAGATE_STATUSES = new Set(['scheduled', 'confirmed']);

/**
 * Normalize a propagate field for the changed-field diff. The sheet stores
 * durationMin/apiAmount as strings and blanks optional fields to '' or null,
 * while a hydrated instance carries numbers / undefined — so a raw `!==` (the
 * literal A1 edit idiom) spuriously flags unchanged optional/numeric fields.
 * Normalizing both sides realizes "only genuinely-changed fields propagate"
 * (deliberate, banked deviation from A1's raw diff — A1 masks the same latent
 * mismatch by always re-writing the full doc; propagation writes only the
 * changed keys, so it cannot tolerate a phantom diff).
 */
function normalizePropagateValue(key, v) {
  if (key === 'apiAmount') {
    if (v == null || v === '') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  if (key === 'durationMin') {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return String(v ?? '');
}

function isFormFieldTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

// Run 9 A2: the `e` shortcut resolves the appointment id from the
// data-testid of the DOM-focused card (set by the up/down roving-focus
// shortcut, or by a direct Tab/click) — never a separate "selected id" piece
// of React state, so focus and "which appointment the shortcut acts on" can
// never drift apart.
function focusedApptId() {
  const el = document.activeElement;
  const testid = el && typeof el.getAttribute === 'function' ? el.getAttribute('data-testid') : null;
  const m = testid ? /^appt-card-(.+)$/.exec(testid) : null;
  return m ? m[1] : null;
}

const VIEWS = [
  { key: 'today',     label: 'Today' },
  { key: 'week',      label: 'Week' },
  { key: 'followups', label: 'Follow-ups' },
];

// Current local 'HH:mm' — the E3 running-late tick. Field agents run in TT, so
// local time matches getTodayTT's date basis; the churn "Running late" action is
// a timezone-independent manual entry regardless.
function currentTimeHHmm() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Week-counter rows: booked (non-retired) planner appts of a type vs the weekly
// floor for the matching activity.
const WEEK_COUNTER_ROWS = [
  { type: 'CI',  floorKey: 'closingInterviewsKept', label: 'C.I' },
  { type: 'FFI', floorKey: 'factFindsCompleted',    label: 'F.F.I' },
  { type: 'PC',  floorKey: 'callsMade',             label: 'P.C' },
];

/** One appointment row — time · type · prospect/free label · status. Recurring
 * items carry a ↻ badge + a mono series line under a dashed hairline (state 2);
 * a postponed series instance shows the "moved / series stays" note (state 5).
 * Run 9 A5: in selection mode a live card shows a leading checkbox and a tap
 * toggles selection instead of opening churn; retired (cancelled/postponed)
 * cards are NOT selectable — they're already terminal, so bulk ops target
 * live appointments only. */
function AppointmentCard({
  appt, prospectName, onChurn, resolveAppt, conflicted,
  selectMode = false, selected = false, onToggleSelect, dense = false,
}) {
  const retired = RETIRED_STATUSES.has(appt.status);
  const selectable = selectMode && !retired;
  const handleClick = (e) => {
    if (selectMode) {
      // Selection mode owns the tap: live cards toggle, retired cards no-op
      // (never open churn mid-selection).
      if (selectable) onToggleSelect?.(appt, e.shiftKey);
      return;
    }
    onChurn(appt);
  };
  const isSeries = Boolean(appt.seriesId);
  const label = appt.type === 'FREE'
    ? (appt.freeBlockLabel || 'Free block')
    : (prospectName || 'Prospect');

  const cadence = isSeries
    ? cadenceLabel({ repeatRule: appt.repeatRule, daysOfWeek: appt.daysOfWeek, startDate: appt.date })
    : '';
  const activeSeriesLine = isSeries && !retired
    ? seriesRowLabel({
      repeatRule: appt.repeatRule, daysOfWeek: appt.daysOfWeek, startDate: appt.date,
      seriesPos: appt.seriesPos, seriesTotal: appt.seriesTotal,
    })
    : '';
  // A postponed series instance: resolve where it moved (if the rebooked appt is
  // in the loaded week) and note the series is untouched.
  const movedTo = isSeries && appt.status === 'postponed' && appt.rescheduledToId
    ? resolveAppt?.(appt.rescheduledToId)
    : null;

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid={`appt-card-${appt.id}`}
      aria-pressed={selectMode ? selected : undefined}
      className={`w-full text-left flex items-start ${dense ? 'gap-2 p-2' : 'gap-3 p-3'} rounded-xl border transition-colors ${
        retired
          ? 'bg-card border-border/50 opacity-60'
          : selected
          ? 'bg-primary/5 border-primary ring-1 ring-primary/40'
          : 'bg-card border-border hover:border-primary/40'
      }`}
    >
      {selectable && (
        <span
          data-testid={`appt-select-${appt.id}`}
          aria-hidden="true"
          className={`shrink-0 mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            selected ? 'bg-primary dark:bg-primary-dark border-primary text-white' : 'bg-card border-border'
          }`}
        >
          {selected && <Check size={14} />}
        </span>
      )}
      <div className="shrink-0 w-16 pt-0.5">
        <span className={`text-sm font-semibold tabular-nums ${retired ? 'text-ink-muted line-through' : 'text-ink'}`}>
          {formatTime12(appt.startTime)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ActivityChip type={appt.type} />
          {isSeries && <SeriesBadge />}
          {conflicted && (
            <span
              data-testid={`appt-conflict-${appt.id}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/15 text-warning-ink text-[10px] font-bold uppercase tracking-wide"
            >
              <AlertTriangle size={10} aria-hidden="true" />
              Overlaps
            </span>
          )}
          <span className={`text-sm font-medium truncate ${retired ? 'text-ink-muted line-through' : 'text-ink'}`}>
            {label}
          </span>
        </div>
        {!dense && appt.note && <p className="text-xs text-ink-muted mt-0.5 truncate">{appt.note}</p>}

        {activeSeriesLine && (
          <div className="mt-2 pt-2 border-t border-dashed border-border">
            <span data-testid={`appt-series-line-${appt.id}`} className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-ink-muted">
              <SeriesBadge size={12} /> {activeSeriesLine}
            </span>
          </div>
        )}

        {isSeries && appt.status === 'postponed' && (
          <div className="mt-2 pt-2 border-t border-dashed border-border flex flex-col gap-1">
            {movedTo && (
              <span className="text-[11px] font-semibold text-warning-ink">
                Moved to {slotDayLabel(movedTo.date)} · {formatTime12(movedTo.startTime)}
              </span>
            )}
            <span data-testid={`appt-series-line-${appt.id}`} className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-ink-muted">
              <SeriesBadge size={12} /> Only this one moved · series stays {cadence}
            </span>
          </div>
        )}
      </div>
      <ApptStatusPill status={appt.status} />
    </button>
  );
}

/** Churn action dialog (screen 5) — Kept · Edit · Reschedule · Postpone · Cancel. */
function ChurnDialog({ appt, onAction, onClose, saving }) {
  const trapRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving });
  const actions = [
    { key: 'kept',      label: 'Mark kept',    variant: 'primary' },
    ...(['scheduled', 'confirmed'].includes(appt.status)
      ? [{ key: 'running-late', label: 'Running late', variant: 'plain', testid: 'churn-running-late' }]
      : []),
    { key: 'edit',      label: 'Edit details', variant: 'plain' },
    { key: 'reschedule', label: 'Reschedule',  variant: 'plain' },
    { key: 'postpone',  label: 'Postpone',     variant: 'plain' },
    { key: 'save-template', label: 'Save as template', variant: 'plain', testid: 'churn-save-template' },
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
            data-testid={a.testid ?? `churn-action-${a.key}`}
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
  // Planner v2 E1/E5: at lg+ the panel renders the side-by-side desktop board
  // (PlannerDesktopBoard) instead of the single-column mobile views, and drops
  // the width cap. isDesktop is matchMedia-driven (false in jsdom → tests keep
  // the mobile layout + its unique appt-card testids).
  const isDesktop = useIsDesktop();
  const [desktopSpan, setDesktopSpan] = useState('3day');
  const [appts, setAppts] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Book/edit sheet
  const [sheet, setSheet] = useState(null); // null | { mode, initial, rebookFrom }
  const [sheetSaving, setSheetSaving] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [noteSaving, setNoteSaving] = useState(false); // E4 add-note in-flight

  // E3 running-late cascade: the appt being addressed, write-in-flight, the set
  // of appts the agent chose to "Keep schedule" on (so the banner stops nagging),
  // and a 1-minute tick that re-evaluates the overdue signal.
  const [lateSheet, setLateSheet] = useState(null);
  const [lateSaving, setLateSaving] = useState(false);
  const [lateDismissed, setLateDismissed] = useState(() => new Set());
  const [nowTime, setNowTime] = useState(() => currentTimeHHmm());
  useEffect(() => {
    const id = setInterval(() => setNowTime(currentTimeHHmm()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Churn dialog
  const [churn, setChurn] = useState(null);
  const [churnSaving, setChurnSaving] = useState(false);

  // Series edit-scope choice sheet (state 3)
  const [seriesChoice, setSeriesChoice] = useState(null); // null | appt

  // Run 9 A4: appointment templates. Loaded once per panel mount (+ after a
  // save/delete); errors degrade silently to no-templates. `templatePrompt`
  // holds the appointment whose shape is being saved (name-prompt sheet open).
  const [templates, setTemplates] = useState([]);
  const [templatePrompt, setTemplatePrompt] = useState(null); // null | appt
  const [templateSaving, setTemplateSaving] = useState(false);

  // Run 9 A2: keyboard-shortcuts reference sheet + a ref scoping the roving
  // up/down focus query to whichever view's appointment cards are actually
  // in the DOM right now (today/week/followups render mutually exclusively).
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const contentRef = useRef(null);

  // Run 9 A1: undo/redo history + toast. `history` is the single hook
  // instance for this mounted panel — its `push` is forward-compatible with
  // a later bulk-ops feature (A5) pushing its own entries through it.
  const history = usePlannerHistory();
  const toast = useToast();

  // Run 9 A5: bulk-operations selection mode. `selected` is a Set of live
  // appointment ids; `lastClickedRef` anchors shift-click range selection.
  // `bulkSheet` = null | 'move' | 'cancel' (the two bulk action sheets).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkSheet, setBulkSheet] = useState(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const lastClickedRef = useRef(null);

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

  // Run 9 A4: load the agent's templates. Errors are swallowed (no console —
  // the picker simply stays hidden), so a rules/network hiccup never breaks
  // the planner. Re-run after a save/delete to keep the picker fresh.
  const loadTemplates = useCallback(() => {
    if (!tenantId || !agentId) return;
    listTemplates(tenantId, agentId)
      .then(setTemplates)
      // Intentionally silent: degrade to no-templates rather than surfacing.
      .catch(() => { /* no-op — picker hides when empty */ });
  }, [tenantId, agentId]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const prospectName = useCallback(
    (id) => prospects.find((p) => p.id === id)?.clientName || null,
    [prospects],
  );

  const byDate = useMemo(() => groupByDate(appts), [appts]);
  const apptById = useMemo(() => {
    const m = new Map();
    for (const a of appts) m.set(a.id, a);
    return m;
  }, [appts]);
  const resolveAppt = useCallback((id) => apptById.get(id) || null, [apptById]);
  // Run 9 A3: conflict detection scoped to the LOADED WEEK (`appts`) — R7
  // warn-only, never blocks. Recomputed whenever the loaded week changes.
  const conflicts = useMemo(() => detectConflicts(appts), [appts]);
  const todayAppts = useMemo(() => sortByStartTime(byDate.get(today) || []), [byDate, today]);
  const followups = useMemo(
    () => deriveFollowups(prospects, appts, today), [prospects, appts, today],
  );
  const seed = useMemo(() => deriveSeedFromKept(appts, today), [appts, today]);

  const meta = useMemo(
    () => ({ agentId, agentUnitId, agentBranchId }), [agentId, agentUnitId, agentBranchId],
  );

  // ── Run 9 A5: selection mode ───────────────────────────────────────────────

  // The selectable (live) appointment ids in the CURRENT view's visible order.
  // Derived from the same arrays the render maps over, so index order here IS
  // DOM order — shift-click ranges resolve against it (A5 req 2).
  const visibleSelectableIds = useMemo(() => {
    const live = (list) => list.filter((a) => !RETIRED_STATUSES.has(a.status)).map((a) => a.id);
    if (view === 'today') return live(todayAppts);
    if (view === 'week') {
      return weekDates.flatMap((d) => live(sortByStartTime(byDate.get(d) || [])));
    }
    return []; // follow-ups view renders no appointment cards
  }, [view, todayAppts, weekDates, byDate]);

  // Prune selection whenever the loaded week changes — an id that vanished or
  // flipped retired (e.g. cancelled via undo replay) must never linger in the
  // set and get patched by a later bulk op. IMPORTANT: bail WITHOUT dispatching
  // when there is nothing to prune — an unconditional setSelected here (even a
  // bail-out updater) schedules React work on every week load and measurably
  // widens the commit→effect-resubscribe window the A2 keyboard listener
  // depends on (surfaced as a full-suite-only flake in the `e` shortcut test).
  useEffect(() => {
    if (selected.size === 0) return;
    const pruned = [...selected].filter((id) => {
      const a = apptById.get(id);
      return a && !RETIRED_STATUSES.has(a.status);
    });
    if (pruned.length === selected.size) return;
    setSelected(new Set(pruned));
  }, [apptById, selected]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
    setBulkSheet(null);
    lastClickedRef.current = null;
  }, []);

  // Plain click toggles one id; shift-click selects the RANGE between the
  // last-clicked card and this one within the current view's visible order.
  const toggleSelect = useCallback((appt, shiftKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const anchor = lastClickedRef.current;
      if (shiftKey && anchor && anchor !== appt.id) {
        const order = visibleSelectableIds;
        const ai = order.indexOf(anchor);
        const bi = order.indexOf(appt.id);
        if (ai !== -1 && bi !== -1) {
          const [lo, hi] = ai < bi ? [ai, bi] : [bi, ai];
          for (let i = lo; i <= hi; i += 1) next.add(order[i]);
          lastClickedRef.current = appt.id;
          return next;
        }
      }
      if (next.has(appt.id)) next.delete(appt.id);
      else next.add(appt.id);
      lastClickedRef.current = appt.id;
      return next;
    });
  }, [visibleSelectableIds]);

  // The selected appointments' CURRENT loaded state — priors for undo are
  // captured from here BEFORE the bulk write applies (A5 req 6).
  const selectedAppts = useMemo(
    () => [...selected].map((id) => apptById.get(id)).filter(Boolean),
    [selected, apptById],
  );

  // Planner v2 E1: render-prop the desktop board uses so every board card keeps
  // the exact churn / select / conflict / series wiring the mobile views use —
  // the board is a layout, not a fork of the interaction model.
  const renderCard = useCallback((a, opts = {}) => (
    <AppointmentCard
      key={a.id}
      appt={a}
      prospectName={prospectName(a.prospectId)}
      onChurn={setChurn}
      resolveAppt={resolveAppt}
      conflicted={conflicts.has(a.id)}
      selectMode={selectMode}
      selected={selected.has(a.id)}
      onToggleSelect={toggleSelect}
      dense={opts.dense}
    />
  ), [prospectName, resolveAppt, conflicts, selectMode, selected, toggleSelect]);

  // Planner v2 E2: drag-drop reschedule → the EXISTING postponeWithRebook (drag
  // is a faster path to the same move, not a new mutation — no propagation
  // reimplement). Mirrors the churn Postpone path's history entry (undoPostpone
  // inverse). A SERIES instance moves just itself (single-doc rebook); the
  // original tombstones as 'postponed' and the card's existing series note shows
  // ("Only this one moved · series stays"). No-op when the slot is unchanged.
  const handleReschedule = useCallback(async (appt, target) => {
    if (!target || (target.date === appt.date && target.startTime === appt.startTime)) return;
    const newData = {
      type: appt.type, date: target.date, startTime: target.startTime,
      durationMin: appt.durationMin, prospectId: appt.prospectId,
      freeBlockLabel: appt.freeBlockLabel, note: appt.note,
    };
    try {
      const newIdRef = { current: await postponeWithRebook(tenantId, appt.id, newData, meta) };
      history.push({
        label: 'Reschedule (drag)',
        undo: async () => { await undoPostpone(tenantId, appt.id, newIdRef.current); },
        redo: async () => { newIdRef.current = await postponeWithRebook(tenantId, appt.id, newData, meta); },
      });
      await load();
      toast.show({ message: 'Appointment moved', variant: 'info' });
    } catch {
      await load();
      toast.show({ message: 'Could not move — check your connection and try again.', variant: 'error' });
    }
  }, [tenantId, meta, history, load, toast]);

  // Planner v2 E4: append a note to the edited appointment's thread. `during`
  // ("THIS MEETING") is set when the appointment is active today. Appointment-
  // scoped (addAppointmentNote → arrayUnion on the appt doc); NOT undoable (a
  // note is a record, like a template save). Reload reflects the new entry.
  const handleAddNote = useCallback(async (text) => {
    const apptId = sheet?.initial?.id;
    if (!apptId) return;
    const appt = resolveAppt(apptId);
    const during = appt ? appointmentIsActive(appt, today) : false;
    setNoteSaving(true);
    try {
      await addAppointmentNote(tenantId, apptId, { text, during });
      await load();
      toast.show({ message: 'Note added', variant: 'info' });
    } catch {
      toast.show({ message: 'Could not add note — check your connection and try again.', variant: 'error' });
    } finally {
      setNoteSaving(false);
    }
  }, [sheet, resolveAppt, today, tenantId, load, toast]);

  // ── E3 running-late cascade ────────────────────────────────────────────────
  // The overdue signal (earliest un-churned today appt whose end has passed).
  const lateCandidate = useMemo(
    () => findRunningLate(todayAppts, today, nowTime),
    [todayAppts, today, nowTime],
  );
  const prospectPhone = useCallback(
    (id) => { const pr = prospects.find((x) => x.id === id); return pr?.phone ?? pr?.clientPhone ?? null; },
    [prospects],
  );

  // "Keep schedule" — dismiss the prompt for this appt so the banner stops.
  // Capture the late item first, then dispatch both setters separately (never a
  // setState inside another setter's updater — that can double-fire).
  const handleLateKeep = useCallback(() => {
    if (lateSheet) setLateDismissed((prev) => new Set(prev).add(lateSheet.id));
    setLateSheet(null);
  }, [lateSheet]);

  // "Wrap up · mark Kept" — the existing setAppointmentStatus path.
  const handleLateWrapKept = useCallback(async () => {
    const appt = lateSheet;
    if (!appt) return;
    setLateSaving(true);
    try {
      const priorStatus = appt.status;
      await setAppointmentStatus(tenantId, appt.id, 'kept');
      history.push({
        label: 'Mark kept',
        undo: async () => { await setAppointmentStatus(tenantId, appt.id, priorStatus); },
        redo: async () => { await setAppointmentStatus(tenantId, appt.id, 'kept'); },
      });
      await load();
      setLateSheet(null);
    } catch {
      toast.show({ message: 'Could not update — check your connection and try again.', variant: 'error' });
    } finally {
      setLateSaving(false);
    }
  }, [lateSheet, tenantId, history, load, toast]);

  // "Push back +N & notify" — batch the affected time shifts through the SAME
  // bulk write path (no new mutation path); undo restores each prior startTime.
  const handlePushLate = useCallback(async (pushMin, scope) => {
    const appt = lateSheet;
    if (!appt) return;
    const { affected } = computeLateCascade(appts, appt, pushMin, scope);
    if (affected.length === 0) { setLateSheet(null); return; }
    const updates = affected.map((a) => ({ id: a.id, patch: { startTime: a.newStartTime } }));
    const priors = affected.map((a) => ({ id: a.id, patch: { startTime: a.oldStartTime } }));
    setLateSaving(true);
    try {
      await bulkUpdateAppointments(tenantId, updates);
      history.push({
        label: `Running late +${pushMin}m (${affected.length})`,
        undo: async () => { await bulkUpdateAppointments(tenantId, priors); },
        redo: async () => { await bulkUpdateAppointments(tenantId, updates); },
      });
      await load();
      toast.show({
        message: `Pushed ${affected.length} ${affected.length === 1 ? 'appointment' : 'appointments'} +${pushMin}m`,
        variant: 'info',
      });
      setLateSheet(null);
    } catch (err) {
      await load();
      toast.show({ message: err?.message || 'Could not push — check your connection and try again.', variant: 'error' });
    } finally {
      setLateSaving(false);
    }
  }, [lateSheet, appts, tenantId, history, load, toast]);

  // Shared bulk runner: write → push ONE undo entry → reload → toast → exit
  // selection mode. On failure the service throws naming committed-vs-total
  // chunks (R6: never silently partial) — surfaced verbatim in an error
  // toast, and the week reloads so any partially-committed chunks render
  // honestly. Selection is kept on failure so the agent can retry.
  const runBulk = useCallback(async ({ label, updates, priors, successMessage }) => {
    setBulkSaving(true);
    try {
      await bulkUpdateAppointments(tenantId, updates);
      history.push({
        label,
        undo: async () => { await bulkUpdateAppointments(tenantId, priors); },
        redo: async () => { await bulkUpdateAppointments(tenantId, updates); },
      });
      await load();
      toast.show({ message: successMessage, variant: 'info' });
      exitSelectMode();
    } catch (err) {
      await load();
      toast.show({
        message: err?.message || 'Bulk update failed — check your connection and try again.',
        variant: 'error',
      });
      setBulkSheet(null);
    } finally {
      setBulkSaving(false);
    }
  }, [tenantId, history, load, toast, exitSelectMode]);

  const handleBulkMove = useCallback(async ({ mode, date, shiftDays }) => {
    const targets = selectedAppts;
    if (targets.length === 0) return;
    const updates = targets.map((a) => ({
      id: a.id,
      patch: { date: mode === 'shift' ? shiftDateStr(a.date, shiftDays) : date },
    }));
    const priors = targets.map((a) => ({ id: a.id, patch: { date: a.date } }));
    await runBulk({
      label: `Bulk move (${targets.length})`,
      updates,
      priors,
      successMessage: `Moved ${targets.length} ${targets.length === 1 ? 'appointment' : 'appointments'}`,
    });
  }, [selectedAppts, runBulk]);

  const handleBulkCancel = useCallback(async () => {
    const targets = selectedAppts;
    if (targets.length === 0) return;
    const updates = targets.map((a) => ({ id: a.id, patch: { status: 'cancelled' } }));
    const priors = targets.map((a) => ({ id: a.id, patch: { status: a.status } }));
    await runBulk({
      label: `Bulk cancel (${targets.length})`,
      updates,
      priors,
      successMessage: `Cancelled ${targets.length} ${targets.length === 1 ? 'appointment' : 'appointments'}`,
    });
  }, [selectedAppts, runBulk]);

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
  // useCallback: referenced directly by the Run 9 A2 keyboard-shortcuts effect
  // below (the `n` shortcut), which needs a stable identity to avoid
  // resubscribing its document listener on every render.
  const openBook = useCallback((presetDate) => {
    setSheet({
      mode: 'create',
      showRepeat: true,
      initial: presetDate ? { date: presetDate, startTime: '09:00' } : { date: today, startTime: '09:00' },
    });
  }, [today]);

  const handleSheetSave = async (data, addAnother) => {
    setSheetSaving(true);
    setSheetError('');
    try {
      if (sheet?.variant === 'series-propagate' && sheet.initial?.id) {
        // Run 9 F3d — series field propagation ("this and future" / "all").
        // Diff the changed fields (never date) against the tapped instance's
        // hydrated values, then apply them to every in-window instance whose
        // status is scheduled/confirmed. Self-contained: owns its write error
        // handling (close + error toast, A5 idiom) so the outer catch's
        // inline-error path never applies to a bulk propagation.
        const changed = {};
        PROPAGATE_FIELDS.forEach((k) => {
          if (normalizePropagateValue(k, data[k]) !== normalizePropagateValue(k, sheet.initial[k])) {
            changed[k] = data[k];
          }
        });
        if (Object.keys(changed).length === 0) { setSheet(null); return; }
        try {
          const instances = await getSeriesInstances(tenantId, agentId, sheet.seriesId);
          // Scope anchor (TT today): "all" = date >= today; "this and future" =
          // date >= the tapped instance's date. Past instances never in-window (R1).
          const anchorDate = sheet.scope === 'future' ? sheet.initial.date : today;
          const inWindow = instances.filter((inst) => String(inst.date) >= anchorDate);
          const targets = inWindow.filter((inst) => PROPAGATE_STATUSES.has(inst.status));
          const skipped = inWindow.length - targets.length;
          if (targets.length === 0) {
            toast.show({ message: 'No scheduled occurrences to update', variant: 'info' });
            setSheet(null);
            return;
          }
          const updates = targets.map((inst) => ({ id: inst.id, patch: { ...changed } }));
          // Priors capture EACH instance's own current values for the changed
          // keys — undo restores per-instance state (R2), never a blanket value.
          const priors = targets.map((inst) => {
            const prior = {};
            Object.keys(changed).forEach((k) => { prior[k] = inst[k]; });
            return { id: inst.id, patch: prior };
          });
          await bulkUpdateAppointments(tenantId, updates);
          history.push({
            label: `Edit series (${targets.length})`,
            undo: async () => { await bulkUpdateAppointments(tenantId, priors); },
            redo: async () => { await bulkUpdateAppointments(tenantId, updates); },
          });
          await load();
          toast.show({
            message: skipped > 0
              ? `Updated ${targets.length} of ${inWindow.length} — ${skipped} completed/cancelled kept as-is`
              : `Updated ${targets.length} ${targets.length === 1 ? 'occurrence' : 'occurrences'}`,
            variant: 'info',
          });
          setSheet(null);
        } catch (err) {
          // Render committed chunks honestly, then surface the service's
          // count-naming message verbatim (never silently partial — R6).
          await load();
          toast.show({
            message: err?.message || 'Could not update the series — check your connection and try again.',
            variant: 'error',
          });
          setSheet(null);
        }
        return;
      }
      if (sheet?.rebookFrom) {
        // Postpone rebook (F3b: reschedule NO LONGER uses this path — it is now
        // an update-in-place on the same doc, see the edit branch below).
        // Postpone keeps the rebook+tombstone grammar: the new appt is a plain
        // one-off (series metadata is intentionally not carried forward — the
        // moved instance detaches; the original retains its series link as
        // postponed).
        const originalId = sheet.rebookFrom;
        const newIdRef = { current: await postponeWithRebook(tenantId, originalId, data, meta) };
        history.push({
          label: 'Postpone',
          // Redo re-creates docs (fresh id each time) — newIdRef tracks the
          // current rebooked doc id so a following undo targets it (A1 req 2).
          undo: async () => { await undoPostpone(tenantId, originalId, newIdRef.current); },
          redo: async () => { newIdRef.current = await postponeWithRebook(tenantId, originalId, data, meta); },
        });
      } else if (sheet?.mode === 'edit' && sheet.initial?.id) {
        const apptId = sheet.initial.id;
        const patch = {};
        const prior = {};
        EDIT_PATCH_FIELDS.forEach((k) => {
          if (data[k] !== sheet.initial[k]) {
            patch[k] = data[k];
            prior[k] = sheet.initial[k];
          }
        });
        await updateAppointment(tenantId, apptId, data);
        if (Object.keys(patch).length > 0) {
          history.push({
            // F3b: a reschedule is an edit-in-place variant — same doc, same
            // id, series metadata untouched (never in the patch allowlist).
            // Only the history label differs so the toast reads "Reschedule".
            label: sheet.variant === 'reschedule' ? 'Reschedule' : 'Edit appointment',
            // Undo writes back the prior values of EXACTLY the patched keys —
            // never the whole appointment (A1 req 2).
            undo: async () => { await updateAppointment(tenantId, apptId, prior); },
            redo: async () => { await updateAppointment(tenantId, apptId, patch); },
          });
        }
      } else if (data.recurrence) {
        const recurrence = data.recurrence;
        const created = await createRecurringAppointments(tenantId, data, recurrence, meta);
        const idsRef = { current: created.ids };
        history.push({
          label: `Create series (${created.count})`,
          undo: async () => {
            await Promise.all(idsRef.current.map((id) => deleteAppointment(tenantId, id)));
          },
          redo: async () => {
            const res = await createRecurringAppointments(tenantId, data, recurrence, meta);
            idsRef.current = res.ids;
          },
        });
      } else {
        const idRef = { current: await createAppointment(tenantId, data, meta) };
        history.push({
          label: 'Create appointment',
          undo: async () => { await deleteAppointment(tenantId, idRef.current); },
          redo: async () => { idRef.current = await createAppointment(tenantId, data, meta); },
        });
      }
      await load();
      if (!addAnother) setSheet(null);
    } catch {
      setSheetError('Could not save — check your connection and try again.');
    } finally {
      setSheetSaving(false);
    }
  };

  const openEditSheet = useCallback((appt, opts = {}) => {
    setSheet({
      mode: 'edit',
      // F3b: `variant:'reschedule'` reuses the edit mechanics (same-doc
      // updateAppointment) but re-titles the sheet + relabels the undo entry.
      // F3d: `variant:'series-propagate'` + `scope:'future'|'all'` drives the
      // series field-propagation edit; `seriesId` is the propagation query key.
      // `seriesInstance` drives the "only this occurrence moves" note row.
      variant: opts.variant ?? null,
      scope: opts.scope ?? null,
      seriesId: appt.seriesId ?? null,
      seriesInstance: Boolean(appt.seriesId),
      initial: {
        id: appt.id,
        type: appt.type, date: appt.date, startTime: appt.startTime,
        durationMin: appt.durationMin, prospectId: appt.prospectId,
        freeBlockLabel: appt.freeBlockLabel, note: appt.note, apiAmount: appt.apiAmount,
      },
    });
  }, []);

  // useCallback: referenced directly by the Run 9 A2 keyboard-shortcuts effect
  // below (the `e` shortcut) — same reason as openBook above.
  const handleChurnAction = useCallback(async (action, appt) => {
    if (action === 'running-late') {
      // E3: open the running-late cascade sheet for this appointment.
      setChurn(null);
      setLateSheet(appt);
      return;
    }
    if (action === 'edit') {
      // Edit-in-place. For a SERIES instance, raise the scope-choice sheet first
      // (state 3): "this only" routes to the standard edit path; series-wide edit
      // is deferred. One-offs open the edit sheet directly.
      setChurn(null);
      if (appt.seriesId) { setSeriesChoice(appt); return; }
      openEditSheet(appt);
      return;
    }
    if (action === 'save-template') {
      // Save-as-template: open the name-prompt sheet (not the undo history —
      // A4 req 6: template save/delete are NOT undoable).
      setChurn(null);
      setTemplatePrompt(appt);
      return;
    }
    if (action === 'reschedule') {
      // F3b (R4): Reschedule is an update-IN-PLACE on the SAME doc — identity
      // and series linkage preserved (contrast with postpone's rebook +
      // tombstone). Reuses the edit sheet via the `reschedule` variant. A
      // series instance reschedule is inherently "just this one" (a single-doc
      // update touches no other instance), so it opens the sheet directly with
      // a note row — it does NOT raise SeriesEditChoice the way Edit does.
      setChurn(null);
      openEditSheet(appt, { variant: 'reschedule' });
      return;
    }
    if (action === 'postpone') {
      // Postpone: retain the original as postponed + link forward to the new
      // appt (rebook + tombstone — unchanged by F3b). A SERIES instance
      // postpone is scope-LOCKED to "just this one" (state 4) — series-wide
      // moves go via Edit — with an amber consequence panel.
      setChurn(null);
      const isSeriesPostpone = Boolean(appt.seriesId);
      const nextDate = isSeriesPostpone
        ? nextOccurrenceDate({ date: appt.date, repeatRule: appt.repeatRule, daysOfWeek: appt.daysOfWeek })
        : null;
      setSheet({
        mode: 'create',
        rebookFrom: appt.id,
        seriesPostpone: isSeriesPostpone
          ? {
            pos: appt.seriesPos, total: appt.seriesTotal,
            origDateLabel: slotDayLabel(appt.date),
            cadence: cadenceLabel({ repeatRule: appt.repeatRule, daysOfWeek: appt.daysOfWeek, startDate: appt.date }),
            nextLabel: nextDate ? `${formatShortDate(nextDate)}, ${formatTime12(appt.startTime)}` : '',
          }
          : null,
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
      const priorStatus = appt.status;
      const priorApiAmount = appt.apiAmount;
      const newStatus = action === 'cancel' ? 'cancelled' : 'kept';
      await setAppointmentStatus(tenantId, appt.id, newStatus);
      history.push({
        label: action === 'cancel' ? 'Cancel appointment' : 'Mark kept',
        undo: async () => {
          await setAppointmentStatus(tenantId, appt.id, priorStatus,
            priorApiAmount !== undefined ? { apiAmount: priorApiAmount } : {});
        },
        redo: async () => { await setAppointmentStatus(tenantId, appt.id, newStatus); },
      });
      await load();
      setChurn(null);
    } catch {
      // Surface via a reload of the churn dialog's parent error is overkill;
      // keep the dialog open so the user can retry the tap.
    } finally {
      setChurnSaving(false);
    }
  }, [openEditSheet, tenantId, history, load]);

  // Run 9 A1: undo/redo runners — reload from Firestore, then toast the
  // action by label. A failed undo/redo (service rejects) surfaces an error
  // toast instead; the history hook itself restores the popped entry so the
  // action stays retryable.
  const runUndo = useCallback(async () => {
    try {
      const entry = await history.undo();
      if (!entry) return;
      await load();
      toast.show({ message: `Undid: ${entry.label}`, variant: 'info' });
    } catch {
      toast.show({ message: 'Could not undo — check your connection and try again.', variant: 'error' });
    }
  }, [history, load, toast]);

  const runRedo = useCallback(async () => {
    try {
      const entry = await history.redo();
      if (!entry) return;
      await load();
      toast.show({ message: `Redid: ${entry.label}`, variant: 'info' });
    } catch {
      toast.show({ message: 'Could not redo — check your connection and try again.', variant: 'error' });
    }
  }, [history, load, toast]);

  // Run 9 A4: save the prompted appointment's shape as a template. Enforces the
  // service's friendly cap (surfaces its error message on the 21st). NOT pushed
  // to the undo history (A4 req 6).
  const handleSaveTemplate = useCallback(async (name) => {
    const appt = templatePrompt;
    if (!appt) return;
    setTemplateSaving(true);
    try {
      await saveTemplate(tenantId, {
        name,
        type: appt.type,
        startTime: appt.startTime,
        durationMin: appt.durationMin,
        note: appt.note,
        freeBlockLabel: appt.freeBlockLabel,
        apiAmount: appt.apiAmount,
      }, meta);
      setTemplatePrompt(null);
      loadTemplates();
      toast.show({ message: `Saved template: ${name}`, variant: 'success' });
    } catch (err) {
      toast.show({
        message: err?.message || 'Could not save template — check your connection and try again.',
        variant: 'error',
      });
    } finally {
      setTemplateSaving(false);
    }
  }, [templatePrompt, tenantId, meta, loadTemplates, toast]);

  // Run 9 A4: delete a template (from the sheet picker). Toast on success; NOT
  // undoable (A4 req 6).
  const handleDeleteTemplate = useCallback(async (id) => {
    try {
      await deleteTemplate(tenantId, id);
      loadTemplates();
      toast.show({ message: 'Template deleted', variant: 'info' });
    } catch {
      toast.show({ message: 'Could not delete template — check your connection and try again.', variant: 'error' });
    }
  }, [tenantId, loadTemplates, toast]);

  // Run 9 A2: roving focus through the visible appointment cards (up/down).
  // Scoped to `contentRef` — only the currently-rendered view's cards are in
  // that subtree, so this never reaches into a hidden view. Wraps at the ends
  // (last ↓ → first, first ↑ → last); if nothing is focused yet, ↓ starts at
  // the first card and ↑ starts at the last. Pure DOM query + .focus() — no
  // extra "selected id" state to keep in sync with real focus.
  const moveCardFocus = useCallback((delta) => {
    const container = contentRef.current;
    if (!container) return;
    const cards = Array.from(container.querySelectorAll('button[data-testid^="appt-card-"]'));
    if (cards.length === 0) return;
    const activeIndex = cards.indexOf(document.activeElement);
    const nextIndex = activeIndex === -1
      ? (delta > 0 ? 0 : cards.length - 1)
      : (activeIndex + delta + cards.length) % cards.length;
    cards[nextIndex]?.focus();
  }, []);

  // Keyboard shortcuts (Run 9 A1 + A2 — single listener, extended coherently
  // rather than layering a second document keydown handler):
  //   Ctrl/Cmd+Z undo, Ctrl/Cmd+Y (or +Shift+Z) redo         — A1
  //   n            open the booking sheet (= the Book button) — A2
  //   ?  (Shift+/) open the shortcuts reference sheet          — A2
  //   ←/→          cycle Today ↔ Week ↔ Follow-ups (clamped)   — A2
  //   ↑/↓          rove focus through the visible appt cards   — A2
  //   e            edit the DOM-focused appt card (same path
  //                the churn dialog's Edit action uses, so a
  //                series instance still raises SeriesEditChoice) — A2
  // All shortcuts are ignored while a planner sheet/dialog is open (sheet,
  // churn, seriesChoice, shortcutsOpen) or while the event target is a form
  // field / contenteditable — never steals a keystroke mid-typing. Every
  // plain-key shortcut additionally requires NO modifier held (Shift
  // included) except `?`, which is only reachable via Shift+/. Distinct keys
  // from Shell.jsx's Ctrl/Cmd+K palette, so no collision. Active only while
  // this panel is mounted.
  useEffect(() => {
    const dialogOpen = Boolean(sheet || churn || seriesChoice || shortcutsOpen || templatePrompt || bulkSheet || lateSheet);
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        if (dialogOpen) return;
        if (isFormFieldTarget(e.target)) return;
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          runUndo();
        } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          runRedo();
        }
        return;
      }

      // Never touch any other modifier combo we don't own.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isFormFieldTarget(e.target)) return;

      // Run 9 A5: Escape exits selection mode — but ONLY when no dialog is
      // open (open dialogs own Escape via their focus traps; this guard keeps
      // the two from fighting over one keystroke).
      if (e.key === 'Escape') {
        if (dialogOpen) return;
        if (selectMode) {
          e.preventDefault();
          exitSelectMode();
        }
        return;
      }

      if (e.key === '?') {
        if (dialogOpen) return;
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      // Every remaining shortcut is plain-key only — Shift (or any other
      // modifier) held bails out here.
      if (e.shiftKey || dialogOpen) return;

      if (e.key === 'n') {
        e.preventDefault();
        openBook(view === 'today' ? today : weekStart);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = VIEWS.findIndex((v) => v.key === view);
        const delta = e.key === 'ArrowRight' ? 1 : -1;
        const nextIdx = Math.min(VIEWS.length - 1, Math.max(0, idx + delta));
        setView(VIEWS[nextIdx].key);
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        moveCardFocus(e.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      if (e.key === 'e') {
        const id = focusedApptId();
        const appt = id ? resolveAppt(id) : null;
        if (!appt) return;
        e.preventDefault();
        handleChurnAction('edit', appt);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [
    sheet, churn, seriesChoice, shortcutsOpen, templatePrompt, bulkSheet, lateSheet, selectMode,
    exitSelectMode, runUndo, runRedo,
    view, weekStart, today, openBook, handleChurnAction, resolveAppt, moveCardFocus,
  ]);

  // Follow-ups list — shared by the mobile Follow-ups view and the desktop
  // board's Follow-ups slot, so desktop keeps this view (E1: via the board's
  // 4th toggle option) that the single-column layout had.
  const followupsList = (
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
              onClick={() => setSheet({ mode: 'create', showRepeat: true, initial: { date: today, startTime: '09:00', prospectId: f.id, type: 'FFI' } })}
              className="min-h-[44px] px-3 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
            >
              Book
            </button>
          </div>
        ))
      )}
    </div>
  );

  // E4: the edited appointment's note thread + "active" (THIS MEETING) flag,
  // derived live from the loaded appts so a just-added note re-renders the sheet.
  const editAppt = sheet?.mode === 'edit' && sheet.initial?.id ? resolveAppt(sheet.initial.id) : null;
  const noteThread = editAppt ? readNoteThread(editAppt) : [];
  const noteDuringActive = editAppt ? appointmentIsActive(editAppt, today) : false;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`${isDesktop ? 'max-w-none' : 'max-w-3xl mx-auto'} px-4 py-6 screen-enter`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={20} className="text-primary" aria-hidden="true" />
          <h1 className="text-lg font-bold text-ink">Planner</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
            data-testid="planner-select-toggle"
            aria-pressed={selectMode}
            className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl border text-sm font-semibold transition-colors ${
              selectMode
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'border-border text-ink-muted hover:text-ink hover:bg-surface'
            }`}
          >
            <ListChecks size={16} aria-hidden="true" /> Select
          </button>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            data-testid="planner-shortcuts-open"
            aria-label="Keyboard shortcuts"
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-xl border border-border text-ink-muted hover:text-ink hover:bg-surface transition-colors"
          >
            <HelpCircle size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => openBook(view === 'today' ? today : weekStart)}
            data-testid="planner-book"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary transition-colors"
          >
            <Plus size={16} aria-hidden="true" /> Book
          </button>
        </div>
      </div>

      {/* View pills — mobile only; desktop uses the board's own view toggle */}
      {!isDesktop && (
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
      )}

      {/* Run 9 A5: selection count bar — visible whenever selection mode is on. */}
      {selectMode && (
        <div
          data-testid="planner-bulk-bar"
          className="flex items-center gap-2 flex-wrap mb-4 p-2 rounded-xl bg-primary/5 border border-primary/30"
        >
          <span className="text-sm font-semibold text-ink px-2" aria-live="polite">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={() => setBulkSheet('move')}
            disabled={selected.size === 0 || bulkSaving}
            data-testid="bulk-move"
            className="min-h-[44px] px-3 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-50"
          >
            Move
          </button>
          <button
            type="button"
            onClick={() => setBulkSheet('cancel')}
            disabled={selected.size === 0 || bulkSaving}
            data-testid="bulk-cancel"
            className="min-h-[44px] px-3 rounded-xl border border-danger/40 text-danger-ink text-sm font-semibold hover:bg-danger/5 transition-colors disabled:opacity-50"
          >
            Cancel appointments
          </button>
          <button
            type="button"
            onClick={exitSelectMode}
            data-testid="bulk-clear"
            className="min-h-[44px] px-3 ml-auto rounded-xl text-sm font-semibold text-ink-muted hover:text-ink transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* E3: running-late banner — auto-surfaced when an appt overran its end
          un-churned; opens the cascade sheet. Suppressed once the agent picks
          "Keep schedule" for that appt. */}
      {lateCandidate && !lateDismissed.has(lateCandidate.id) && !lateSheet && (
        <button
          type="button"
          onClick={() => setLateSheet(lateCandidate)}
          data-testid="running-late-banner"
          className="w-full flex items-center gap-2 mb-4 p-3 rounded-xl bg-warning/10 border border-warning/30 text-left hover:bg-warning/15 transition-colors"
        >
          <AlertTriangle size={16} className="text-warning-ink shrink-0" aria-hidden="true" />
          <span className="text-sm font-semibold text-warning-ink flex-1">
            Running late on your {formatTime12(lateCandidate.startTime)}
            {lateCandidate.prospectId ? ` · ${prospectName(lateCandidate.prospectId) || 'Prospect'}` : ''}?
          </span>
          <span className="text-xs font-semibold text-warning-ink underline shrink-0">Sort it out</span>
        </button>
      )}

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
        <div ref={contentRef}>
          {isDesktop ? (
            <PlannerDesktopBoard
              span={desktopSpan}
              onSpanChange={setDesktopSpan}
              today={today}
              weekDates={weekDates}
              byDate={byDate}
              onBook={openBook}
              renderCard={renderCard}
              onReschedule={handleReschedule}
              followupsSlot={followupsList}
              followupsCount={followups.length}
            />
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
                  <AppointmentCard key={a.id} appt={a} prospectName={prospectName(a.prospectId)} onChurn={setChurn} resolveAppt={resolveAppt} conflicted={conflicts.has(a.id)} selectMode={selectMode} selected={selected.has(a.id)} onToggleSelect={toggleSelect} />
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
                            <AppointmentCard key={a.id} appt={a} prospectName={prospectName(a.prospectId)} onChurn={setChurn} resolveAppt={resolveAppt} conflicted={conflicts.has(a.id)} selectMode={selectMode} selected={selected.has(a.id)} onToggleSelect={toggleSelect} />
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
          {view === 'followups' && followupsList}
          </>
          )}
        </div>
      )}

      {shortcutsOpen && (
        <PlannerShortcutsSheet onClose={() => setShortcutsOpen(false)} />
      )}

      {bulkSheet === 'move' && (
        <BulkMoveSheet
          count={selected.size}
          defaultDate={today}
          saving={bulkSaving}
          onApply={handleBulkMove}
          onClose={() => setBulkSheet(null)}
        />
      )}

      {bulkSheet === 'cancel' && (
        <BulkCancelConfirmSheet
          count={selected.size}
          saving={bulkSaving}
          onConfirm={handleBulkCancel}
          onClose={() => setBulkSheet(null)}
        />
      )}

      {sheet && (
        <AppointmentSheet
          mode={sheet.mode}
          variant={sheet.variant ?? null}
          scope={sheet.scope ?? null}
          seriesInstance={Boolean(sheet.seriesInstance)}
          initial={sheet.initial}
          prospects={prospects}
          appointments={appts}
          templates={templates}
          saving={sheetSaving}
          error={sheetError}
          showRepeat={Boolean(sheet.showRepeat)}
          seriesPostpone={sheet.seriesPostpone ?? null}
          noteThread={noteThread}
          onAddNote={handleAddNote}
          noteSaving={noteSaving}
          duringActive={noteDuringActive}
          onSave={handleSheetSave}
          onDeleteTemplate={handleDeleteTemplate}
          onClose={() => { setSheet(null); setSheetError(''); }}
        />
      )}

      {templatePrompt && (
        <TemplateNameSheet
          defaultName={`${templatePrompt.type} · ${formatTime12(templatePrompt.startTime)}`}
          saving={templateSaving}
          onSave={handleSaveTemplate}
          onClose={() => setTemplatePrompt(null)}
        />
      )}

      {seriesChoice && (
        <SeriesEditChoice
          contextLine={`${seriesChoice.type === 'FREE'
            ? (seriesChoice.freeBlockLabel || 'Free block')
            : (prospectName(seriesChoice.prospectId) || 'Prospect')} · ${cadenceLabel({
              repeatRule: seriesChoice.repeatRule, daysOfWeek: seriesChoice.daysOfWeek, startDate: seriesChoice.date,
            })}${seriesChoice.seriesPos && seriesChoice.seriesTotal ? ` · ${seriesChoice.seriesPos} of ${seriesChoice.seriesTotal}` : ''}`}
          onEditThisOnly={() => { const a = seriesChoice; setSeriesChoice(null); openEditSheet(a); }}
          onEditFuture={() => { const a = seriesChoice; setSeriesChoice(null); openEditSheet(a, { variant: 'series-propagate', scope: 'future' }); }}
          onEditAll={() => { const a = seriesChoice; setSeriesChoice(null); openEditSheet(a, { variant: 'series-propagate', scope: 'all' }); }}
          onClose={() => setSeriesChoice(null)}
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

      {lateSheet && (
        <RunningLateSheet
          lateAppt={lateSheet}
          appts={appts}
          prospectName={prospectName}
          prospectPhone={prospectPhone}
          saving={lateSaving}
          onPush={handlePushLate}
          onKeep={handleLateKeep}
          onWrapKept={handleLateWrapKept}
          onClose={() => setLateSheet(null)}
        />
      )}
    </div>
  );
}
