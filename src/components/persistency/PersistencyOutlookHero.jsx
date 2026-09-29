import React, { useId, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

import {
  formatOutlookPct,
  persistencyTone,
  HO_CONFIRMED_SOURCE,
  PERSISTENCY_OUTLOOK_STALE_MESSAGE,
} from '../../lib/persistency/persistencyOutlook';
import { TATIL_24M_LABELS } from '../../lib/persistency/model';
import { formatCurrency } from '../../utils/formatters';
import { formatPersistencyPct } from '../../lib/persistency/persistencyRounding';
import AnnuityRuleSwitch from './AnnuityRuleSwitch';
import PanelSkeleton from '../ui/PanelSkeleton';
import { outlookMonthLabel, outlookMonthEndLabel, outlookDateLabel } from './outlookLabels';

const TONE_TEXT = {
  success: 'text-success-ink',
  warning: 'text-warning-ink',
  danger:  'text-danger-ink',
  neutral: 'text-ink',
};

const TONE_DOT = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger:  'bg-danger',
  neutral: 'bg-ink-dim',
};

const listOf = (ids) => ids.map((id) => TATIL_24M_LABELS[id] ?? id).join(', ');

function Figure({ label, pct, tone, caption, testId, children }) {
  return (
    <div className="flex flex-col gap-1 min-w-0" data-testid={testId}>
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${TONE_DOT[tone]}`} aria-hidden="true" />
        <span className={`text-2xl font-bold tabular-nums ${TONE_TEXT[tone]}`} data-testid={`${testId}-pct`}>{pct}</span>
        {children}
      </div>
      {caption && <p className="text-xs text-ink-muted">{caption}</p>}
    </div>
  );
}

/**
 * PersistencyOutlookHero — the Persistency tab's top card. Every figure here
 * comes from ONE `buildPersistencyOutlook` result; this component derives
 * nothing.
 *
 * Tone: below the threshold is warning. Danger is reserved for a CONFIRMED
 * gate-month figure below the threshold, which this card never shows before the
 * gate month is saved.
 */
export default function PersistencyOutlookHero({
  outlook, loading = false, error = '', onRetry,
  canConfirm = false, onConfirm,
  annuityRule, onAnnuityRuleChange,
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const infoId = useId();

  if (loading) {
    return (
      <div className="card p-6">
        <PanelSkeleton variant="metric-row" count={3} label="Loading persistency outlook…" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="card flex items-center gap-2 text-sm text-danger-ink flex-wrap" data-testid="persistency-outlook-error">
        <AlertCircle size={16} className="shrink-0" />
        <span className="flex-1">{error}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const { confirmed, derived, estimateToday, ifPendingSettle, gateMonth, headline, assumptions } = outlook ?? {};

  if (!headline && !estimateToday) {
    return (
      <div className="card flex flex-col gap-1" data-testid="persistency-outlook-empty">
        <p className="text-xs font-bold font-mono uppercase tracking-widest text-ink-muted">24-month persistency</p>
        <p className="text-sm text-ink-muted">
          No figure yet. Import a portfolio export, or enter a month through Self-entry below.
        </p>
      </div>
    );
  }

  const threshold = gateMonth?.threshold ?? 90;
  const showConfirmed = headline?.kind === 'confirmed';

  return (
    <div className="card flex flex-col gap-4" data-testid="persistency-outlook-hero">
      <p className="text-xs font-bold font-mono uppercase tracking-widest text-ink-muted">24-month persistency</p>

      {outlook.stale && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-warning-tint border border-warning/30" data-testid="persistency-outlook-stale">
          <AlertTriangle size={14} className="text-warning-ink shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-warning-ink font-semibold">{PERSISTENCY_OUTLOOK_STALE_MESSAGE}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {showConfirmed ? (
          <Figure
            label={`Confirmed · ${outlookMonthLabel(confirmed.monthKey)}`}
            pct={formatOutlookPct(confirmed.persistency)}
            tone={persistencyTone(confirmed.persistency, { threshold })}
            caption={[
              confirmed.source === HO_CONFIRMED_SOURCE ? 'Checked against the HO report' : 'Saved record',
              confirmed.annuityRuleLabel,
            ].filter(Boolean).join(' · ')}
            testId="persistency-outlook-confirmed"
          />
        ) : derived && (
          <Figure
            label={`Derived · ${outlookMonthLabel(derived.monthKey)}`}
            pct={formatOutlookPct(derived.persistency)}
            tone={persistencyTone(derived.persistency, { threshold })}
            caption={[
              `From the HO export of ${outlookDateLabel(derived.exportDate)} · ${derived.annuityRuleLabel}`,
              derived.confirmable ? null : 'Confirm opens from Sep 2026: head office reports earlier months on the 12-month model.',
            ].filter(Boolean).join('. ')}
            testId="persistency-outlook-derived"
          >
            {canConfirm && (
              <button
                type="button"
                onClick={onConfirm}
                className="min-h-[44px] px-3 rounded-lg border border-primary text-primary text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-primary/10 transition-colors"
                data-testid="persistency-outlook-confirm"
              >
                <CheckCircle2 size={14} /> Confirm
              </button>
            )}
          </Figure>
        )}

        {estimateToday && (
          <Figure
            label={`Estimated today · ${outlookMonthLabel(estimateToday.monthKey)}`}
            pct={formatOutlookPct(estimateToday.persistency)}
            tone={persistencyTone(estimateToday.persistency, { threshold })}
            caption={`Export plus policies you have keyed · ${estimateToday.annuityRuleLabel}`}
            testId="persistency-outlook-estimate"
          >
            <button
              type="button"
              onClick={() => setInfoOpen((v) => !v)}
              aria-expanded={infoOpen}
              aria-controls={infoId}
              aria-label="What this estimate assumes"
              className="min-h-[44px] min-w-[44px] rounded-lg hover:bg-card-raised inline-flex items-center justify-center text-ink-muted"
              data-testid="persistency-outlook-info"
            >
              <Info size={16} />
            </button>
          </Figure>
        )}
      </div>

      {infoOpen && assumptions && (
        <div id={infoId} className="p-3 rounded-xl bg-card-raised border border-border flex flex-col gap-2 text-sm text-ink" data-testid="persistency-outlook-assumptions">
          {assumptions.assumedZero.length > 0 && (
            <p data-testid="assumptions-assumed-zero">
              <strong>Assumed 0 (not in the export):</strong> {listOf(assumptions.assumedZero)}
            </p>
          )}
          {assumptions.fromRecord.length > 0 && (
            <p data-testid="assumptions-from-record">
              <strong>From your saved record:</strong> {listOf(assumptions.fromRecord)}
            </p>
          )}
          <p data-testid="assumptions-export">
            <strong>Export:</strong> {assumptions.exportDate
              ? `${outlookDateLabel(assumptions.exportDate)} · ${assumptions.daysSinceExport} ${assumptions.daysSinceExport === 1 ? 'day' : 'days'} ago`
              : 'none imported'}
          </p>
          <p data-testid="assumptions-rule"><strong>Rule:</strong> {assumptions.annuityRuleLabel}</p>
          {onAnnuityRuleChange && (
            <AnnuityRuleSwitch value={annuityRule} onChange={onAnnuityRuleChange} />
          )}
        </div>
      )}

      {ifPendingSettle && (
        <p className="text-sm text-ink" data-testid="persistency-outlook-if-pending">
          If your {ifPendingSettle.pendingCount} pending {ifPendingSettle.pendingCount === 1 ? 'policy settles' : 'policies settle'}
          {' '}({formatCurrency(ifPendingSettle.pendingApi)}): <strong>{formatOutlookPct(ifPendingSettle.persistency)}</strong>
        </p>
      )}

      {/* FR-6 — declared reinstatements, BESIDE the evidenced estimate and never
          inside it (Option A; never feeds awards, financing or commission). */}
      {estimateToday?.declared?.policies?.length > 0 && (
        <p className="text-sm text-ink" data-testid="persistency-outlook-declared">
          With your declared reinstatements: <strong className="tabular-nums">{formatPersistencyPct(estimateToday.declared.persistency * 100)}</strong>
          <span className="text-ink-muted">
            {' '}({estimateToday.declared.policies.length} {estimateToday.declared.policies.length === 1 ? 'policy' : 'policies'}, waiting for head office · evidenced {formatPersistencyPct(estimateToday.persistency * 100)})
          </span>
        </p>
      )}

      {gateMonth && (
        <div className="flex flex-col gap-1 pt-3 border-t border-border" data-testid="persistency-outlook-gate">
          <p className="text-sm text-ink">
            <strong>{outlookMonthLabel(gateMonth.monthKey)} projection:</strong>{' '}
            <span className={`font-bold tabular-nums ${TONE_TEXT[persistencyTone(gateMonth.persistency, { threshold })]}`} data-testid="persistency-outlook-gate-pct">
              {formatOutlookPct(gateMonth.persistency)}
            </span>
            {` against ${threshold}% needed, if no new business is added.`}
          </p>
          {gateMonth.meetsThreshold ? (
            <p className="text-sm text-success-ink" data-testid="persistency-outlook-gap">On track for the gate.</p>
          ) : (
            <p className="text-sm text-ink" data-testid="persistency-outlook-gap">
              {`To reach ${threshold}%: ${formatCurrency(gateMonth.gap.settledApiNeeded)} of new settled API issued by ${outlookMonthEndLabel(gateMonth.monthKey)} that does not lapse, or reinstate ${formatCurrency(gateMonth.gap.reinstateNeeded)} of lapses, or a mix.`}
              {gateMonth.gap.closedByTarget && (
                <strong data-testid="persistency-outlook-gap-target">
                  {` Reaching ${gateMonth.gap.closedByTarget.name} (${formatCurrency(gateMonth.gap.closedByTarget.api)} settled) closes this gap by itself.`}
                </strong>
              )}
            </p>
          )}
          <p className="text-xs text-ink-muted">{gateMonth.annuityRuleLabel}</p>
        </div>
      )}
    </div>
  );
}
