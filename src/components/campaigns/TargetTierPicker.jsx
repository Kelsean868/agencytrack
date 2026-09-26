import React, { useId, useMemo } from 'react';
import { tierDetailLine } from '../../lib/awardLensView';

// Literal class strings — Tailwind's extractor cannot see a class built at
// runtime, so the column count is looked up, never interpolated.
const GRID_COLS = {
  1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3',
  4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6',
};

/**
 * TargetTierPicker — "My target tier" (mockup D1 / D3). A radio group of the
 * campaign's tiers, lowest first. The chosen tier drives the ring and the pace
 * line on the ledger's campaign card and on the Campaign screen hero; both read
 * and write the same pref through `useLedgerTargetTier`, so they stay in sync.
 *
 * `value` is the tier NAME currently measured against (the agent's choice, or
 * the default the lens resolved). Selected ink is fixed per theme: white on the
 * gold-ink fill in light, the page background on the (lighter) dark gold fill —
 * never white on light gold (CLAUDE.md v3 rule 6: fix the ink, not the fill).
 */
export default function TargetTierPicker({ tiers, value, onChange, compact = false, testId = 'target-tier-picker' }) {
  const labelId = useId();
  const ordered = useMemo(
    () => (Array.isArray(tiers) ? [...tiers].filter((t) => t?.name) : [])
      .sort((a, b) => (Number(a.api) || 0) - (Number(b.api) || 0) || (Number(a.apps) || 0) - (Number(b.apps) || 0)),
    [tiers],
  );
  if (ordered.length === 0) return null;

  const selected = ordered.find((t) => t.name === value) ?? null;
  if (value && !selected && import.meta.env.DEV) {
    console.warn(`[TargetTierPicker] tier "${value}" is not on this campaign — showing no selection`);
  }
  const cols = GRID_COLS[Math.min(ordered.length, 6)];

  return (
    <div className="flex flex-col gap-1.5" data-testid={testId}>
      <span id={labelId} className="text-[13px] font-semibold text-ink-muted">My target tier</span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className={`grid ${cols} gap-1 rounded-xl bg-gold-tint p-1`}
      >
        {ordered.map((t) => {
          const on = t.name === value;
          return (
            <button
              key={t.name}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => { if (!on) onChange?.(t.name); }}
              title={tierDetailLine(t)}
              className={`min-h-[44px] min-w-0 truncate rounded-[9px] px-0.5 text-[11px] sm:text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                on
                  ? 'bg-gold-ink font-bold text-white dark:text-surface'
                  : 'bg-transparent font-semibold text-gold-ink hover:bg-card/60'
              }`}
              data-testid={`${testId}-${t.name}`}
            >
              {t.name}
            </button>
          );
        })}
      </div>
      {!compact && selected && (
        <span className="text-[13px] text-ink-muted" data-testid={`${testId}-detail`}>{tierDetailLine(selected)}</span>
      )}
    </div>
  );
}
