// PR-GPM1 — AgentPlanDrawer (read-only per-agent shared Money Needs projection).
//
// Opened from a TeamPlansRoster row. Renders ONLY the SHOWN projection the
// service produced (projectSharedWorksheet allow-list): commissions-required
// hero, first-year targets by line, renewal estimate, and the income aggregates
// (after-tax, pre-tax, PAYE). The household budget itself — every expense line,
// every sub-calculator — never reaches this component. No write affordances of
// any kind: the single action is Coach, which reuses CoachingNotesModal via
// onCoach (a coaching-notes surface, not a plan write).
//
// Reads nothing: the parent already fanned out this agent's projection; the row
// carries it, so the drawer is pure presentation (K10a drawer pattern).
import React, { useEffect, useRef } from 'react';
import { X, Lock, MessageSquare } from 'lucide-react';
import { formatCurrency, initials } from '../../utils/formatters';

const LINE_LABELS = { life: 'Life', ah: 'A&H', property: 'Property', motor: 'Motor' };

// updatedAt arrives as a Firestore Timestamp (or null). House format: DD-MM-YYYY.
function formatTimestampDDMMYYYY(ts) {
  const d = ts?.toDate?.() ?? (ts instanceof Date ? ts : null);
  if (!d || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function Stat({ label, value, testId }) {
  return (
    <div className="flex-1 min-w-[120px] rounded-lg border border-border bg-card-raised p-3 text-center">
      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-base font-extrabold text-ink" data-testid={testId}>{value}</p>
    </div>
  );
}

export default function AgentPlanDrawer({ row, onClose, onCoach }) {
  const closeRef = useRef(null);
  const coachRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { closeRef.current?.focus(); }, []);

  // Focus trap: the dialog has exactly two focusable elements (Close, Coach) —
  // cycle Tab/Shift+Tab between them so focus never escapes to the page behind
  // the overlay (CodeRabbit PR #785 review).
  useEffect(() => {
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const first = closeRef.current;
      const last = coachRef.current ?? first;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, []);

  if (!row?.plan) return null;
  const { plan } = row;
  const updatedLabel = formatTimestampDDMMYYYY(plan.updatedAt);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-plans-drawer-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        {/* Clarity mask — personal financial data (shared Money Needs projection); do not remove. */}
        <div
          data-clarity-mask="True"
          className="w-full max-w-lg max-h-[90vh] flex flex-col bg-card rounded-2xl shadow-lg border border-border overflow-hidden pointer-events-auto"
          data-testid="team-plans-drawer"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm shrink-0">
              {initials(row.agentName)}
            </div>
            <div className="min-w-0">
              <h2 id="team-plans-drawer-title" className="font-display font-extrabold text-base text-ink truncate">
                {row.agentName}
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Money Needs · {plan.year ?? '—'}{updatedLabel ? ` · updated ${updatedLabel}` : ''}
              </p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold font-mono uppercase tracking-wide bg-surface-muted text-ink-muted border border-border">
              <Lock size={11} aria-hidden="true" /> Read-only
            </span>
            <button
              ref={closeRef}
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors"
              aria-label="Close plan detail"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body — SHOWN projection only */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {/* Commissions-required hero */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center" data-testid="team-plans-drawer-hero">
              <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">First-year commissions required</p>
              <p className="mt-1 font-display text-3xl font-extrabold text-ink" data-testid="tpd-fyc-required">
                {formatCurrency(plan.firstYearCommissionsRequired)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">What this agent's plan needs from new business this year.</p>
            </div>

            {/* Targets by line */}
            <div data-testid="team-plans-drawer-targets">
              <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-2">First-year commission targets by line</p>
              <div className="flex items-stretch gap-2 flex-wrap">
                {Object.entries(LINE_LABELS).map(([key, label]) => (
                  <Stat key={key} label={label} value={formatCurrency(plan.firstYearCommissionsTargets?.[key])} testId={`tpd-target-${key}`} />
                ))}
              </div>
            </div>

            {/* Renewal estimate */}
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card-raised border border-border" data-testid="team-plans-drawer-renewal">
              <div>
                <p className="text-sm font-semibold text-ink">Estimated renewal income</p>
                <p className="text-xs text-ink-muted mt-0.5">Recurring income already working for the plan.</p>
              </div>
              <p className="font-display text-lg font-extrabold text-ink" data-testid="tpd-renewal-total">
                {formatCurrency(plan.estimatedRenewalIncome?.total)}
              </p>
            </div>

            {/* Income aggregates */}
            <div data-testid="team-plans-drawer-income">
              <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted mb-2">Income need · aggregates only</p>
              <div className="flex items-stretch gap-2 flex-wrap">
                <Stat label="Annual after tax" value={formatCurrency(plan.totalAnnualAfterTax)} testId="tpd-after-tax" />
                <Stat label="PAYE" value={formatCurrency(plan.computedPAYE)} testId="tpd-paye" />
                <Stat label="Annual pre-tax" value={formatCurrency(plan.totalAnnualPreTax)} testId="tpd-pre-tax" />
              </div>
              <p className="mt-2 text-[11px] text-ink-muted">
                The worksheet's line items stay private to the agent — you coach on the derived need, not the household budget.
              </p>
            </div>
          </div>

          {/* Footer — Coach is the only action */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border flex-shrink-0">
            <button
              ref={coachRef}
              type="button"
              onClick={() => onCoach(row)}
              data-testid="team-plans-drawer-coach"
              className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <MessageSquare size={14} aria-hidden="true" /> Coach
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
