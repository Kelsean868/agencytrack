import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { CalendarClock, Plus, RotateCw, ArrowRight, CheckCircle2, ClipboardCheck, HelpCircle, AlertTriangle } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';
import useFocusTrap from '../../hooks/useFocusTrap';
import { getTodayTT } from '../../utils/dateInputs';
import { formatCurrency } from '../../utils/formatters';
import { DEFAULT_WEEKLY_ACTIVITY_FLOORS } from '../../utils/weeklyActivityFloors';
import { getProspectInfo } from '../../services/prospectInfoService';
import {
  getAgentWeek, createAppointment, createRecurringAppointments, updateAppointment,
  setAppointmentStatus, postponeWithRebook, deleteAppointment, undoPostpone,
} from '../../services/plannerService';
import {
  listTemplates, saveTemplate, deleteTemplate,
} from '../../services/appointmentTemplateService';
import {
  weekRange, buildWeekDates, groupByDate, sortByStartTime,
  deriveFollowups, deriveSeedFromKept, formatTime12, dayLabel,
  RETIRED_STATUSES, detectConflicts,
} from './planner.helpers';
import {
  seriesRowLabel, cadenceLabel, nextOccurrenceDate, slotDayLabel, formatShortDate,
} from './recurrence.helpers';
import { ActivityChip, ApptStatusPill } from './plannerPrimitives';
import AppointmentSheet, { SeriesBadge } from './AppointmentSheet';
import SeriesEditChoice from './SeriesEditChoice';
import TemplateNameSheet from './TemplateNameSheet';
import PlannerShortcutsSheet from './PlannerShortcutsSheet';
import usePlannerHistory from './usePlannerHistory';
import useToast from '../../hooks/useToast';

// Fields openEditSheet hydrates into sheet.initial — the exact set undo/redo
// for an edit compares against to isolate "the fields that were patched"
// (Run 9 A1 requirement 2: undo writes prior values of EXACTLY those keys).
const EDIT_PATCH_FIELDS = [
  'type', 'date', 'startTime', 'durationMin',
  'prospectId', 'freeBlockLabel', 'note', 'apiAmount',
];

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

// Week-counter rows: booked (non-retired) planner appts of a type vs the weekly
// floor for the matching activity.
const WEEK_COUNTER_ROWS = [
  { type: 'CI',  floorKey: 'closingInterviewsKept', label: 'C.I' },
  { type: 'FFI', floorKey: 'factFindsCompleted',    label: 'F.F.I' },
  { type: 'PC',  floorKey: 'callsMade',             label: 'P.C' },
];

/** One appointment row — time · type · prospect/free label · status. Recurring
 * items carry a ↻ badge + a mono series line under a dashed hairline (state 2);
 * a postponed series instance shows the "moved / series stays" note (state 5). */
function AppointmentCard({ appt, prospectName, onChurn, resolveAppt, conflicted }) {
  const retired = RETIRED_STATUSES.has(appt.status);
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
      onClick={() => onChurn(appt)}
      data-testid={`appt-card-${appt.id}`}
      className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors ${
        retired
          ? 'bg-card border-border/50 opacity-60'
          : 'bg-card border-border hover:border-primary/40'
      }`}
    >
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
        {appt.note && <p className="text-xs text-ink-muted mt-0.5 truncate">{appt.note}</p>}

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
      if (sheet?.rebookFrom) {
        // Postpone/reschedule rebook: the new appt is a plain one-off (series
        // metadata is intentionally not carried forward — the moved instance
        // detaches; the original retains its series link as postponed).
        const originalId = sheet.rebookFrom;
        const label = sheet.rebookAction === 'reschedule' ? 'Reschedule' : 'Postpone';
        const newIdRef = { current: await postponeWithRebook(tenantId, originalId, data, meta) };
        history.push({
          label,
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
            label: 'Edit appointment',
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

  const openEditSheet = useCallback((appt) => {
    setSheet({
      mode: 'edit',
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
    if (action === 'reschedule' || action === 'postpone') {
      // Rebook: retain the original as postponed + link forward to the new appt.
      // A SERIES instance postpone is scope-LOCKED to "just this one" (state 4) —
      // series-wide moves go via Edit — with an amber consequence panel.
      setChurn(null);
      const isSeriesPostpone = action === 'postpone' && Boolean(appt.seriesId);
      const nextDate = isSeriesPostpone
        ? nextOccurrenceDate({ date: appt.date, repeatRule: appt.repeatRule, daysOfWeek: appt.daysOfWeek })
        : null;
      setSheet({
        mode: 'create',
        rebookFrom: appt.id,
        rebookAction: action, // 'reschedule' | 'postpone' — history label + future F3 branch point
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
    const dialogOpen = Boolean(sheet || churn || seriesChoice || shortcutsOpen || templatePrompt);
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
    sheet, churn, seriesChoice, shortcutsOpen, templatePrompt, runUndo, runRedo,
    view, weekStart, today, openBook, handleChurnAction, resolveAppt, moveCardFocus,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 screen-enter">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={20} className="text-primary" aria-hidden="true" />
          <h1 className="text-lg font-bold text-ink">Planner</h1>
        </div>
        <div className="flex items-center gap-2">
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
        <div ref={contentRef}>
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
                  <AppointmentCard key={a.id} appt={a} prospectName={prospectName(a.prospectId)} onChurn={setChurn} resolveAppt={resolveAppt} conflicted={conflicts.has(a.id)} />
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
                            <AppointmentCard key={a.id} appt={a} prospectName={prospectName(a.prospectId)} onChurn={setChurn} resolveAppt={resolveAppt} conflicted={conflicts.has(a.id)} />
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
                      onClick={() => setSheet({ mode: 'create', showRepeat: true, initial: { date: today, startTime: '09:00', prospectId: f.id, type: 'FFI' } })}
                      className="min-h-[44px] px-3 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
                    >
                      Book
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {shortcutsOpen && (
        <PlannerShortcutsSheet onClose={() => setShortcutsOpen(false)} />
      )}

      {sheet && (
        <AppointmentSheet
          mode={sheet.mode}
          initial={sheet.initial}
          prospects={prospects}
          appointments={appts}
          templates={templates}
          saving={sheetSaving}
          error={sheetError}
          showRepeat={Boolean(sheet.showRepeat)}
          seriesPostpone={sheet.seriesPostpone ?? null}
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
    </div>
  );
}
