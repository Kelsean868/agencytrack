import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { isMismatch } from '../../../lib/ledgerProduction';

/**
 * LedgerReconciliationNote — R4 of the hero-ledger brief.
 *
 * The weekly report is the agent's own claim; the ledger is the record. This
 * note puts the two side by side under the hero. It is never hidden: when they
 * agree it says so. Every surface that shows the production hero renders THIS
 * component, so the wording cannot drift between surfaces.
 *
 * Renders on the teal hero, so it uses the hero ink tokens only.
 */
export default function LedgerReconciliationNote({ production, onOpenLedgerCreate }) {
  if (!production) return null;
  const { weekly, submitted, mismatch } = production;
  const ytdOff = isMismatch(mismatch.ytd);
  const weekOff = isMismatch(mismatch.week);

  return (
    <div className="mt-4 max-w-[520px]" data-testid="ledger-reconciliation">
      <p className="text-sm text-[--hero-ink-muted-teal]">
        Weekly reports say you submitted {formatCurrency(weekly.ytdApi)} this year
        ({formatCurrency(weekly.weekApi)} this week). Your ledger shows {formatCurrency(submitted.api)}.
      </p>
      {ytdOff ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="ledger-mismatch">
          <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 bg-[--hero-chip-island] border border-[--hero-chip-border] text-xs font-semibold text-[--hero-ink]">
            <AlertTriangle size={13} className="text-[--hero-dot-warning] shrink-0" aria-hidden="true" />
            Mismatch · {formatCurrency(Math.abs(mismatch.ytd))} gap
            {weekOff ? ` · ${formatCurrency(Math.abs(mismatch.week))} this week` : ''}
          </span>
          {onOpenLedgerCreate && (
            <button
              type="button"
              onClick={onOpenLedgerCreate}
              className="min-h-[44px] inline-flex items-center text-sm font-semibold text-[--hero-ink] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded"
            >
              Add a policy to your ledger
            </button>
          )}
        </div>
      ) : (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[--hero-ink]" data-testid="ledger-match">
          <CheckCircle2 size={13} className="text-[--hero-dot-success] shrink-0" aria-hidden="true" />
          Matches your weekly reports.
        </p>
      )}
    </div>
  );
}
