// Track K · K10a — AgentFinancingDrawer (read-only per-agent financing detail).
//
// The BM's proration/override drawer MINUS the input. A Unit Manager opens it from
// a roster row to work an agent's gap before quarter-end: it shows the proration
// calc (actual ÷ validating = proration %), the LOCKED confirmed draw ("set by your
// Branch Manager · date"), and the adjustmentPct readout — every figure read-only.
// The two UM levers live in the footer: Coach (opens the reused CoachingNotesModal
// via onCoach) and Flag to BM (DEFERRED to K10b — rendered disabled, never a dead
// write). No managerFinancing / adjustmentPct write path exists for this role.
//
// Reads nothing: the parent already fanned out this agent's terms + ledger; the
// assembled row carries them, so the drawer is pure presentation.
import React, { useEffect, useRef } from 'react';
import { X, Lock, MessageSquare, Flag } from 'lucide-react';
import { formatCurrency, formatAdjustmentPct, initials } from '../../utils/formatters';
import { deriveBasisSource } from '../../services/financingService';
import FinancingStatusBadge from '../manager/FinancingStatusBadge';
import FinancingBasisBadge from '../manager/FinancingBasisBadge';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthKeyLabel(key) {
  if (typeof key !== 'string') return '';
  const [y, m] = key.split('_').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return key;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function Calc({ label, value, testId }) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-card-raised p-3 text-center">
      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-base font-extrabold text-ink" data-testid={testId}>{value}</p>
    </div>
  );
}

export default function AgentFinancingDrawer({ row, onClose, onCoach }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => { closeRef.current?.focus(); }, []);

  if (!row) return null;

  // The confirmed-draw month carries the proration calc (actual/validating) + the
  // stored basis. Fall back to a render-derived basis if the stored one is absent.
  const drawMonth = row.confirmedDrawMonth
    ? row.ledger?.find((r) => r.month === row.confirmedDrawMonth)
    : null;
  const actualAPI = drawMonth?.actualAPI;
  const validatingAPI = drawMonth?.validatingAPI;
  const prorationRatio = (Number.isFinite(actualAPI) && Number.isFinite(validatingAPI) && validatingAPI > 0)
    ? actualAPI / validatingAPI
    : null;
  const basisKey = drawMonth?.basisSource
    ?? (row.effectiveDate && row.confirmedDrawMonth ? deriveBasisSource(row.effectiveDate, row.confirmedDrawMonth) : null);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unit-financing-drawer-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="w-full max-w-lg max-h-[90vh] flex flex-col bg-card rounded-2xl shadow-lg border border-border overflow-hidden pointer-events-auto"
          data-testid="unit-financing-drawer"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm shrink-0">
              {initials(row.agentName)}
            </div>
            <div className="min-w-0">
              <h2 id="unit-financing-drawer-title" className="font-display font-extrabold text-base text-ink truncate">
                {row.agentName}
              </h2>
              <div className="mt-0.5"><FinancingStatusBadge status={row.status} /></div>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold font-mono uppercase tracking-wide bg-surface-muted text-ink-muted border border-border">
              <Lock size={11} aria-hidden="true" /> Read-only
            </span>
            <button
              ref={closeRef}
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-ink-muted hover:text-ink hover:bg-surface transition-colors"
              aria-label="Close financing detail"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
            {drawMonth ? (
              <>
                {/* Proration calc */}
                <div className="flex items-stretch gap-2" data-testid="unit-financing-drawer-calc">
                  <Calc label="Actual API" value={actualAPI != null ? formatCurrency(actualAPI) : '—'} testId="ufd-actual-api" />
                  <div className="flex items-center text-ink-muted">÷</div>
                  <Calc label="Validating" value={validatingAPI != null ? formatCurrency(validatingAPI) : '—'} testId="ufd-validating-api" />
                  <div className="flex items-center text-ink-muted">=</div>
                  <Calc
                    label="Proration"
                    value={prorationRatio != null ? `${Math.round(prorationRatio * 100)}%` : '—'}
                    testId="ufd-proration"
                  />
                </div>

                {/* Locked confirmed value */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card-raised border border-border" data-testid="unit-financing-drawer-confirmed">
                  <div>
                    <p className="text-sm font-semibold text-ink">Confirmed financing this month</p>
                    <p className="font-mono text-[10px] text-ink-muted mt-0.5">
                      set by your Branch Manager
                      {row.confirmedDrawMonth ? ` · ${monthKeyLabel(row.confirmedDrawMonth)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Lock size={13} className="text-ink-muted" aria-hidden="true" />
                    <span className="font-display font-extrabold text-xl text-ink" data-testid="ufd-confirmed-draw">
                      {row.confirmedDraw != null ? formatCurrency(row.confirmedDraw) : '—'}
                    </span>
                  </div>
                </div>

                {/* adjustmentPct readout */}
                <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card-raised border border-border" data-testid="unit-financing-drawer-adjustment">
                  <div>
                    <p className="text-sm font-semibold text-ink">Adjustment vs current schedule</p>
                    <p className="font-mono text-[10px] text-ink-muted mt-0.5 uppercase tracking-wide">
                      distance below current monthly financing · read-only
                    </p>
                  </div>
                  <span
                    className={[
                      'font-display font-extrabold text-xl',
                      row.adjustmentPct == null ? 'text-ink-muted' : row.adjustmentPct > 0 ? 'text-ink' : 'text-success-ink',
                    ].join(' ')}
                    data-testid="ufd-adjustment-pct"
                  >
                    {formatAdjustmentPct(row.adjustmentPct)}
                  </span>
                </div>

                {/* Basis badge — no figure without its basisSource */}
                {basisKey && (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-muted">Basis</span>
                    <FinancingBasisBadge basis={basisKey} />
                  </div>
                )}
              </>
            ) : (
              <div className="p-4 rounded-lg border border-border bg-card-raised text-sm text-ink-muted" data-testid="unit-financing-drawer-nodraw">
                No confirmed draw yet for this agent — your Branch Manager confirms the monthly financing on the Proration tab. You can still coach on production below.
              </div>
            )}

            {row.hasAdjFlag && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30" data-testid="unit-financing-drawer-adj-status">
                <Lock size={14} className="text-warning-ink shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-warning-ink leading-relaxed">
                  <span className="font-bold">Notify Sales Admin — with your Branch Manager.</span>{' '}
                  This confirmed draw is more than 10% below the schedule (clause 5.3). The notify duty is the
                  Branch Manager's, not yours — you see it so you can coach on production. The agent stays on financing.
                </p>
              </div>
            )}
          </div>

          {/* Footer — the UM's two levers (Flag deferred to K10b) */}
          <div className="flex gap-2 px-5 py-4 border-t border-border flex-shrink-0 bg-card">
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Tracked escalation to your Branch Manager — coming soon"
              data-testid="unit-financing-drawer-flag"
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold text-ink-muted bg-surface-muted opacity-60 cursor-not-allowed"
            >
              <Flag size={15} aria-hidden="true" /> Flag to BM
              <span className="font-mono text-[9px] uppercase tracking-wide">Soon</span>
            </button>
            <button
              type="button"
              onClick={() => onCoach?.(row)}
              data-testid="unit-financing-drawer-coach"
              className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <MessageSquare size={15} aria-hidden="true" /> Add coaching note
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
