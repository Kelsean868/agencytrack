import React from 'react';
import { ChevronRight } from 'lucide-react';
import ProgressDonut from '../dashboard/ProgressDonut';
import { campaignPace, formatCompact, paceLine } from '../../lib/campaignPace';
import { formatCurrency } from '../../utils/formatters';

/**
 * CampaignHeroCompact — Home redesign R1 block 3 (C1-Home / C3-Home-Desktop).
 *
 * Presentation only. Every figure arrives already derived by CampaignHeroCard
 * (the same `derivePolicyLens` + persistency-outlook reads the full card uses),
 * so Home and the Awards tab cannot disagree about the level in reach.
 *
 * Gold is campaign-only decoration here: the eyebrow and the days-left chip
 * use `text-gold-ink` on `bg-gold-tint` (the AA-safe gold text token).
 */

function daysLeftLabel(daysLeft) {
  if (daysLeft == null) return null;
  if (daysLeft < 0) return 'Ended';
  if (daysLeft === 0) return 'Ends today';
  return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
}

function monthShort(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey))) return null;
  return new Date(`${monthKey}-01T12:00:00Z`).toLocaleDateString('en-TT', { month: 'short', timeZone: 'UTC' });
}

function DonutCell({ children, caption, sub, subClass = 'text-ink-muted', testId }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center" data-testid={testId}>
      {children}
      <span className="text-[13px] font-bold text-ink">{caption}</span>
      <span className={`text-xs ${subClass}`}>{sub}</span>
    </div>
  );
}

export default function CampaignHeroCompact({
  lens,
  daysLeft,
  gate,
  gateEnabled,
  persistency, // { value: number|null (0–100), label: string, below: boolean, gateMonthKey: string|null }
  onOpenDetails,
}) {
  const apiCurrent = lens.api.current;
  const apiTarget = lens.api.target;
  const appsCurrent = lens.apps.current;
  const appsTarget = lens.apps.target;
  const tierNext = lens.tierNext;

  const pace = tierNext
    ? campaignPace({ apiCurrent, apiTarget, appsCurrent, appsTarget, daysLeft })
    : null;
  const pacing = paceLine(pace);

  const apiPct = apiTarget > 0 ? Math.round((apiCurrent / apiTarget) * 100) : 100;
  const appsToGo = appsTarget != null ? Math.max(0, appsTarget - appsCurrent) : 0;
  const chip = daysLeftLabel(daysLeft);
  const cash = Number(tierNext?.cash);
  const threshold = gate?.threshold ?? null;
  const gateMonth = persistency?.gateMonthKey ? monthShort(persistency.gateMonthKey) : null;
  const gateText = threshold != null ? `Gate ${threshold}%${gateMonth ? ` · ${gateMonth}` : ''}` : null;

  return (
    <section
      aria-label={`${lens.name} progress`}
      className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-[18px] shadow-sm lg:flex-1 lg:p-5"
      data-testid="campaign-compact-card"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-gold-ink">Campaign</span>
          {chip && (
            <span className="rounded-full bg-gold-tint px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-gold-ink" data-testid="campaign-compact-days">
              {chip}
            </span>
          )}
        </div>
        <h2 className="min-w-0 text-[17px] font-bold leading-snug text-ink">{lens.name}</h2>
        <p className="text-[13px] text-ink-muted" data-testid="campaign-compact-next">
          {tierNext ? (
            <>
              Next tier: <strong className="font-semibold text-ink">{tierNext.name}</strong>
              {Number.isFinite(cash) && cash > 0 ? ` · ${formatCurrency(cash)} cash` : ''}
            </>
          ) : (
            <>Top tier reached{lens.tierReached?.name ? <>: <strong className="font-semibold text-ink">{lens.tierReached.name}</strong></> : ''}</>
          )}
        </p>
      </div>

      <div className={`grid gap-2 ${gateEnabled ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <DonutCell caption="API" sub={apiTarget != null ? `${formatCompact(apiCurrent)} / ${formatCompact(apiTarget)}` : formatCompact(apiCurrent)} testId="campaign-compact-api">
          <ProgressDonut
            value={apiCurrent}
            max={apiTarget ?? apiCurrent}
            centerLabel={`${Math.min(999, apiPct)}%`}
            ariaLabel={`API ${formatCurrency(apiCurrent)} of ${apiTarget != null ? formatCurrency(apiTarget) : 'no'} target, ${apiPct} percent`}
            className="h-[86px] w-[86px] lg:h-[92px] lg:w-[92px]"
          />
        </DonutCell>
        <DonutCell caption="Applications" sub={appsToGo > 0 ? `${appsToGo} to go` : 'Target met'} testId="campaign-compact-apps">
          <ProgressDonut
            value={appsCurrent}
            max={appsTarget ?? appsCurrent}
            centerLabel={appsTarget != null ? `${appsCurrent}/${appsTarget}` : String(appsCurrent)}
            ariaLabel={`${appsCurrent} of ${appsTarget ?? appsCurrent} applications`}
            className="h-[86px] w-[86px] lg:h-[92px] lg:w-[92px]"
          />
        </DonutCell>
        {gateEnabled && (
          <DonutCell
            caption="Persistency"
            sub={persistency?.value != null ? gateText : 'Not yet known'}
            subClass={persistency?.below ? 'font-semibold text-warning-ink' : 'text-ink-muted'}
            testId="campaign-compact-persistency"
          >
            <ProgressDonut
              value={persistency?.value ?? 0}
              max={100}
              tone={persistency?.below ? 'warning' : 'teal'}
              tick={threshold != null ? threshold / 100 : null}
              centerLabel={persistency?.value != null ? persistency.label : '—'}
              ariaLabel={persistency?.value != null
                ? `Persistency ${persistency.label}${threshold != null ? `, gate ${threshold} percent` : ''}${persistency.below ? ', below the gate' : ''}`
                : 'Persistency not yet known for this campaign period'}
              className="h-[86px] w-[86px] lg:h-[92px] lg:w-[92px]"
              testId="campaign-compact-persistency-donut"
            />
          </DonutCell>
        )}
      </div>

      {(pacing || onOpenDetails) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-border pt-2.5">
          {pacing ? (
            <span className="min-w-0 text-[13px] text-ink-muted" data-testid="campaign-compact-pace">{pacing}</span>
          ) : <span />}
          {onOpenDetails && (
            <button
              type="button"
              onClick={onOpenDetails}
              className="inline-flex min-h-[44px] items-center gap-1 rounded text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Details for ${lens.name}`}
            >
              Details
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
