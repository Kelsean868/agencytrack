/**
 * Track J — Manager Awards v2 panel.
 *
 * Visual port of the manager-awards surface to the #391 (AgentAwardsPanel v2)
 * grammar:
 *   • Tier-1 hero: a v2 card-shell + AwardDonut treatment for the Monthly
 *     Production Bonus (closest-tier progress) — replaces the legacy
 *     `role-hero` strip.
 *   • Tier-2 category tabs + grouped AwardCard grid (Qualified / Almost there /
 *     Making progress / Just starting) — replaces the AwardMedalCard grid.
 *   • Tier-3 AwardDrillDrawer on card click — adds criteria detail that the
 *     legacy panel didn't surface for managers.
 *
 * `awardsEngine` computation + `getSettlementsForUnit` + `getAllYTDSubmissions`
 * + `getAwardsRuleset` data path are PRESERVED unchanged.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { computeManagerAwards } from '../../utils/awardsEngine';
import { getSettlementsForUnit } from '../../services/settlementService';
import { getMergedAwardsRuleset } from '../../services/awardsRulesetService';
import { getAllYTDSubmissions } from '../../services/managerService';
import { DEFAULT_RULESET_2026 } from '../../config/awardsRuleset/2026';
import { formatCurrency } from '../../utils/formatters';
import BmAtRiskPanel from './BmAtRiskPanel';
import {
  AwardDonut,
  GroupHeader,
  AwardCard,
  AwardDrillDrawer,
} from './awardPrimitives';
import { groupByProgress } from './awardGrouping';

const CATEGORY_TABS = [
  { id: 'annual',   label: 'Annual'     },
  { id: 'activity', label: 'Activity'   },
  { id: 'recruit',  label: 'Recruiting' },
];

const ACTIVITY_IDS = ['activity_bronze', 'activity_silver', 'activity_gold', 'highest_activity'];
const RECRUIT_IDS  = ['recruiting_bronze', 'recruiting_silver', 'recruiting_gold'];

// ─────────────────────────────────────────────────────────────────────────────
// MonthlyBonusHero — v2 card-shell hero for the monthly production bonus
// ─────────────────────────────────────────────────────────────────────────────
function MonthlyBonusHero({ bonus }) {
  const hasNextTier = bonus.nextTier != null;
  const fillPercent = hasNextTier
    ? Math.min(100, Math.round((bonus.avgMonthlyAPI / bonus.nextTier.threshold) * 100))
    : 100;
  const state = hasNextTier ? 'contention' : 'qualified';
  const eyebrow = hasNextTier ? '★ Next tier in reach' : '✓ Top tier achieved';

  // Certified stroke colors for AwardDonut on glass.hero.teal.
  // contention → hero-ink (white, trivially 3:1+).
  // qualified  → hero-accent (#F4ECC8), certified at 4.7:1 via heroPair tests.
  const donutStroke = hasNextTier ? 'var(--hero-ink)' : 'var(--hero-accent)';

  // @@hero-pane-start
  return (
    <div
      className="glass hero teal p-6 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
      data-testid="monthly-bonus-hero"
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <AwardDonut state={state} percent={fillPercent} size={140} strokeWidth={12} strokeOverride={donutStroke} />
      </div>

      <div className="flex-1 min-w-0 relative">
        <p className="text-xs font-bold tracking-widest font-mono uppercase mb-1 text-[--hero-ink-muted-teal]">
          {eyebrow}
        </p>
        <p
          className="text-3xl font-bold text-[--hero-ink] leading-none"
          style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.022em', marginBottom: 6 }}
        >
          Monthly Production Bonus
        </p>
        <p className="text-sm text-[--hero-ink-muted-teal]">
          {formatCurrency(bonus.bonusAmount)}
          {' · '}
          {bonus.bonusPct > 0 ? `Tier ${bonus.bonusPct}% unlocked` : 'No tier unlocked yet'}
        </p>

        <div className="inline-flex items-baseline gap-2 mt-3.5 px-3 py-2 rounded-xl bg-[--hero-chip-island] border border-[--hero-chip-border] flex-wrap">
          {hasNextTier ? (
            <>
              <span className="text-xs text-[--hero-ink-muted-teal] font-mono tracking-wide">Avg / advisor</span>
              <span
                className="text-lg font-bold text-[--hero-ink]"
                style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}
              >
                {formatCurrency(bonus.avgMonthlyAPI)}
              </span>
              <span className="text-sm text-[--hero-ink-muted-teal]">
                {' · Tier '}{bonus.nextTier.pct}{'% at '}{formatCurrency(bonus.nextTier.threshold)}
              </span>
            </>
          ) : (
            <span className="text-sm text-[--hero-ink-muted-teal]">Top tier achieved · no further threshold</span>
          )}
        </div>

        {bonus.note && (
          <p className="text-[11px] text-[--hero-ink-muted-teal] mt-2 leading-relaxed">{bonus.note}</p>
        )}
      </div>
    </div>
  );
  // @@hero-pane-end
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryTabs — v2 pill cluster matching #391's chip control
// ─────────────────────────────────────────────────────────────────────────────
function CategoryTabs({ tabs, activeId, onChange, totalCount }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div
        role="tablist"
        aria-label="Award category"
        className="flex gap-1 p-1 rounded-xl bg-surface-muted border border-border overflow-x-auto"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeId === tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-3.5 min-h-[44px] rounded-lg text-xs font-bold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              activeId === tab.id
                ? 'bg-card text-ink shadow-sm border border-border'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {totalCount > 0 && (
        <p className="text-xs text-ink-muted font-mono tracking-wide">
          {totalCount} award{totalCount === 1 ? '' : 's'} tracked
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export default function ManagerAwardsPanel({
  agentIds,
  agentProfiles = [],
  currentDate,
  role,
  tenantId,
  newAdvisors = 0,
}) {
  const [settlements, setSettlements] = useState([]);
  const [ytdSubs, setYtdSubs]         = useState([]);
  const [ruleset, setRuleset]         = useState(DEFAULT_RULESET_2026);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [activeTab, setActiveTab]     = useState('annual');
  const [drawerAward, setDrawerAward] = useState(null);

  const now = useMemo(() => {
    if (!currentDate) return new Date();
    return currentDate instanceof Date ? currentDate : new Date(currentDate);
  }, [currentDate]);
  const year = now.getFullYear();

  useEffect(() => {
    if (!agentIds?.length) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      getSettlementsForUnit(tenantId, agentIds, year),
      getMergedAwardsRuleset(tenantId, year).catch(() => DEFAULT_RULESET_2026),
      getAllYTDSubmissions(tenantId).catch(() => []),
    ])
      .then(([setts, loadedRuleset, subs]) => {
        setSettlements(setts);
        setRuleset(loadedRuleset);
        setYtdSubs(subs);
      })
      .catch((e) => { console.error(e); setError('Failed to load settlement data.'); })
      .finally(() => setLoading(false));
  }, [tenantId, agentIds, year]);

  const awards = useMemo(
    () => computeManagerAwards(settlements, agentIds, {}, { newAdvisors }, now, role, ruleset),
    [settlements, agentIds, newAdvisors, now, role, ruleset]
  );

  const { bonus, annualAwards, activityAwards, recruitAwards } = useMemo(() => {
    const all = Object.values(awards);
    return {
      bonus:          awards.agency_monthly_bonus,
      annualAwards:   all.filter((a) => a.category === 'annual' && !ACTIVITY_IDS.includes(a.id) && !RECRUIT_IDS.includes(a.id)),
      activityAwards: all.filter((a) => ACTIVITY_IDS.includes(a.id)),
      recruitAwards:  all.filter((a) => RECRUIT_IDS.includes(a.id)),
    };
  }, [awards]);

  const activeAwards = useMemo(() => {
    if (activeTab === 'annual')   return annualAwards;
    if (activeTab === 'activity') return activityAwards;
    if (activeTab === 'recruit')  return recruitAwards;
    return [];
  }, [activeTab, annualAwards, activityAwards, recruitAwards]);

  const groups = useMemo(() => groupByProgress(activeAwards), [activeAwards]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3" data-testid="manager-awards-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-surface-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger-ink">{error}</div>;
  }

  if (!agentIds?.length) {
    return (
      <div className="card text-center py-10">
        <p className="text-sm text-ink-muted">No agents in your unit yet.</p>
      </div>
    );
  }

  // isBmPlus intentionally EXCLUDES sales_manager. SM has no single branch
  // — whether/how these manager-awards panels scope for an all-branches SM
  // is an open product decision (cf. P5b for the leaderboard). Tracked as
  // an FU in docs/FOLLOW_UPS.md; this carve-out is presentational only.
  const isBmPlus = role === 'branch_manager' || role === 'tenant_admin' || role === 'platform_admin';

  return (
    <div className="flex flex-col gap-6" data-testid="manager-awards-panel">
      {bonus && <MonthlyBonusHero bonus={bonus} />}

      <CategoryTabs
        tabs={CATEGORY_TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        totalCount={activeAwards.length}
      />

      {groups.qualified.length > 0 && (
        <div data-testid="award-group-qualified">
          <GroupHeader
            label="✓ Qualified"
            count={groups.qualified.length}
            accentStyle={{ color: 'var(--color-gold)' }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {groups.qualified.map((a) => (
              <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />
            ))}
          </div>
        </div>
      )}

      {groups.almostThere.length > 0 && (
        <div data-testid="award-group-almost">
          <GroupHeader
            label="★ Almost there · 70%+"
            count={groups.almostThere.length}
            accentStyle={{ color: 'var(--color-primary)' }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {groups.almostThere.map((a) => (
              <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />
            ))}
          </div>
        </div>
      )}

      {groups.makingProgress.length > 0 && (
        <div data-testid="award-group-progress">
          <GroupHeader
            label="↗ Making progress · 30–70%"
            count={groups.makingProgress.length}
            accentStyle={{ color: 'var(--color-primary)' }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {groups.makingProgress.map((a) => (
              <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />
            ))}
          </div>
        </div>
      )}

      {groups.justStarting.length > 0 && (
        <div data-testid="award-group-starting">
          <GroupHeader
            label="◯ Just starting · under 30%"
            count={groups.justStarting.length}
            accentStyle={{ color: 'var(--color-text-muted)' }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {groups.justStarting.map((a) => (
              <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />
            ))}
          </div>
        </div>
      )}

      {activeAwards.length === 0 && (
        <div className="card text-center py-10" data-testid="award-empty">
          <p className="text-sm text-ink-muted">No awards in this category.</p>
        </div>
      )}

      {isBmPlus && (
        <BmAtRiskPanel
          agentProfiles={agentProfiles}
          settlements={settlements}
          ytdSubs={ytdSubs}
          agentIds={agentIds}
          currentDate={now}
          ruleset={ruleset}
        />
      )}

      {drawerAward && <AwardDrillDrawer award={drawerAward} onClose={() => setDrawerAward(null)} />}
    </div>
  );
}
