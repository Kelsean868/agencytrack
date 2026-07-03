import React, { useState, useEffect, useId, useRef } from 'react';
import { X, Lock, Lightbulb, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import useFocusTrap from '../../hooks/useFocusTrap';

function NumField({ id, label, value, onChange, currency, floor, hint }) {
  const parsed = parseFloat(value) || 0;
  const belowFloor = floor !== undefined && parsed > 0 && parsed < floor;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-ink-muted font-medium">{label}</label>
      <div className={`flex items-center h-11 rounded-lg border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-primary/40 ${belowFloor ? 'border-warning' : 'border-border'}`}>
        {currency && <span className="text-xs text-ink-muted pl-3 pr-1 shrink-0">TTD</span>}
        <input
          id={id}
          type="number"
          min="0"
          step={currency ? '1000' : '1'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 h-full px-3 text-sm text-ink focus:outline-none bg-transparent"
        />
      </div>
      {belowFloor && floor !== undefined && (
        <span className="inline-flex items-center gap-1 text-[11px] text-warning-ink">
          <AlertTriangle size={11} />
          Below minimum ({currency ? formatCurrency(floor) : floor})
        </span>
      )}
      {hint && !belowFloor && (
        <span className="text-[11px] text-ink-muted">{hint}</span>
      )}
    </div>
  );
}

/**
 * RecommendLockDrawer — modal/bottom-sheet for setting a manager target on an
 * agent or tier, with a recommend-vs-lock toggle.
 *
 * Props:
 *   open       boolean — controls visibility
 *   onClose    () => void
 *   agentName  string — label shown in header
 *   initial    { targetAnnualAPI, targetAnnualApps, targetAnnualPersistency,
 *                targetWeeklyAPI, targetLocked } — pre-fill values
 *   annualAPIFloor  number — agent's tenure-resolved API floor (for floor mark)
 *   minimums   { annualApps, persistency } — company-flat floors
 *   onSave     (values, targetLocked) => Promise<void>
 *   saving     boolean
 */
export default function RecommendLockDrawer({
  open,
  onClose,
  agentName,
  initial = {},
  annualAPIFloor = 200000,
  minimums = { annualApps: 42, persistency: 90 },
  onSave,
  saving = false,
}) {
  const uid = useId();
  const [locked, setLocked]   = useState(initial.targetLocked === true);
  const [api, setApi]         = useState(initial.targetAnnualAPI         ?? '');
  const [apps, setApps]       = useState(initial.targetAnnualApps        ?? '');
  const [pers, setPers]       = useState(initial.targetAnnualPersistency ?? '');
  const [weeklyApi, setWeeklyApi] = useState(initial.targetWeeklyAPI     ?? '');
  const [error, setError]     = useState('');
  const dialogRef = useFocusTrap({ onEscape: onClose, escapeDisabled: !open || saving });
  const triggerElRef = useRef(null);

  // Re-seed whenever the drawer opens with new initial values.
  useEffect(() => {
    if (open) {
      setLocked(initial.targetLocked === true);
      setApi(initial.targetAnnualAPI         ?? '');
      setApps(initial.targetAnnualApps       ?? '');
      setPers(initial.targetAnnualPersistency ?? '');
      setWeeklyApi(initial.targetWeeklyAPI   ?? '');
      setError('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus management for always-mounted pattern (useFocusTrap's mount-effect fires
  // when open=false so dialogRef is null; this effect re-runs on open change instead).
  useEffect(() => {
    if (open) {
      triggerElRef.current = document.activeElement;
      const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const first = dialogRef.current?.querySelector(FOCUSABLE);
      first?.focus();
    } else {
      const el = triggerElRef.current;
      triggerElRef.current = null;
      el?.focus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setError('');
    try {
      await onSave(
        { targetAnnualAPI: api, targetAnnualApps: apps, targetAnnualPersistency: pers, targetWeeklyAPI: weeklyApi },
        locked,
      );
      onClose();
    } catch (e) {
      setError(e.message ?? 'Failed to save target. Please try again.');
    }
  };

  return (
    // Backdrop
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Set target for ${agentName}`}
    >
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — bottom-sheet on mobile, centered card on sm+ */}
      <div className="relative z-10 w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-lg flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Set target</p>
            <h2 className="text-base font-bold text-ink">{agentName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 flex items-center justify-center rounded-lg text-ink-muted hover:bg-border/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Recommend / Lock toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLocked(false)}
              className={`flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                !locked
                  ? 'bg-warning/10 border-warning/40 text-warning-ink'
                  : 'bg-transparent border-border text-ink-muted'
              }`}
            >
              <Lightbulb size={16} />
              Recommend
            </button>
            <button
              type="button"
              onClick={() => setLocked(true)}
              className={`flex-1 h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                locked
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'bg-transparent border-border text-ink-muted'
              }`}
            >
              <Lock size={16} />
              Lock
            </button>
          </div>

          {/* Context banner */}
          {!locked ? (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30">
              <Lightbulb size={16} className="text-warning-ink mt-0.5 shrink-0" />
              <p className="text-sm text-warning-ink">
                <span className="font-semibold">Suggested target</span> — a suggestion, not their commitment. The agent can set their own plan independently.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/8 border border-primary/25 dark:bg-primary-dark/10 dark:border-primary-dark/30">
              <Lock size={16} className="text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-primary">
                <span className="font-semibold">Binding floor</span> — the agent's personal commitment must meet or exceed these targets.
              </p>
            </div>
          )}

          {/* Floor mark */}
          <div className="flex flex-wrap gap-3 px-4 py-3 rounded-xl bg-surface border border-border text-xs text-ink-muted">
            <span className="font-semibold text-ink-muted uppercase tracking-wide">Company minimums</span>
            <span>API: <span className="font-semibold text-ink">{formatCurrency(annualAPIFloor)}</span></span>
            <span>Apps: <span className="font-semibold text-ink">{minimums.annualApps}</span></span>
            <span>Persistency: <span className="font-semibold text-ink">{minimums.persistency}%</span></span>
          </div>

          {/* Target inputs */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Annual targets</p>
            <NumField
              id={`${uid}-api`}
              label="Annual API (TTD)"
              value={api}
              onChange={setApi}
              currency
              floor={annualAPIFloor}
              hint={`Floor: ${formatCurrency(annualAPIFloor)}`}
            />
            <div className="grid grid-cols-2 gap-3">
              <NumField
                id={`${uid}-apps`}
                label="Annual Apps"
                value={apps}
                onChange={setApps}
                floor={minimums.annualApps}
                hint={`Min: ${minimums.annualApps}`}
              />
              <NumField
                id={`${uid}-pers`}
                label="Persistency %"
                value={pers}
                onChange={setPers}
                floor={minimums.persistency}
                hint={`Min: ${minimums.persistency}%`}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Weekly target (optional)</p>
            <NumField
              id={`${uid}-weekly-api`}
              label="Weekly API (TTD)"
              value={weeklyApi}
              onChange={setWeeklyApi}
              currency
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger-ink">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-ink-muted hover:bg-border/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-11 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : null}
            {locked ? 'Save locked target' : 'Save suggested target'}
          </button>
        </div>
      </div>
    </div>
  );
}
