import React from 'react';
import { ChevronRight } from 'lucide-react';
import { CARD, EYEBROW, FOCUS, TileGrid, WarnIcon } from '../money/moneyParts';
import { monthLabel, wholeTTDUp } from '../../../lib/fr/moneyModel';
import { formatPersistencyPct } from '../../../lib/persistency/persistencyRounding';

/**
 * FR headers above the existing Numbers screens and the Policy Ledger (FR-4,
 * FR-D5 wrap-don't-rewrite: the screens below render unchanged). PURE views.
 */

/** Numbers hub header: weeks reported + selling-ladder ratios (workModel.numbersTiles). */
export function FrNumbersHeaderView({ tiles }) {
  return (
    <div className="mb-5 flex flex-col gap-3" data-testid="fr-numbers-header">
      <TileGrid tiles={tiles} label="Your numbers this year" />
      <p className="text-[12px] text-ink-muted">From your submitted weekly reports this year. The full report is below.</p>
    </div>
  );
}

/**
 * Policy Ledger header: the ledger's own year figures (deriveYearProduction,
 * the hero's numbers) and the win-back lens — how many counted lapses, the
 * gap to the gate, and a way into Focus · Win-back. Read-only.
 *
 * @param {{ tiles: object[], plan: object|null, loading?: boolean, onOpenWinback?: () => void }} props
 */
export function FrLedgerHeaderView({ tiles, plan, loading = false, onOpenWinback }) {
  return (
    <div className="mb-5 flex flex-col gap-4" data-testid="fr-ledger-header">
      <TileGrid tiles={tiles} loading={loading} label="Your ledger this year" />
      <section className={`${CARD} flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between`} aria-label="Win-back lens" data-testid="ledger-winback-lens">
        <div className="min-w-0">
          <p className={EYEBROW}>Win-back{plan ? ` · ${monthLabel(plan.monthKey)}` : ''}</p>
          {plan ? (
            plan.meets ? (
              <p className="text-[14px] font-semibold text-ink">
                {formatPersistencyPct(plan.currentPct)} persistency — at or above the {plan.threshold}% gate
                {plan.lapses.length ? ` · ${plan.lapses.length} lapsed ${plan.lapses.length === 1 ? 'policy still counts' : 'policies still count'}` : ''}
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-[14px] font-semibold text-fr-warm">
                <WarnIcon className="mt-0.5" />
                {formatPersistencyPct(plan.currentPct)} — TTD {wholeTTDUp(plan.need)} reinstated clears {plan.threshold}% · {plan.lapses.length} lapsed {plan.lapses.length === 1 ? 'policy' : 'policies'} can help
              </p>
            )
          ) : (
            <p className="text-[14px] text-ink-muted">No persistency figure yet.</p>
          )}
        </div>
        {plan && plan.lapses.length ? (
          <button
            type="button"
            onClick={onOpenWinback}
            className={`${FOCUS} inline-flex min-h-[44px] flex-none items-center gap-1 self-start rounded-lg px-1 text-[13px] font-bold text-primary sm:self-center`}
            data-testid="ledger-open-winback"
          >
            Plan the win-back
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        ) : null}
      </section>
    </div>
  );
}
