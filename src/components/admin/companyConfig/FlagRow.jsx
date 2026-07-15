import React from 'react';
import { AlertTriangle, Check } from 'lucide-react';

/**
 * Feature-flag row (design handoff README §Feature Flags). Flags commit
 * immediately (no draft state) and the "enable" affordance is deliberately
 * loud — a confirm strip, not a bare toggle — because flipping a flag
 * changes the product for every user at once.
 *
 * Contract note: the README's confirm copy is "Turn on {flag} for all
 * {userCount} users at {company}, effective immediately?" — `userCount` and
 * `company` were not in this component's prop list in the brief, so they are
 * added here as additional REQUIRED-for-copy-but-optional props (falsy-safe
 * defaults render the sentence with blanks rather than throwing). Flagged in
 * the build report.
 *
 * @param {object} props
 * @param {{id: string, key: string, name: string, desc?: string}} props.flag
 * @param {boolean} props.on current committed value (fail-closed: false when absent)
 * @param {{whoName: string, date: string}} [props.provenance] shown under the name when `on`
 * @param {boolean} props.confirming whether the inline "enable for everyone" confirm strip is open
 * @param {Function} props.onRequestEnable opens the confirm strip
 * @param {Function} props.onCancelConfirm closes the confirm strip without enabling
 * @param {Function} props.onConfirmEnable commits the enable
 * @param {Function} props.onDisable commits a disable (from the ON state's quiet "Disable" ghost)
 * @param {number} [props.userCount] users affected, for the confirm-strip copy
 * @param {string} [props.company] tenant/company name, for the confirm-strip copy
 */
export default function FlagRow({
  flag,
  on,
  provenance,
  confirming,
  onRequestEnable,
  onCancelConfirm,
  onConfirmEnable,
  onDisable,
  userCount,
  company,
}) {
  return (
    <div
      data-testid={`ccfg-flag-${flag.key}`}
      className="py-3.5 px-2 -mx-2 rounded-lg border-t border-border first:border-t-0"
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-1.5">
        <div className="flex-1 basis-[220px] min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13.5px] font-semibold text-ink">{flag.name}</span>
            <span className="font-mono text-[10.5px] text-ink-muted px-1.5 py-0.5 bg-surface-muted border border-border rounded">
              {flag.key}
            </span>
          </div>
          {flag.desc && <p className="text-[11.5px] text-ink-muted mt-1 leading-snug max-w-[540px]">{flag.desc}</p>}
          {on && provenance && (
            <p className="text-[11px] text-ink-muted mt-1">
              Enabled by <span className="font-semibold text-ink">{provenance.whoName}</span> · {provenance.date}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
          {on ? (
            <>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary-tint text-primary text-[11px] font-bold">
                <Check size={11} aria-hidden="true" /> ON
              </span>
              <button
                type="button"
                onClick={onDisable}
                data-testid={`ccfg-flag-disable-${flag.key}`}
                className="px-2.5 py-1.5 rounded-[9px] border-[1.5px] border-border text-ink text-[12px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                Disable
              </button>
            </>
          ) : (
            <>
              <span className="font-mono text-[10.5px] text-ink-muted px-2 py-1 bg-surface-muted border border-border rounded-md">
                NOT SET → OFF
              </span>
              <button
                type="button"
                onClick={onRequestEnable}
                data-testid={`ccfg-flag-enable-${flag.key}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] border-[1.5px] border-danger text-danger-ink text-[12px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <AlertTriangle size={13} aria-hidden="true" /> Enable for everyone
              </button>
            </>
          )}
        </div>
      </div>

      {confirming && !on && (
        <div
          data-testid={`ccfg-flag-confirm-${flag.key}`}
          className="flex items-center gap-3 mt-2.5 px-3.5 py-2.5 bg-danger-tint border border-danger/25 rounded-[10px] flex-wrap"
        >
          <span className="text-[12px] text-ink flex-1 min-w-[200px]">
            Turn on <span className="font-bold">{flag.name}</span> for all {userCount ?? '—'} users at {company ?? 'this tenant'}, effective immediately?
          </span>
          <button
            type="button"
            onClick={onCancelConfirm}
            data-testid={`ccfg-flag-cancel-${flag.key}`}
            className="text-[12px] font-bold text-ink-muted focus-visible:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmEnable}
            data-testid={`ccfg-flag-confirm-enable-${flag.key}`}
            className="min-h-[40px] px-3.5 rounded-lg bg-danger text-white text-[12px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
          >
            Enable now
          </button>
        </div>
      )}
    </div>
  );
}
