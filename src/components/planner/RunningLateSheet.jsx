import React, { useState, useMemo } from 'react';
import { Clock, Phone, MessageCircle, Copy, Loader2, Check } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import { computeLateCascade, formatTime12 } from './planner.helpers';

const PUSH_OPTIONS = [10, 20, 30];

/**
 * RunningLateSheet — Planner v2 E3 running-late cascade (mobile bottom sheet /
 * desktop modal). Gap-smart: recommends "next meeting only" when the gap after
 * the next appt absorbs the push, else "everything after". Push +10/+20/+30;
 * live cascade preview (old → new, struck old); the primary action shifts the
 * affected appointments' times (parent batches the write via bulkUpdate).
 *
 * Notify is DISPLAY-ONLY per D4: Call (`tel:`) / WhatsApp (`wa.me`) deep links
 * (only when the prospect has a phone) + a copy-on-tap prepared message
 * (clipboard). NO send path — no CF, no API, no notification service.
 */
function prepMessage(pushMin, newTime) {
  return `Running ~${pushMin} min behind — still good for ${formatTime12(newTime)}?`;
}

function NotifyRow({ name, phone, message }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* clipboard unavailable — no-op, the message is still visible */ }
  };
  const wa = phone ? `https://wa.me/${String(phone).replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}` : null;
  return (
    <div data-testid="late-notify-row" className="flex items-center gap-2 flex-wrap rounded-lg bg-card-raised border border-border px-3 py-2">
      <span className="text-sm font-semibold text-ink flex-1 min-w-0 truncate">{name}</span>
      {phone && (
        <>
          <a
            href={`tel:${phone}`}
            data-testid="late-notify-call"
            className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg border border-border text-xs font-semibold text-ink-muted hover:text-primary transition-colors"
          >
            <Phone size={13} aria-hidden="true" /> Call
          </a>
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="late-notify-whatsapp"
            className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg border border-border text-xs font-semibold text-ink-muted hover:text-primary transition-colors"
          >
            <MessageCircle size={13} aria-hidden="true" /> WhatsApp
          </a>
        </>
      )}
      <button
        type="button"
        onClick={copy}
        data-testid="late-notify-copy"
        className="inline-flex items-center gap-1 min-h-[36px] px-2.5 rounded-lg border border-border text-xs font-semibold text-ink-muted hover:text-primary transition-colors"
      >
        {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy message'}
      </button>
    </div>
  );
}

export default function RunningLateSheet({
  lateAppt, appts = [], prospectName, prospectPhone,
  onPush, onKeep, onWrapKept, saving = false, onClose,
}) {
  const trapRef = useFocusTrap({ onEscape: onClose, escapeDisabled: saving });
  const [pushMin, setPushMin] = useState(20);
  // recommendedScope depends on pushMin; initialise from the +20 default, then
  // let the agent override.
  const initial = useMemo(() => computeLateCascade(appts, lateAppt, 20, 'next'), [appts, lateAppt]);
  const [scope, setScope] = useState(initial.recommendedScope);

  const cascade = useMemo(
    () => computeLateCascade(appts, lateAppt, pushMin, scope),
    [appts, lateAppt, pushMin, scope],
  );
  const gapCopy = Number.isFinite(cascade.gapAfterNextMin)
    ? `a ${cascade.gapAfterNextMin}m gap follows your next meeting`
    : 'nothing is booked after your next meeting';

  const nameOf = (id) => (id && prospectName ? prospectName(id) : null) || 'Prospect';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Running late"
        data-testid="running-late-sheet"
        className="relative w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl shadow-lg max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-card border-b border-border/60">
          <Clock size={18} className="text-warning-ink" aria-hidden="true" />
          <h2 className="text-base font-bold text-ink flex-1">Running late</h2>
          <span className="text-xs font-mono text-ink-muted">
            {formatTime12(lateAppt?.startTime)} · {nameOf(lateAppt?.prospectId)}
          </span>
        </div>

        <div className="px-4 py-4 flex flex-col gap-4">
          {/* What moves */}
          <div>
            <span className="block text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">What moves</span>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="What moves">
              <button
                type="button"
                role="radio"
                aria-checked={scope === 'next'}
                onClick={() => setScope('next')}
                data-testid="late-scope-next"
                className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  scope === 'next' ? 'bg-primary/5 border-primary' : 'bg-card border-border'
                }`}
              >
                <span className="block text-sm font-semibold text-ink">Next meeting only</span>
                <span className="block text-xs text-ink-muted">{gapCopy} — the rest of today is unaffected</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={scope === 'all'}
                onClick={() => setScope('all')}
                data-testid="late-scope-all"
                className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                  scope === 'all' ? 'bg-primary/5 border-primary' : 'bg-card border-border'
                }`}
              >
                <span className="block text-sm font-semibold text-ink">Everything after this</span>
                <span className="block text-xs text-ink-muted">cascade every later appointment by the push</span>
              </button>
            </div>
          </div>

          {/* Push by */}
          <div>
            <span className="block text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">Push back by</span>
            <div className="flex gap-2">
              {PUSH_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPushMin(m)}
                  aria-pressed={pushMin === m}
                  data-testid={`late-push-${m}`}
                  className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold border transition-colors ${
                    pushMin === m
                      ? 'bg-primary dark:bg-primary-dark text-white border-primary dark:border-primary-dark'
                      : 'bg-card-raised border-border text-ink-muted hover:border-primary/40'
                  }`}
                >
                  +{m}m
                </button>
              ))}
            </div>
          </div>

          {/* Cascade preview */}
          <div>
            <span className="block text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">Preview</span>
            {cascade.affected.length === 0 ? (
              <p data-testid="late-preview-empty" className="text-xs text-ink-muted italic">Nothing later to move.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {cascade.affected.map((a) => (
                  <li key={a.id} data-testid={`late-affected-${a.id}`} className="flex items-center gap-2 text-sm">
                    <span className="text-ink-muted line-through tabular-nums">{formatTime12(a.oldStartTime)}</span>
                    <span aria-hidden="true">→</span>
                    <span className="font-semibold text-ink tabular-nums">{formatTime12(a.newStartTime)}</span>
                    <span className="text-xs text-ink-muted truncate">{nameOf(a.prospectId)}</span>
                  </li>
                ))}
                {cascade.unaffected.map((a) => (
                  <li key={a.id} data-testid={`late-unaffected-${a.id}`} className="flex items-center gap-2 text-xs text-ink-muted">
                    <span className="tabular-nums">{formatTime12(a.startTime)}</span>
                    <span>not affected — outside the push</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Notify (display-only — D4: deep links + clipboard, no send) */}
          {cascade.affected.some((a) => a.prospectId) && (
            <div>
              <span className="block text-xs font-semibold text-ink-muted mb-2 uppercase tracking-wide">Notify</span>
              <div className="flex flex-col gap-2">
                {cascade.affected.filter((a) => a.prospectId).map((a) => (
                  <NotifyRow
                    key={a.id}
                    name={nameOf(a.prospectId)}
                    phone={prospectPhone ? prospectPhone(a.prospectId) : null}
                    message={prepMessage(pushMin, a.newStartTime)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 z-10 flex flex-col gap-2 px-4 py-3 bg-card border-t border-border/60">
          <button
            type="button"
            onClick={() => onPush?.(pushMin, scope)}
            disabled={saving || cascade.affected.length === 0}
            data-testid="late-push-apply"
            className="min-h-[44px] rounded-xl bg-primary dark:bg-primary-dark text-white font-semibold text-sm hover:bg-primary/90 dark:hover:bg-primary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Pushing…</> : `Push back +${pushMin}m`}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onWrapKept}
              disabled={saving}
              data-testid="late-wrap-kept"
              className="flex-1 min-h-[44px] rounded-xl border border-border text-ink font-semibold text-sm hover:bg-surface transition-colors disabled:opacity-50"
            >
              Wrap up · mark Kept
            </button>
            <button
              type="button"
              onClick={onKeep}
              disabled={saving}
              data-testid="late-keep"
              className="flex-1 min-h-[44px] rounded-xl text-ink-muted font-semibold text-sm hover:text-ink transition-colors disabled:opacity-50"
            >
              Keep schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
