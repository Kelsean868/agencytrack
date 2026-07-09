// RecDrillDrawer — item 2.2 candidate drill (ported from recruiting-v2 desktop
// RecDrillDrawer). One candidate: stage timeline, owner/referrer/source/days,
// editable note, and the stage-move + touch + reassign + archive actions.
//
// §4 dialog contract via useFocusTrap (Escape, focus-return, 44px close). The
// drawer calls the recruitingService directly and reports mutations up through
// onMutated() so the parent board refetches; it never holds Firestore data of
// its own. Archive drops the candidate from the active board, which unmounts
// the drawer at the parent (membership-driven close).
import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowRight, Hand, UserCog, Archive, Lock } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';
import {
  RECRUITING_STAGES, stageIndex, daysInStage, isStalled,
  moveCandidateStage, logTouch, reassignCandidate, archiveCandidate, updateCandidate,
} from '../../services/recruitingService';
import { CandidateAvatar, StagePill, StageTimeline } from './recruitingVisuals';
import { stageLabel } from './recruitingStageTone';

function InfoTile({ label, value }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-border bg-card-raised px-3.5 py-2.5">
      <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">{label}</p>
      <p className="text-sm font-semibold text-ink mt-0.5 truncate" title={value}>{value || '—'}</p>
    </div>
  );
}

export default function RecDrillDrawer({ candidate, tenantId, canReassign = false, owners = [], onClose, onMutated }) {
  const modalRef = useFocusTrap({ onEscape: onClose });
  const [note, setNote] = useState(candidate?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [reassignTo, setReassignTo] = useState('');
  const seq = useRef(0);

  // Reseed the editable note whenever the drawer swaps to a different candidate.
  useEffect(() => { setNote(candidate?.note ?? ''); setActionError(''); setConfirmArchive(false); }, [candidate?.id, candidate?.note]);

  if (!candidate) return null;

  const idx = stageIndex(candidate.stage);
  const hired = candidate.stage === 'licensed';
  const nextStage = idx >= 0 && idx < RECRUITING_STAGES.length - 1 ? RECRUITING_STAGES[idx + 1] : null;
  const days = daysInStage(candidate);
  const stalled = isStalled(candidate);
  const noteDirty = note !== (candidate.note ?? '');

  // Wrap a mutation: guard against overlapping clicks, surface errors, refetch.
  const run = async (fn) => {
    const s = ++seq.current;
    setBusy(true);
    setActionError('');
    try {
      await fn();
      if (s !== seq.current) return;
      await onMutated?.();
    } catch (e) {
      if (s !== seq.current) return;
      console.error('[RecDrillDrawer] action failed', e);
      setActionError('That action failed — check your connection and try again.');
    } finally {
      if (s === seq.current) setBusy(false);
    }
  };

  const handleAdvance = () => nextStage && run(() => moveCandidateStage(tenantId, candidate.id, nextStage.key));
  const handleStagePick = (e) => {
    const stage = e.target.value;
    if (stage && stage !== candidate.stage) run(() => moveCandidateStage(tenantId, candidate.id, stage));
  };
  const handleTouch = () => run(() => logTouch(tenantId, candidate.id));
  const handleSaveNote = () => run(() => updateCandidate(tenantId, candidate.id, { note }));
  const handleReassign = () => {
    const owner = owners.find((o) => o.uid === reassignTo);
    if (owner && owner.uid !== candidate.ownerUid) {
      run(() => reassignCandidate(tenantId, candidate.id, { ownerUid: owner.uid, ownerName: owner.name }));
    }
  };
  const handleArchive = () => run(() => archiveCandidate(tenantId, candidate.id));

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 sheet-backdrop" aria-hidden="true" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full">
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rec-drill-title"
          data-testid="rec-drill-drawer"
          className="w-screen max-w-md h-full flex flex-col bg-card border-l border-border shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
            <StagePill stage={candidate.stage} />
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close candidate view"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <CandidateAvatar name={candidate.name} stage={candidate.stage} size="lg" />
              <div className="min-w-0">
                <h2 id="rec-drill-title" className="font-display font-extrabold text-lg text-ink truncate">
                  {candidate.name}
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  {candidate.source || 'No source'} ·{' '}
                  {hired
                    ? 'licensed & active'
                    : stalled
                    ? <span className="text-warning-ink font-semibold">{days}d stalled</span>
                    : days != null ? `${days}d in stage` : '—'}
                </p>
              </div>
            </div>

            {/* Referrer + owner */}
            <div className="flex gap-2.5">
              <InfoTile label="Referred by" value={candidate.referrerName} />
              <InfoTile label="Owned by" value={candidate.ownerName} />
            </div>

            {/* Stage timeline */}
            <div>
              <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-primary mb-2.5">Pipeline stage</p>
              <StageTimeline stage={candidate.stage} />
            </div>

            {/* Note edit */}
            <div className="space-y-1.5">
              <label htmlFor="rec-drill-note" className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted">
                Latest note
              </label>
              <textarea
                id="rec-drill-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={busy}
                maxLength={2000}
                rows={3}
                placeholder="Add a note about this candidate…"
                className="w-full px-3 py-2 rounded-lg bg-card-raised border border-border text-ink text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              />
              {noteDirty && (
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={busy}
                  className="min-h-[44px] px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Save note
                </button>
              )}
            </div>

            {/* Reassign — senior-only */}
            {canReassign && owners.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold font-mono uppercase tracking-widest text-ink-muted flex items-center gap-1.5">
                  <UserCog size={12} aria-hidden="true" /> Reassign owner
                </p>
                <div className="flex gap-2">
                  <select
                    value={reassignTo}
                    onChange={(e) => setReassignTo(e.target.value)}
                    disabled={busy}
                    aria-label="Reassign to owner"
                    className="flex-1 h-11 px-3 rounded-lg bg-card border border-border text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
                  >
                    <option value="">Choose a manager…</option>
                    {owners.filter((o) => o.uid !== candidate.ownerUid).map((o) => (
                      <option key={o.uid} value={o.uid}>{o.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleReassign}
                    disabled={busy || !reassignTo}
                    data-testid="rec-reassign-btn"
                    className="min-h-[44px] px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Reassign
                  </button>
                </div>
              </div>
            )}

            {actionError && (
              <p className="text-sm text-danger-ink" role="alert" data-testid="rec-drill-error">{actionError}</p>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex-shrink-0 border-t border-border px-5 py-4 space-y-3">
            {hired ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 border border-success/30 px-4 py-3 text-sm font-semibold text-success-ink">
                <Lock size={14} aria-hidden="true" /> Hired &amp; active · counts toward your WAR
              </div>
            ) : (
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleAdvance}
                  disabled={busy || !nextStage}
                  data-testid="rec-advance-btn"
                  className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ArrowRight size={15} aria-hidden="true" />
                  {nextStage ? `Advance to ${nextStage.short}` : 'Advance'}
                </button>
                <button
                  type="button"
                  onClick={handleTouch}
                  disabled={busy}
                  data-testid="rec-touch-btn"
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-xl bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Hand size={15} aria-hidden="true" /> Log touch
                </button>
              </div>
            )}

            {/* Stage picker (advance OR regress) + archive */}
            <div className="flex items-center gap-2.5">
              <label htmlFor="rec-stage-picker" className="sr-only">Move to stage</label>
              <select
                id="rec-stage-picker"
                value={candidate.stage}
                onChange={handleStagePick}
                disabled={busy}
                className="flex-1 h-11 px-3 rounded-lg bg-card border border-border text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              >
                {RECRUITING_STAGES.map((s) => (
                  <option key={s.key} value={s.key}>Move to: {s.label}</option>
                ))}
              </select>
              {confirmArchive ? (
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={busy}
                  data-testid="rec-archive-confirm"
                  className="min-h-[44px] px-4 rounded-lg bg-danger/10 border border-danger/40 text-danger-ink text-sm font-semibold hover:bg-danger/20 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
                >
                  Confirm archive
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  disabled={busy}
                  aria-label="Archive candidate"
                  data-testid="rec-archive-btn"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg bg-card border border-border text-ink-muted hover:text-ink hover:bg-surface transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Archive size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-ink-muted text-center">
              {stageLabel(candidate.stage)} · archive removes the candidate from the board (no delete)
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
