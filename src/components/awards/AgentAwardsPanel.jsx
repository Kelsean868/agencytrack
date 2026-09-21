import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
import { computeAgentAwards, computeRatioTrends, computeAtRiskStatus, computeAwardPace, getPeriodCtx, nextTierDistance, isPersistencyOnlyBlock } from '../../utils/awardsEngine';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { getOwnPolicies, settlementShapeFromPolicies } from '../../services/policiesService';
import { excludeImported } from '../../lib/portfolioImport/excludeImported';
import { HeroAwardCard, GroupHeader, AwardCard, AwardDrillDrawer } from './awardPrimitives';
import { LedgerSourceChip } from './awardProvenance';
import { deriveAwardProvenance } from '../../lib/awardProvenance';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import PanelSkeleton from '../ui/PanelSkeleton';

const CATEGORY_TABS = ['All', 'Monthly', 'Quarterly', 'Annual', 'Club'];

// ── RatioMiniSpark — SVG polyline sparkline ──────────────────────────────────
function RatioMiniSpark({ values, color, width = 120, height = 24 }) {
  if (!values?.length || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = (height - 4) - ((v - min) / range) * (height - 4) + 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = pts.split(' ').pop().split(',');
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
    </svg>
  );
}

function RatioTrendCard({ label, value4w, value12w, trend, format, sparkValues, color }) {
  const fmt = (v) => {
    if (format === 'currency') return formatCurrency(v);
    if (format === 'percent') return `${v}%`;
    return String(v);
  };
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendCls  = trend === 'up' ? 'text-success-ink' : trend === 'down' ? 'text-danger-ink' : 'text-ink-muted';

  return (
    <div className="card p-4 flex flex-col gap-2">
      <p className="text-[10px] font-bold tracking-widest text-ink-muted font-mono uppercase">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-2xl font-bold text-ink leading-none" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}>
          {fmt(value4w)}
        </p>
        <TrendIcon size={14} className={trendCls} />
      </div>
      {sparkValues && <RatioMiniSpark values={sparkValues} color={color ?? 'var(--color-primary)'} />}
      <p className="text-[10px] text-ink-muted font-mono tracking-wide">12w avg · {fmt(value12w)}</p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AgentAwardsPanel({ submissions, confirmedSettlements, agentProfile, currentDate, ruleset, activeCampaigns = [] }) {
  const [activeCategory, setActiveCategory]  = useState('All');
  const [drawerAwardId, setDrawerAwardId]    = useState(null);
  const { tenantId } = useAuth();
  const [ledgerPolicies, setLedgerPolicies] = useState(null);
  const [ledgerError, setLedgerError] = useState(false);
  const usesPolicyLedger = Boolean(agentProfile?.usesPolicyLedger);
  // Item 3.4 — awards provenance (flag OFF ⇒ chip + drawer panel absent).
  const awardsProvenanceOn = useFeatureFlag('awardsProvenance');

  // Retry-able: the only network fetch this panel owns (submissions/
  // confirmedSettlements arrive as props from the parent). §1 states
  // contract — a failed ledger read no longer silently degrades to an
  // empty array with no trace; the error card's Retry re-invokes this.
  const loadLedgerPolicies = useCallback(() => {
    if (!usesPolicyLedger || !tenantId || !agentProfile?.uid) return;
    setLedgerError(false);
    getOwnPolicies(tenantId, agentProfile.uid)
      // Awards and campaign credit are earned in AgencyTrack. An imported
      // historical book must not award anything retroactively (ruling 5e).
      .then((pols) => setLedgerPolicies(excludeImported(pols)))
      .catch((e) => {
        console.error('[AgentAwardsPanel] policy ledger load failed:', e);
        setLedgerError(true);
        setLedgerPolicies([]);
      });
  }, [usesPolicyLedger, tenantId, agentProfile?.uid]);

  useEffect(() => { loadLedgerPolicies(); }, [loadLedgerPolicies]);

  const activeConfirmedData = useMemo(() => {
    if (!usesPolicyLedger) return confirmedSettlements ?? [];
    if (ledgerPolicies === null) return [];
    const ledgerShape = settlementShapeFromPolicies(ledgerPolicies);
    const persistByPeriod = {};
    for (const s of (confirmedSettlements ?? [])) {
      if (s.periodKey && s.persistency) persistByPeriod[s.periodKey] = s.persistency;
    }
    return ledgerShape.map((row) => ({ ...row, persistency: persistByPeriod[row.periodKey] ?? 0 }));
  }, [usesPolicyLedger, ledgerPolicies, confirmedSettlements]);

  const now = useMemo(() => currentDate ?? new Date(), [currentDate]);

  const computation = useMemo(() => {
    try {
      // Rule 10 — the campaigns are ALREADY loaded by the dashboard via
      // getActiveCampaignsForAgent, so this is a prop, not a new read. A
      // flagged campaign covering this month/quarter turns the four advisor
      // prize strings into "Recognition only"; nothing else about the award
      // changes, because the award is still won.
      const rawAwards = computeAgentAwards(activeConfirmedData, submissions, agentProfile, now, ruleset, activeCampaigns);
      const awards = {};
      for (const [id, award] of Object.entries(rawAwards)) {
        const periodCtx = getPeriodCtx(award.category, now);
        const paceStatus = computeAtRiskStatus(award, periodCtx);
        const persistencyBlock = isPersistencyOnlyBlock(award);
        let tierGap = null;
        if (award.category === 'club' && !award.eligible) {
          const annualApi = award.criteria[0]?.current ?? 0;
          tierGap = nextTierDistance(annualApi, ruleset.clubAward.tiers);
        }
        // §2.7 pace narrative — same periodCtx.weeksElapsed already used for
        // paceStatus above; see computeAwardPace's own doc comment for the
        // honesty rule (period-total ÷ elapsed-weeks, null for '%' criteria).
        const pace = computeAwardPace(award, periodCtx.weeksElapsed, now);
        awards[id] = { ...award, paceStatus, persistencyBlock, tierGap, pace };
      }
      return { awards, ratioTrends: computeRatioTrends(submissions), error: null };
    } catch (e) {
      console.error(e);
      return { awards: {}, ratioTrends: null, error: 'Failed to compute awards.' };
    }
  }, [activeConfirmedData, submissions, agentProfile, now, ruleset, activeCampaigns]);

  const { awards, ratioTrends, error } = computation;

  // Derive drawer award from ID so it always reflects current computation state.
  const drawerAward = drawerAwardId ? (awards[drawerAwardId] ?? null) : null;

  // Item 3.4 — provenance model for the open drawer (null unless flag is ON).
  const drawerProvenance = useMemo(
    () => (awardsProvenanceOn && drawerAward
      ? deriveAwardProvenance(drawerAward, { usesPolicyLedger })
      : null),
    [awardsProvenanceOn, drawerAward, usesPolicyLedger],
  );

  // Filter by active category tab
  const filteredAwards = useMemo(() => {
    const all = Object.values(awards);
    if (activeCategory === 'All') return all;
    return all.filter(a => a.category === activeCategory.toLowerCase());
  }, [awards, activeCategory]);

  // Group awards by progress level
  const { heroAward, qualified, almostThere, makingProgress, justStarting } = useMemo(() => {
    const qualified    = filteredAwards.filter(a => a.eligible);
    const inContention = filteredAwards.filter(a => !a.eligible && a.inContention);
    const notYet       = filteredAwards.filter(a => !a.eligible && !a.inContention);

    const almostThere     = inContention.filter(a => a.progressPercent >= 70);
    const makingProgress  = inContention.filter(a => a.progressPercent >= 30 && a.progressPercent < 70)
      .concat(notYet.filter(a => a.progressPercent >= 30));
    const justStarting    = notYet.filter(a => a.progressPercent < 30);

    // Hero: highest % among inContention (not qualified)
    const hero = inContention.sort((a, b) => b.progressPercent - a.progressPercent)[0] ?? null;

    return { heroAward: hero, qualified, almostThere, makingProgress, justStarting };
  }, [filteredAwards]);

  if (!submissions?.length) {
    return (
      <div className="card text-center py-12 flex flex-col items-center gap-3" data-testid="agent-awards-top-empty">
        <div className="p-3 rounded-full bg-surface-muted text-ink-muted">
          <Trophy size={24} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">No awards progress yet</p>
          {/* Honest descriptive empty (§1) — the only real action here is
              submitting weekly activity elsewhere in the app; this panel has
              no navigation prop to jump there, so no CTA is fabricated. */}
          <p className="text-sm text-ink-muted mt-0.5">
            Start submitting weekly reports to see your awards progress build here.
          </p>
        </div>
      </div>
    );
  }

  // §1 loading skeleton — the policy-ledger fetch is this panel's own async
  // dependency (see loadLedgerPolicies above). Without this gate, the award
  // groups below render from an artificially empty activeConfirmedData while
  // ledgerPolicies is still null — every award reads as 0% progress instead
  // of a loading state.
  const ledgerLoading = usesPolicyLedger && ledgerPolicies === null && !ledgerError;
  if (ledgerLoading) {
    return (
      <div className="flex flex-col gap-6" data-testid="agent-awards-loading">
        <PanelSkeleton variant="card-grid" count={4} label="Loading your awards…" />
        <PanelSkeleton variant="metric-row" count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 p-8 rounded-xl bg-danger/10 border border-danger/30 text-center"
        data-testid="agent-awards-error"
      >
        <p className="text-sm text-danger-ink font-medium">{error}</p>
        {ledgerError && (
          <p className="text-xs text-ink-muted">Your policy ledger data failed to load — retry to try again.</p>
        )}
        <button
          type="button"
          onClick={loadLedgerPolicies}
          className="min-h-[44px] px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const totalTracked = Object.keys(awards).length;

  // §2 staggered-assemble — the drill drawer is a fixed-position overlay
  // rendered outside the `.stagger` container (same pattern as GamePlanV2's
  // modalsBlock split): it only opens on click, well after the one-shot
  // mount-time stagger animation has finished, so it never risks reparenting
  // its own containing block mid-animation.
  return (
    <>
    <div className="flex flex-col gap-6 stagger">

      {/* Item 3.4 — honest ledger-source chip (flag-gated) */}
      {awardsProvenanceOn && (
        <div className="flex" data-testid="agent-awards-source-chip">
          <LedgerSourceChip sourceLive={usesPolicyLedger} source={usesPolicyLedger ? 'POLICY LEDGER' : 'CONFIRMED SETTLEMENTS'} />
        </div>
      )}

      {/* Partial-failure notice — policy ledger read failed but the panel
          still rendered from whatever data resolved. */}
      {ledgerError && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-warning/30 bg-warning/10 text-warning-ink text-sm flex items-center justify-between gap-3 flex-wrap"
          data-testid="agent-awards-ledger-partial"
        >
          <span>Your policy ledger data failed to load — awards may be incomplete.</span>
          <button
            type="button"
            onClick={loadLedgerPolicies}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Hero card */}
      {heroAward && <HeroAwardCard award={heroAward} />}

      {/* Category tabs + total count */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl bg-surface-muted border border-border overflow-x-auto">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`px-3.5 min-h-[36px] rounded-lg text-xs font-bold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                activeCategory === tab
                  ? 'bg-card text-ink shadow-sm border border-border'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted font-mono tracking-wide">{totalTracked} awards tracked</p>
      </div>

      {/* Award groups */}
      {qualified.length > 0 && (
        <div>
          <GroupHeader label="✓ Qualified" count={qualified.length} accentStyle={{ color: 'var(--color-gold-ink)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {qualified.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAwardId(a.id)} />)}
          </div>
        </div>
      )}

      {almostThere.length > 0 && (
        <div>
          <GroupHeader label="★ Almost there · 70%+" count={almostThere.length} accentStyle={{ color: 'var(--color-primary)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {almostThere.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAwardId(a.id)} />)}
          </div>
        </div>
      )}

      {makingProgress.length > 0 && (
        <div>
          <GroupHeader label="↗ Making progress · 30–70%" count={makingProgress.length} accentStyle={{ color: 'var(--color-primary)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {makingProgress.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAwardId(a.id)} />)}
          </div>
        </div>
      )}

      {justStarting.length > 0 && (
        <div>
          <GroupHeader label="◯ Just starting · under 30%" count={justStarting.length} accentStyle={{ color: 'var(--color-text-muted)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {justStarting.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAwardId(a.id)} />)}
          </div>
        </div>
      )}

      {filteredAwards.length === 0 && (
        <div className="card text-center py-10 flex flex-col items-center gap-3" data-testid="agent-awards-empty-category">
          <div className="p-3 rounded-full bg-surface-muted text-ink-muted">
            <Trophy size={24} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">No awards in this category</p>
            <p className="text-sm text-ink-muted mt-0.5">
              {activeCategory === 'All'
                ? 'Awards appear here as your activity qualifies for them.'
                : `Nothing tracked under ${activeCategory} yet — try another category.`}
            </p>
          </div>
          {activeCategory !== 'All' && (
            <button
              type="button"
              onClick={() => setActiveCategory('All')}
              className="min-h-[44px] mt-1 inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
            >
              View all categories
            </button>
          )}
        </div>
      )}

      {/* Ratio trends */}
      {ratioTrends && (
        <div>
          <p className="text-xs font-bold tracking-widest text-ink-muted font-mono uppercase mb-3">Activity ratio trends · last 12 weeks</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <RatioTrendCard
              label="CI to Sale"
              value4w={ratioTrends.ciToSaleRatio.trailing4w}
              value12w={ratioTrends.ciToSaleRatio.trailing12w}
              trend={ratioTrends.ciToSaleRatio.trend}
              sparkValues={ratioTrends.ciToSaleRatio.weeklyValues}
              color="var(--color-primary)"
            />
            <RatioTrendCard
              label="Dials to CI"
              value4w={ratioTrends.dialsToCIRatio.trailing4w}
              value12w={ratioTrends.dialsToCIRatio.trailing12w}
              trend={ratioTrends.dialsToCIRatio.trend}
              sparkValues={ratioTrends.dialsToCIRatio.weeklyValues}
              color="var(--color-gold)"
            />
            <RatioTrendCard
              label="Avg Policy Size"
              value4w={ratioTrends.avgPolicySize.trailing4w}
              value12w={ratioTrends.avgPolicySize.trailing12w}
              trend={ratioTrends.avgPolicySize.trend}
              format="currency"
              sparkValues={ratioTrends.avgPolicySize.weeklyValues}
              color="var(--color-primary-dark)"
            />
            <RatioTrendCard
              label="FFI to Dial"
              value4w={ratioTrends.ffiToDialRatio.trailing4w}
              value12w={ratioTrends.ffiToDialRatio.trailing12w}
              trend={ratioTrends.ffiToDialRatio.trend}
              sparkValues={ratioTrends.ffiToDialRatio.weeklyValues}
              color="var(--color-danger)"
            />
          </div>
        </div>
      )}
    </div>

      {/* Drill drawer — outside `.stagger` (fixed-position overlay; see note above) */}
      {drawerAward && <AwardDrillDrawer award={drawerAward} onClose={() => setDrawerAwardId(null)} provenance={drawerProvenance} />}
    </>
  );
}
