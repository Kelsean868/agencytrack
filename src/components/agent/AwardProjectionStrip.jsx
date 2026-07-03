import React, { useMemo } from 'react';
import { projectAwards, derivedApps, ASSUMED_PERSIST_DEFAULT } from '../../lib/yearPlanProjection';
import { formatCurrency, formatCompactTTD } from '../../utils/formatters';

const STATE_META = {
  'on-track':      { dot: 'bg-primary dark:bg-primary-dark',          text: 'text-primary',          badge: 'bg-primary/10 dark:bg-primary-dark/15 border-primary/20 dark:border-primary-dark/30',          icon: '✓' },
  'in-contention': { dot: 'bg-amber-500',                              text: 'text-amber-700 dark:text-amber-400',           badge: 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700',                      icon: '↗' },
  'not-yet':       { dot: 'bg-ink-muted/40',                           text: 'text-ink-muted',                               badge: 'bg-surface-raised border-border',                                                              icon: '—' },
};

function AwardPill({ id, label, state, persistNote, gapToNext = 0, nextLabel, topTier = false }) {
  const meta = STATE_META[state] ?? STATE_META['not-yet'];
  // Gap-to-next: how much more Life API reaches the next milestone. Top tier is
  // capped ("top tier reached") — never an invented higher award. The full
  // target name lives in the title so the pill stays compact.
  const ariaSuffix = topTier
    ? ' — top tier reached'
    : gapToNext > 0
      ? ` — ${formatCompactTTD(gapToNext)} to ${nextLabel ?? label}`
      : '';
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${meta.badge}`}
      data-testid={`award-pill-${id}`}
      aria-label={`${label}: ${state}${ariaSuffix}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} aria-hidden="true" />
      <span className={meta.text}>{label}</span>
      <span className={`font-bold ${meta.text}`} aria-hidden="true">{meta.icon}</span>
      {persistNote && (
        <span className="text-[10px] opacity-60" title={`Assumes ≥${ASSUMED_PERSIST_DEFAULT}% persistency`}>†</span>
      )}
      {topTier ? (
        <span className="text-[10px] font-semibold text-primary" data-testid={`award-gap-${id}`}>
          top tier reached
        </span>
      ) : gapToNext > 0 ? (
        <span
          className="text-[10px] font-medium text-ink-muted"
          data-testid={`award-gap-${id}`}
          title={`${formatCompactTTD(gapToNext)} more Life API to reach ${nextLabel ?? label}`}
        >
          +{formatCompactTTD(gapToNext)}
        </span>
      ) : null}
    </div>
  );
}

export default function AwardProjectionStrip({ lines, agentProfile, ruleset, avgPolicyAPI = null }) {
  const lifeTargetAPI = parseFloat(lines?.life?.targetAPI) || 0;
  const apps = derivedApps(lifeTargetAPI, avgPolicyAPI);

  const { monthsInIndustry, monthsAtTatil, isBdoDso } = agentProfile ?? {};

  const awards = useMemo(
    () => projectAwards(lifeTargetAPI, { monthsInIndustry, monthsAtTatil, isBdoDso }, ruleset, avgPolicyAPI),
    [lifeTargetAPI, monthsInIndustry, monthsAtTatil, isBdoDso, ruleset, avgPolicyAPI],
  );

  if (lifeTargetAPI <= 0) return null;

  return (
    <div
      className="rounded-xl border border-border bg-surface px-4 py-3 space-y-2.5"
      data-testid="award-projection-strip"
      aria-label="Award projection"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Award Projection</p>
        <p className="text-[10px] text-ink-muted tabular-nums">
          Life: {formatCurrency(lifeTargetAPI)} · {apps} apps est.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Projected awards">
        {awards.map((award) => (
          <div key={award.id} role="listitem">
            <AwardPill {...award} />
          </div>
        ))}
      </div>

      <p className="text-[10px] text-ink-muted leading-relaxed">
        † Assumes ≥{ASSUMED_PERSIST_DEFAULT}% persistency. Projection based on Life-line target only.
        A&H / Property / Motor lines do not count toward annual awards.
      </p>
    </div>
  );
}
