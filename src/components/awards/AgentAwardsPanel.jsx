import React, { useMemo, useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { computeAgentAwards, computeRatioTrends, computeAtRiskStatus, getPeriodCtx, nextTierDistance, isPersistencyOnlyBlock } from '../../utils/awardsEngine';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { getOwnPolicies, settlementShapeFromPolicies } from '../../services/policiesService';
import { HeroAwardCard, GroupHeader, AwardCard, AwardDrillDrawer } from './awardPrimitives';

const CATEGORY_TABS = ['All', 'Monthly', 'Quarterly', 'Annual', 'Club'];

// ── RatioMiniSpark — SVG polyline sparkline ──────────────────────────────────
function RatioMiniSpark({ values, color, width = 120, height = 24 }) {
  if (!values?.length) return null;
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
export default function AgentAwardsPanel({ submissions, confirmedSettlements, agentProfile, currentDate, ruleset }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [drawerAward, setDrawerAward]        = useState(null);
  const { tenantId } = useAuth();
  const [ledgerPolicies, setLedgerPolicies] = useState(null);
  const usesPolicyLedger = Boolean(agentProfile?.usesPolicyLedger);

  useEffect(() => {
    if (!usesPolicyLedger || !tenantId || !agentProfile?.uid) return;
    getOwnPolicies(tenantId, agentProfile.uid)
      .then(setLedgerPolicies)
      .catch(() => setLedgerPolicies([]));
  }, [usesPolicyLedger, tenantId, agentProfile?.uid]);

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
      const rawAwards = computeAgentAwards(activeConfirmedData, submissions, agentProfile, now, ruleset);
      const awards = {};
      for (const [id, award] of Object.entries(rawAwards)) {
        const paceStatus = computeAtRiskStatus(award, getPeriodCtx(award.category, now));
        const persistencyBlock = isPersistencyOnlyBlock(award);
        let tierGap = null;
        if (award.category === 'club' && !award.eligible) {
          const annualApi = award.criteria[0]?.current ?? 0;
          tierGap = nextTierDistance(annualApi, ruleset.clubAward.tiers);
        }
        awards[id] = { ...award, paceStatus, persistencyBlock, tierGap };
      }
      return { awards, ratioTrends: computeRatioTrends(submissions), error: null };
    } catch (e) {
      console.error(e);
      return { awards: {}, ratioTrends: null, error: 'Failed to compute awards.' };
    }
  }, [activeConfirmedData, submissions, agentProfile, now, ruleset]);

  const { awards, ratioTrends, error } = computation;

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
      <div className="card text-center py-12">
        <p className="text-sm text-ink-muted">Start submitting weekly reports to see your awards progress.</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger-ink">{error}</div>;
  }

  const totalTracked = Object.keys(awards).length;

  return (
    <div className="flex flex-col gap-6">

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
          <GroupHeader label="✓ Qualified" count={qualified.length} accentStyle={{ color: 'var(--color-gold)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {qualified.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />)}
          </div>
        </div>
      )}

      {almostThere.length > 0 && (
        <div>
          <GroupHeader label="★ Almost there · 70%+" count={almostThere.length} accentStyle={{ color: 'var(--color-primary)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {almostThere.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />)}
          </div>
        </div>
      )}

      {makingProgress.length > 0 && (
        <div>
          <GroupHeader label="↗ Making progress · 30–70%" count={makingProgress.length} accentStyle={{ color: 'var(--color-primary)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {makingProgress.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />)}
          </div>
        </div>
      )}

      {justStarting.length > 0 && (
        <div>
          <GroupHeader label="◯ Just starting · under 30%" count={justStarting.length} accentStyle={{ color: 'var(--color-text-faint)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {justStarting.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />)}
          </div>
        </div>
      )}

      {filteredAwards.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-sm text-ink-muted">No awards in this category.</p>
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

      {/* Drill drawer */}
      {drawerAward && <AwardDrillDrawer award={drawerAward} onClose={() => setDrawerAward(null)} />}
    </div>
  );
}
