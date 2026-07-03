// Track K · K10b — FinancingEscalationModal (the UM's "Flag to BM" raise form).
//
// A minimal reason(enum)/note form. The Unit Manager raises a TRACKED escalation
// on one of their own-unit agents' financing; the same-branch Branch Manager sees
// it in the Escalations inbox and acknowledges it. NO write path exists for any
// other role (rules: create is unit_manager-only, own-unit agent).
//
// The UM has NO read arm on financingEscalations (the inbox is the BM's surface),
// so this form cannot pre-check existing state. A same-month re-raise is rejected
// by the rules and surfaced here as the "already raised this month" state — never
// a dead button. Re-raise in a later month gets a fresh doc ID and is allowed.
import React, { useEffect, useRef, useState } from 'react';
import { X, Flag, ChevronDown, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createFinancingEscalation,
  ESCALATION_REASONS,
} from '../../services/financingEscalationService';

export default function FinancingEscalationModal({ row, onClose }) {
  const { user, userProfile, role, tenantId } = useAuth();
  const [reason, setReason] = useState(ESCALATION_REASONS[0].value);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // result: null | { created:true } | { alreadyRaised:true }
  const [result, setResult] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { closeRef.current?.focus(); }, []);

  if (!row) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    // Fail closed on a missing branch assignment — without a branchId the escalation
    // would be orphaned (no BM inbox keys on a null branchId). Real pilot data has
    // 100% branchId coverage, but guard rather than write an unreachable doc.
    if (!row.branchId) {
      setError('This agent has no branch assigned yet, so it can’t be routed to a Branch Manager. Ask your administrator to set the agent’s branch first.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await createFinancingEscalation({
        tenantId,
        agentId: row.agentId,
        agentName: row.agentName,
        agentUnitId: row.agentUnitId,
        branchId: row.branchId,
        raisedByUid: user.uid,
        raisedByName: userProfile?.name ?? userProfile?.email ?? 'Manager',
        raisedByRole: role ?? 'unit_manager',
        reason,
        note,
      });
      setResult(res.created ? { created: true } : { alreadyRaised: true });
    } catch (err) {
      console.error('[FinancingEscalationModal] raise failed', err);
      setError('Could not flag to your Branch Manager — check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="financing-escalation-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="w-full max-w-md flex flex-col bg-card rounded-2xl shadow-lg border border-border overflow-hidden pointer-events-auto"
          data-testid="financing-escalation-modal"
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border flex-shrink-0">
            <Flag size={18} className="text-primary" aria-hidden="true" />
            <h2 id="financing-escalation-title" className="text-base font-semibold text-ink">
              Flag to Branch Manager
            </h2>
            <span className="text-sm text-ink-muted truncate">— {row.agentName}</span>
            <button
              ref={closeRef}
              onClick={onClose}
              className="ml-auto min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors"
              aria-label="Close flag form"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          {result ? (
            <div className="px-5 py-6 flex flex-col items-center text-center gap-2" data-testid="financing-escalation-result">
              {result.created ? (
                <>
                  <CheckCircle2 size={32} className="text-success-ink" aria-hidden="true" />
                  <p className="text-sm font-semibold text-ink">Raised with your Branch Manager.</p>
                  <p className="text-xs text-ink-muted">
                    It's now in their Financing → Escalations inbox awaiting acknowledgement.
                  </p>
                </>
              ) : (
                <>
                  <Clock size={32} className="text-warning-ink" aria-hidden="true" />
                  <p className="text-sm font-semibold text-ink" data-testid="financing-escalation-already">
                    Already raised this month.
                  </p>
                  <p className="text-xs text-ink-muted">
                    You've already flagged {row.agentName} for this reason this month — it stays with your
                    Branch Manager. You can raise it again next month if needed.
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                data-testid="financing-escalation-done"
                className="mt-3 min-h-[44px] px-5 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-4">
              <p className="text-xs text-ink-muted leading-relaxed">
                Raise a tracked note to your Branch Manager about this agent's financing. Confirming draws,
                the clause-5.3 Sales-Admin notify, and status changes stay with the Branch Manager — this
                just puts it on their radar.
              </p>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">Reason</span>
                <div className="relative">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    data-testid="financing-escalation-reason"
                    className="w-full h-11 pl-3 pr-8 rounded-xl border border-border bg-card text-ink text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                  >
                    {ESCALATION_REASONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
                    aria-hidden="true"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  Note <span className="normal-case font-normal text-ink-muted/70">(optional)</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add any context for your Branch Manager…"
                  rows={3}
                  maxLength={2000}
                  data-testid="financing-escalation-note"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-card text-ink text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-ink-muted/60"
                />
              </label>

              {error && (
                <p className="text-xs text-danger-ink" role="alert" data-testid="financing-escalation-error">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] flex-1 rounded-xl border border-border text-sm font-semibold text-ink hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  data-testid="financing-escalation-submit"
                  className="min-h-[44px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <Flag size={15} aria-hidden="true" />
                  {submitting ? 'Flagging…' : 'Flag to BM'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
