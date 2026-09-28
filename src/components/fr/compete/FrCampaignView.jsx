import React from 'react';
import { ChevronRight } from 'lucide-react';
import { CARD, EYEBROW, FOCUS } from '../money/moneyParts';

/**
 * FrCampaignView — FR "Campaign" route (FR-5). PURE. The campaign screen
 * itself is the EXISTING CampaignHeroCard `variant="screen"` (with the target
 * tier picker), passed in as `renderCampaign` — FR-D5 wrap, don't rewrite.
 *
 * @param {{ campaigns: object[], renderCampaign: (c) => React.ReactNode, onOpenAwards?: () => void }} props
 */
export default function FrCampaignView({ campaigns, renderCampaign, onOpenAwards }) {
  const list = Array.isArray(campaigns) ? campaigns : [];
  return (
    <div className="flex flex-col gap-4 lg:gap-5" data-testid="fr-campaign">
      <header>
        <p className={EYEBROW}>Compete · Campaign</p>
        <h2 className="font-display text-[28px] font-bold leading-tight text-ink lg:text-[32px]">
          {list.length === 0 ? 'No campaign running' : list.length === 1 ? (list[0].name ?? 'Campaign') : `${list.length} campaigns running`}
        </h2>
      </header>
      {list.length ? (
        <div className="flex flex-col gap-4">
          {list.map((c) => <div key={c.id} className="min-w-0">{renderCampaign(c)}</div>)}
        </div>
      ) : (
        <section className={`${CARD} flex flex-col items-start gap-2 p-5`} data-testid="fr-campaign-empty">
          <p className="text-[14px] text-ink">There is no active campaign in your company right now. When one starts, your progress toward each tier shows here.</p>
          {onOpenAwards ? (
            <button type="button" onClick={onOpenAwards} className={`${FOCUS} inline-flex min-h-[44px] items-center gap-1 rounded-lg px-1 text-[13px] font-bold text-primary`}>
              See your awards
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          ) : null}
        </section>
      )}
    </div>
  );
}
