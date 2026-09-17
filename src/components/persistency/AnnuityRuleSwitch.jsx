import React from 'react';

import {
  ANNUITY_MISSED_PREMIUM_RULES,
  ANNUITY_MISSED_PREMIUM_RULE_LABELS,
} from '../../lib/persistency/deriveFromLedger';

/**
 * AnnuityRuleSwitch — the per-agent `persistency.annuityMissedPremiumRule`
 * setting, as a two-position control.
 *
 * NAMING, because the near-miss here is genuinely dangerous: the values are
 * `ignore` and `lapse`, NOT `legacy` and `tatil24`. `model.js` already uses
 * `tatil24` / `legacy12` for the persistency MODEL — which formula a month is
 * reckoned on — and that is a different axis entirely. Two meanings of
 * `tatil24` on one persistency document would be read wrong by somebody.
 * (Dispatcher ruling 3, 16 Sep 2026.)
 *
 * The switch NEVER touches a non-annuity policy, and it never changes the
 * denominator — only whether a settled annuity that has stopped paying counts
 * as a lapse.
 */
export default function AnnuityRuleSwitch({ value, onChange, disabled = false }) {
  return (
    <div data-testid="annuity-rule-switch">
      <div
        role="radiogroup"
        aria-label="Annuity missed premium rule"
        className="flex flex-col gap-1.5"
      >
        {ANNUITY_MISSED_PREMIUM_RULES.map((rule) => {
          const selected = value === rule;
          return (
            <button
              key={rule}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(rule)}
              data-testid={`annuity-rule-${rule}`}
              className={[
                'flex items-center gap-2.5 min-h-[44px] px-3 py-2 rounded-xl border text-left text-sm transition-colors',
                selected
                  ? 'border-primary bg-primary/10 dark:bg-primary/20 text-ink font-semibold'
                  : 'border-border bg-card-raised text-ink-muted hover:bg-card',
                disabled ? 'opacity-60 cursor-not-allowed' : '',
              ].join(' ')}
            >
              <span
                aria-hidden="true"
                className={[
                  'h-4 w-4 rounded-full border-2 shrink-0',
                  selected ? 'border-primary bg-primary' : 'border-ink-dim',
                ].join(' ')}
              />
              <span className="min-w-0">{ANNUITY_MISSED_PREMIUM_RULE_LABELS[rule]}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted mt-1.5">
        Applies to annuities only. It never changes Gross Settled.
      </p>
    </div>
  );
}
