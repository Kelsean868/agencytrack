import React, { useState, useMemo } from 'react';
import { X, Loader2, Search, Repeat, Minus, Plus, AlertTriangle, Bookmark, Trash2 } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import {
  APPOINTMENT_TYPES, FREE_BLOCK_LABELS,
} from '../../services/plannerService';
import {
  DOW_PICKER_ORDER, MAX_SERIES_INSTANCES, buildSeriesPreview,
  dayOfWeekKey, slotDayLabel,
} from './recurrence.helpers';
import { formatTime12, findConflictingAppointment } from './planner.helpers';

const REPEAT_CHIPS = [
  { key: 'none',   label: 'None',        repeats: false },
  { key: 'daily',  label: 'Daily',       repeats: true },
  { key: 'weekly', label: 'Weekly',      repeats: true },
  { key: 'custom', label: 'Custom days', repeats: true },
];
const DAY_GLYPH = { MON: 'M', TUE: 'T', WED: 'W', THU: 'T', FRI: 'F', SAT: 'S', SUN: 'S' };

/**
 * AppointmentSheet — add / edit / postpone an appointment (planner screens 4 +
 * recurrence states 1/4). Mobile bottom-sheet ↔ desktop centered dialog (§4
 * dialog contract via useFocusTrap). "Save & add another" keeps the sheet open
 * for rapid phone-day booking (single-create only).
 *
 * Recurrence (create-only, `showRepeat`): a REPEATS field (None / Daily / Weekly
 * / Custom days) reveals an ENDS field (On date / After # times; Never is
 * deferred — rendered disabled) + a plain-language series preview. When a rule
 * is chosen the CTA becomes "Book series" and onSave receives `data.recurrence`.
 *
 * Series postpone (`seriesPostpone`): a scope-LOCKED sheet (state 4) — "Just this
 * one" is the only live scope; "Whole series — use Edit" is a disabled chip — with
 * an amber consequence panel. Series-wide changes go through Edit, never Postpone.
 *
 * Conflict warning (`appointments`, Run 9 A3): when the chosen date/startTime/
 * durationMin overlaps another non-retired appointment in the loaded week, an
 * amber `aria-live="polite"` line names the clash. R7: warn-only — the Save
 * button is never disabled by a conflict.
 *
 * Templates (`templates`, Run 9 A4, create-only): a compact picker row above the
 * type control lets the agent apply a saved appointment SHAPE — fills type /
 * startTime / durationMin / note / freeBlockLabel / apiAmount into the form
 * (date stays as chosen). The row is hidden entirely when the agent has no
 * templates. A per-template delete affordance calls `onDeleteTemplate(id)`.
 *
 * Owns local form state; the parent owns the Firestore write (via onSave) and
 * passes `saving` / `error`. On a bad write the parent keeps the sheet open and
 * sets `error` — an inline role=alert card renders below the actions.
 */
export default function AppointmentSheet({
  mode = 'create',
  initial = null,
  prospects = [],
  appointments = [],
  templates = [],
  saving = false,
  error = '',
  showRepeat = false,
  seriesPostpone = null,
  onSave,
  onDeleteTemplate,
  onClose,
}) {
  const trapRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving });

  const [type, setType]           = useState(initial?.type ?? 'PC');
  const [date, setDate]           = useState(initial?.date ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00');
  const [durationMin, setDuration] = useState(String(initial?.durationMin ?? 30));
  const [prospectId, setProspectId] = useState(initial?.prospectId ?? '');
  const [freeBlockLabel, setFreeLabel] = useState(initial?.freeBlockLabel ?? FREE_BLOCK_LABELS[0]);
  const [note, setNote]           = useState(initial?.note ?? '');
  const [apiAmount, setApiAmount] = useState(
    initial?.apiAmount != null ? String(initial.apiAmount) : '');
  const [prospectQuery, setProspectQuery] = useState('');

  // Recurrence form state (only surfaced when showRepeat).
  const [repeatRule, setRepeatRule] = useState('none');
  const [customDays, setCustomDays] = useState([]);
  const [endType, setEndType]       = useState('count'); // 'count' | 'date'
  const [endCount, setEndCount]     = useState(12);
  const [endOnDate, setEndOnDate]   = useState('');

  const isFree = type === 'FREE';
  const showApi = type === 'SALE' || type === 'CI';
  const repeating = showRepeat && repeatRule !== 'none';

  const filteredProspects = useMemo(() => {
    const q = prospectQuery.trim().toLowerCase();
    const list = q
      ? prospects.filter((p) => (p.clientName || '').toLowerCase().includes(q))
      : prospects;
    return list.slice(0, 8);
  }, [prospects, prospectQuery]);

  const selectedProspect = prospects.find((p) => p.id === prospectId) || null;

  const endCondition = endType === 'date'
    ? { type: 'date', onDate: endOnDate }
    : { type: 'count', count: endCount };

  const previewText = useMemo(() => {
    if (!repeating) return '';
    return buildSeriesPreview({
      startDate: date, startTime, repeatRule,
      daysOfWeek: repeatRule === 'custom' ? customDays : [],
      endCondition,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeating, date, startTime, repeatRule, customDays, endType, endCount, endOnDate]);

  // Run 9 A3: conflict detection against the loaded week (`appointments`,
  // passed by the parent) — R7 warn-only, never blocks. Edit mode excludes
  // the appointment being edited from the comparison (self-overlap is not a
  // conflict). Recomputes live as the agent adjusts date/time/duration.
  const conflict = useMemo(
    () => findConflictingAppointment(
      { date, startTime, durationMin },
      appointments,
      mode === 'edit' ? initial?.id : null,
    ),
    [date, startTime, durationMin, appointments, mode, initial],
  );

  const buildData = () => ({
    type, date, startTime, durationMin, note,
    prospectId: isFree ? '' : prospectId,
    freeBlockLabel: isFree ? freeBlockLabel : '',
    apiAmount: showApi ? apiAmount : null,
    recurrence: repeating
      ? {
        repeatRule,
        daysOfWeek: repeatRule === 'custom' ? customDays : [],
        endCondition,
      }
      : null,
  });

  const canSave = Boolean(date && startTime && durationMin)
    && (!repeating || repeatRule !== 'custom' || customDays.length > 0)
    && (!repeating || endType !== 'date' || Boolean(endOnDate));

  const handleSave = (addAnother) => {
    if (!canSave || saving) return;
    onSave(buildData(), addAnother);
    if (addAnother) {
      // Keep type/date; reset the per-appointment fields for the next slot.
      setProspectId('');
      setProspectQuery('');
      setNote('');
      setApiAmount('');
    }
  };

  // Run 9 A4: apply a saved template — fills the appointment SHAPE into the
  // form (type/time/duration/note/free label/api). Date is deliberately left
  // as the agent's chosen date (templates carry no date).
  const applyTemplate = (tpl) => {
    setType(tpl.type ?? 'PC');
    setStartTime(tpl.startTime ?? '09:00');
    setDuration(String(tpl.durationMin ?? 30));
    setNote(tpl.note ?? '');
    setFreeLabel(tpl.freeBlockLabel ?? FREE_BLOCK_LABELS[0]);
    setApiAmount(tpl.apiAmount != null ? String(tpl.apiAmount) : '');
  };

  const showTemplates = mode === 'create' && !seriesPostpone && templates.length > 0;

  const pickRule = (key) => {
    setRepeatRule(key);
    if (key === 'custom' && customDays.length === 0 && date) {
      setCustomDays([dayOfWeekKey(date)]);
    }
  };
  const toggleDay = (key) => {
    setCustomDays((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };
  const stepCount = (delta) => {
    setEndCount((n) => Math.max(1, Math.min(MAX_SERIES_INSTANCES, Number(n || 1) + delta)));
  };

  const titleId = 'appt-sheet-title';
  const title = seriesPostpone
    ? 'Postpone appointment'
    : mode === 'edit' ? 'Edit appointment' : 'Book appointment';
  const primaryLabel = seriesPostpone
    ? 'Move this one'
    : repeating ? 'Book series' : 'Save';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={saving ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="appointment-sheet"
        className="relative w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-lg max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 bg-card border-b border-border/60">
          <h2 id={titleId} className="text-base font-bold text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full text-ink-muted hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          {/* Series postpone — scope lock + context (state 4) */}
          {seriesPostpone && (
            <div className="flex flex-col gap-3" data-testid="postpone-series-block">
              <div className="flex items-center gap-2 rounded-xl bg-card-raised border border-border px-3 py-2.5">
                <SeriesBadge />
                <span className="text-sm font-semibold text-ink flex-1">Part of a series</span>
                <span className="text-[11px] font-mono font-semibold text-ink-muted uppercase tracking-wide">
                  {seriesPostpone.pos} of {seriesPostpone.total}
                </span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">Applies to</span>
                <div className="flex flex-wrap gap-2">
                  <span
                    data-testid="postpone-scope-just-this"
                    className="inline-flex items-center min-h-[36px] px-3 rounded-full text-xs font-semibold bg-warning text-white"
                  >
                    Just this one
                  </span>
                  <span
                    data-testid="postpone-scope-series-disabled"
                    aria-disabled="true"
                    className="inline-flex items-center min-h-[36px] px-3 rounded-full text-xs font-semibold text-ink-dim border border-dashed border-border"
                  >
                    Whole series — use Edit
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Templates picker (Run 9 A4, create-only) — apply a saved shape.
              Hidden entirely when the agent has no templates. */}
          {showTemplates && (
            <div data-testid="appt-template-picker">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">
                <Bookmark size={12} aria-hidden="true" /> Templates
              </span>
              <div className="flex flex-wrap gap-2">
                {templates.map((tpl) => (
                  <span
                    key={tpl.id}
                    className="inline-flex items-center rounded-full border border-border bg-card-raised overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => applyTemplate(tpl)}
                      data-testid={`template-apply-${tpl.id}`}
                      title="Apply this template"
                      className="min-h-[44px] pl-3 pr-2 text-xs font-semibold text-ink-muted hover:text-primary transition-colors max-w-[12rem] truncate"
                    >
                      {tpl.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTemplate?.(tpl.id)}
                      data-testid={`template-delete-${tpl.id}`}
                      aria-label={`Delete template ${tpl.name}`}
                      className="min-h-[44px] px-2 flex items-center justify-center text-ink-muted hover:text-danger-ink border-l border-border transition-colors"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Type picker */}
          <div>
            <span className="block text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">
              Activity type
            </span>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Activity type">
              {APPOINTMENT_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  aria-pressed={type === t.key}
                  className={`min-h-[44px] rounded-lg text-xs font-semibold border transition-colors ${
                    type === t.key
                      ? 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark'
                      : 'bg-card-raised border-border text-ink-muted hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prospect search OR free-block label */}
          {isFree ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="appt-free-label" className="text-sm font-medium text-ink">Free block</label>
              <select
                id="appt-free-label"
                value={freeBlockLabel}
                onChange={(e) => setFreeLabel(e.target.value)}
                className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {FREE_BLOCK_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor="appt-prospect-search" className="text-sm font-medium text-ink">
                Prospect <span className="text-ink-muted font-normal">(optional)</span>
              </label>
              {selectedProspect ? (
                <div className="flex items-center justify-between gap-2 h-11 px-3 rounded-lg bg-primary/5 border border-primary/30">
                  <span className="text-sm font-semibold text-ink truncate">{selectedProspect.clientName}</span>
                  <button
                    type="button"
                    onClick={() => { setProspectId(''); setProspectQuery(''); }}
                    className="text-xs font-semibold text-primary hover:underline shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center h-11 px-3 rounded-lg bg-surface border border-border focus-within:ring-2 focus-within:ring-primary/40">
                    <Search size={15} className="text-ink-muted shrink-0" aria-hidden="true" />
                    <input
                      id="appt-prospect-search"
                      type="text"
                      value={prospectQuery}
                      onChange={(e) => setProspectQuery(e.target.value)}
                      placeholder={prospects.length ? 'Search your prospects…' : 'No prospects loaded'}
                      className="flex-1 ml-2 bg-transparent text-ink text-base focus:outline-none"
                    />
                  </div>
                  {prospectQuery.trim() && filteredProspects.length > 0 && (
                    <ul className="mt-1 rounded-lg border border-border divide-y divide-border/60 overflow-hidden">
                      {filteredProspects.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => { setProspectId(p.id); setProspectQuery(''); }}
                            className="w-full min-h-[44px] px-3 py-2 text-left text-sm text-ink hover:bg-surface transition-colors"
                          >
                            {p.clientName}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {/* Date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="appt-date" className="text-sm font-medium text-ink">
                {seriesPostpone ? 'New day' : 'Date'}
              </label>
              <input
                id="appt-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="appt-time" className="text-sm font-medium text-ink">Start time</label>
              <input
                id="appt-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="appt-duration" className="text-sm font-medium text-ink">Length (minutes)</label>
            <select
              id="appt-duration"
              value={durationMin}
              onChange={(e) => setDuration(e.target.value)}
              className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>

          {/* Conflict warning (Run 9 A3, R7 warn-only — save stays enabled) */}
          {conflict && (
            <div
              role="status"
              aria-live="polite"
              data-testid="appt-conflict-warning"
              className="flex items-center gap-1.5 rounded-lg bg-warning/10 border border-warning/30 px-3 py-2"
            >
              <AlertTriangle size={14} className="text-warning-ink shrink-0" aria-hidden="true" />
              <span className="text-xs font-medium text-warning-ink">
                Overlaps your {formatTime12(conflict.startTime)} appointment
              </span>
            </div>
          )}

          {/* REPEATS — recurrence rule (create only) */}
          {showRepeat && (
            <div data-testid="repeat-field">
              <span className="block text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">Repeats</span>
              <div className="flex flex-wrap gap-2">
                {REPEAT_CHIPS.map((r) => {
                  const on = repeatRule === r.key;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => pickRule(r.key)}
                      aria-pressed={on}
                      data-testid={`repeat-rule-${r.key}`}
                      className={`inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full text-sm font-semibold border transition-colors ${
                        on
                          ? 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark'
                          : 'bg-card-raised border-border text-ink-muted hover:border-primary/40 hover:text-primary'
                      }`}
                    >
                      {r.repeats && <Repeat size={13} aria-hidden="true" />}
                      {r.label}
                    </button>
                  );
                })}
              </div>

              {/* Custom day picker (44×44) */}
              {repeatRule === 'custom' && (
                <div className="flex gap-1.5 mt-3" role="group" aria-label="Repeat on days">
                  {DOW_PICKER_ORDER.map((key) => {
                    const on = customDays.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleDay(key)}
                        aria-pressed={on}
                        aria-label={key}
                        data-testid={`repeat-day-${key}`}
                        className={`w-11 h-11 rounded-xl text-sm font-bold border transition-colors ${
                          on
                            ? 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark'
                            : 'bg-card-raised border-border text-ink-muted hover:border-primary/40'
                        }`}
                      >
                        {DAY_GLYPH[key]}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ENDS — only once it repeats */}
              {repeating && (
                <div className="mt-3">
                  <span className="block text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">Ends</span>
                  <div className="flex flex-wrap gap-2">
                    {/* Never is deferred (concrete-materialization vs infinite series
                        conflict) — rendered as a disabled chip, matching the postpone
                        sheet's disabled-chip grammar. */}
                    <span
                      data-testid="ends-never-disabled"
                      aria-disabled="true"
                      title="Coming soon"
                      className="inline-flex items-center min-h-[44px] px-3 rounded-full text-sm font-semibold text-ink-dim border border-dashed border-border"
                    >
                      Never <span className="ml-1 text-[10px] font-mono uppercase">soon</span>
                    </span>
                    {[['date', 'On date'], ['count', 'After # times']].map(([key, label]) => {
                      const on = endType === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setEndType(key)}
                          aria-pressed={on}
                          data-testid={`ends-${key}`}
                          className={`inline-flex items-center min-h-[44px] px-3 rounded-full text-sm font-semibold border transition-colors ${
                            on
                              ? 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark'
                              : 'bg-card-raised border-border text-ink-muted hover:border-primary/40 hover:text-primary'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {endType === 'count' && (
                    <div className="flex items-center gap-3 mt-3">
                      <button
                        type="button"
                        onClick={() => stepCount(-1)}
                        aria-label="Fewer times"
                        data-testid="repeat-count-dec"
                        className="w-11 h-11 rounded-xl bg-card-raised border border-border text-ink flex items-center justify-center hover:border-primary/40"
                      >
                        <Minus size={16} aria-hidden="true" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={MAX_SERIES_INSTANCES}
                        value={endCount}
                        onChange={(e) => setEndCount(Math.max(1, Math.min(MAX_SERIES_INSTANCES, Number(e.target.value) || 1)))}
                        aria-label="Number of times"
                        data-testid="repeat-count-input"
                        className="w-16 h-11 text-center rounded-xl bg-surface border border-border text-ink text-base font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                      <button
                        type="button"
                        onClick={() => stepCount(1)}
                        aria-label="More times"
                        data-testid="repeat-count-inc"
                        className="w-11 h-11 rounded-xl bg-card-raised border border-border text-ink flex items-center justify-center hover:border-primary/40"
                      >
                        <Plus size={16} aria-hidden="true" />
                      </button>
                      <span className="text-sm text-ink-muted font-medium">times</span>
                    </div>
                  )}
                  {endType === 'date' && (
                    <div className="mt-3">
                      <label htmlFor="ends-on-date" className="sr-only">End date</label>
                      <input
                        id="ends-on-date"
                        type="date"
                        value={endOnDate}
                        min={date || undefined}
                        onChange={(e) => setEndOnDate(e.target.value)}
                        data-testid="ends-on-date"
                        className="h-11 px-3 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Plain-language series preview */}
              {previewText && (
                <div
                  data-testid="series-preview"
                  className="mt-3 flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2.5"
                >
                  <Repeat size={13} className="text-primary shrink-0" aria-hidden="true" />
                  <span className="text-xs font-medium text-primary">{previewText}</span>
                </div>
              )}
            </div>
          )}

          {/* API (for SALE / CI conversions) */}
          {showApi && !seriesPostpone && (
            <div className="flex flex-col gap-1">
              <label htmlFor="appt-api" className="text-sm font-medium text-ink">
                API written <span className="text-ink-muted font-normal">(TTD, optional)</span>
              </label>
              <div className="flex h-11 rounded-lg border border-border overflow-hidden bg-surface">
                <span className="flex items-center px-2 text-[11px] font-semibold text-ink-muted bg-surface border-r border-border shrink-0">TTD</span>
                <input
                  id="appt-api"
                  type="text"
                  inputMode="decimal"
                  value={apiAmount}
                  onChange={(e) => setApiAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  className="flex-1 px-2 bg-transparent text-ink text-base text-right focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
          )}

          {/* Note */}
          <div className="flex flex-col gap-1">
            <label htmlFor="appt-note" className="text-sm font-medium text-ink">
              Note <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="appt-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="Anything to remember…"
              className="px-3 py-2 rounded-lg bg-surface border border-border text-ink text-base focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Series postpone — amber consequence panel (state 4) */}
          {seriesPostpone && (
            <div
              data-testid="postpone-consequence"
              className="rounded-xl bg-warning/10 border border-warning/30 px-3 py-2.5 flex flex-col gap-1.5"
            >
              <p className="text-xs font-semibold text-warning-ink">
                Only {seriesPostpone.origDateLabel} moves to {slotDayLabel(date)} · {formatTime12(startTime)}
              </p>
              <p className="text-xs text-ink-muted">
                The series stays {seriesPostpone.cadence}{seriesPostpone.nextLabel ? ` · next: ${seriesPostpone.nextLabel}` : ''}
              </p>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2">
              <p className="text-sm text-danger-ink">{error}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="sticky bottom-0 z-10 flex items-center gap-2 px-4 py-3 bg-card border-t border-border/60">
          {mode === 'create' && !repeating && !seriesPostpone && (
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={!canSave || saving}
              data-testid="appt-save-another"
              className="flex-1 min-h-[44px] rounded-xl border border-primary text-primary font-semibold text-sm hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              Save &amp; add another
            </button>
          )}
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={!canSave || saving}
            data-testid="appt-save"
            className="flex-1 min-h-[44px] rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** ↻ series badge — teal-tint rounded square (mockup RecBadge). */
export function SeriesBadge({ size = 18 }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-md bg-primary/15 shrink-0"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Repeat size={size - 7} className="text-primary" strokeWidth={2.4} />
    </span>
  );
}
