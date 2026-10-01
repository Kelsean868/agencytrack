import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { getOwnPolicies } from '../../services/policiesService';
import { deriveYearProduction, provenanceLine } from '../../lib/ledgerProduction';
import { awardInputs, agentAwardsView } from '../../lib/awards/agentAwardModel';
import { ttDateParts } from '../../utils/dateInputs';
import { HeroAwardCard, GroupHeader, AwardCard, AwardDrillDrawer } from './awardPrimitives';
import CampaignScreenWithTier from '../campaigns/CampaignScreenWithTier';
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
export default function AgentAwardsPanel({ submissions, confirmedSettlements, agentProfile, currentDate, ruleset, activeCampaigns = [], persistency = [], onOpenPolicy = null }) {
  const [activeCategory, setActiveCategory]  = useState('All');
  const [drawerAwardId, setDrawerAwardId]    = useState(null);
  const { tenantId } = useAuth();
  const [ledgerPolicies, setLedgerPolicies] = useState(null);
  const [ledgerError, setLedgerError] = useState(false);
  const usesPolicyLedger = Boolean(agentProfile?.usesPolicyLedger);
  const canReadLedger = Boolean(tenantId && agentProfile?.uid);
  // Item 3.4 — awards provenance (flag OFF ⇒ chip + drawer panel absent).
  const awardsProvenanceOn = useFeatureFlag('awardsProvenance');

  // Retry-able: the only network fetch this panel owns (submissions/
  // confirmedSettlements arrive as props from the parent). §1 states
  // contract — a failed ledger read no longer silently degrades to an
  // empty array with no trace; the error card's Retry re-invokes this.
  //
  // Fetched for EVERY agent, not only flagged ones: whether the ledger is the
  // source depends on whether the agent HAS ledger policies (H2 item 2).
  const loadLedgerPolicies = useCallback(() => {
    if (!canReadLedger) return;
    setLedgerError(false);
    getOwnPolicies(tenantId, agentProfile.uid)
      /* AWARDS ARE EARNED BY DATE, NOT BY ORIGIN (amends ruling 5e; C-D10).

         This call site previously passed `excludeImported(pols)` under
         dispatcher ruling 5e, so an imported historical book could not award
         anything retroactively. The intent was right; the mechanism was wrong,
         exactly as C-D10 found for the campaign lens. On 23 Sep 2026 the
         operator's ledger held 229 policy docs, ALL imported, 5 of them settled
         and issued in 2026 — and the origin filter hid every one, so Advisor of
         the Month, the quarterly awards and the Club all read zero against real
         2026 business (three policies issued 4–7 Aug 2026 among them).

         The raw array is kept, and `awardRowsFromLedger` applies the test the
         rule actually states (Kyron, 23 Sep 2026, R5): a policy belongs to the
         month its `dateIssued` falls in. An imported policy issued 15 Aug 2026
         counts toward August, Q3 and 2026; one issued in 2019 lands in a 2019
         row that no current award reads — because of its DATE. Origin was only
         ever a proxy for age.

         `excludeImported` is NOT weakened and NOT removed: it stays in force,
         unchanged, for every other reader the excludeImported call-site guard
         lists (financing among them). */
      .then((pols) => setLedgerPolicies(Array.isArray(pols) ? pols : []))
      .catch((e) => {
        console.error('[AgentAwardsPanel] policy ledger load failed:', e);
        setLedgerError(true);
        setLedgerPolicies([]);
      });
  }, [canReadLedger, tenantId, agentProfile?.uid]);

  useEffect(() => { loadLedgerPolicies(); }, [loadLedgerPolicies]);

  // H2 item 2 — which source the awards read, and the rows the engine reads.
  // The derivation lives in lib/awards/agentAwardModel (shared with the FR
  // Trophy room, FR-5b); this panel only feeds it its own ledger fetch.
  const { readsLedger, rows: activeConfirmedData } = useMemo(
    () => awardInputs({ ledgerPolicies, confirmedSettlements, usesPolicyLedger }),
    [ledgerPolicies, confirmedSettlements, usesPolicyLedger],
  );

  const now = useMemo(() => currentDate ?? new Date(), [currentDate]);

  // P2d (BUG-01 option B / BUG-04): the year's settled figure, from the SAME
  // derivation as the Home hero, with where each status came from. Shown only
  // when the awards read the ledger — the settlements path has no provenance.
  const yearSettled = useMemo(() => {
    if (!readsLedger || !Array.isArray(ledgerPolicies)) return null;
    const year = ttDateParts(now)?.year ?? now.getFullYear();
    return { year, ...deriveYearProduction(ledgerPolicies, { year }).settled };
  }, [readsLedger, ledgerPolicies, now]);

  // Every award with its pace, persistency block, club gap and pace narrative
  // (lib/awards/agentAwardModel — the same view the FR Trophy room reads).
  const computation = useMemo(
    () => agentAwardsView({ rows: activeConfirmedData, submissions, agentProfile, now, ruleset, activeCampaigns }),
    [activeConfirmedData, submissions, agentProfile, now, ruleset, activeCampaigns],
  );

  const { awards, ratioTrends, error } = computation;

  // Derive drawer award from ID so it always reflects current computation state.
  const drawerAward = drawerAwardId ? (awards[drawerAwardId] ?? null) : null;

  // Item 3.4 — provenance model for the open drawer (null unless flag is ON).
  const drawerProvenance = useMemo(
    () => (awardsProvenanceOn && drawerAward
      ? deriveAwardProvenance(drawerAward, { usesPolicyLedger: readsLedger })
      : null),
    [awardsProvenanceOn, drawerAward, readsLedger],
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
  // Every agent now waits for the ledger read: until it resolves, the panel
  // cannot know which source to name (H2 item 3).
  const ledgerLoading = canReadLedger && ledgerPolicies === null && !ledgerError;
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
    {/* fr-fit-any-width W-4: card grids follow the PANEL's width (beside the
        sidebar), not the window — 4 across from 56rem, 2 from 28rem. */}
    <div className="@container/awards flex flex-col gap-6 stagger">

      {/* Item 3.4 — honest ledger-source chip (flag-gated) */}
      {awardsProvenanceOn && (
        <div className="flex" data-testid="agent-awards-source-chip">
          {/* Names the source actually read (H2 item 3), not the flag. */}
          <LedgerSourceChip sourceLive={readsLedger} source={readsLedger ? 'POLICY LEDGER' : 'CONFIRMED SETTLEMENTS'} />
        </div>
      )}

      {yearSettled && yearSettled.count > 0 && (
        <p className="text-sm text-ink-muted" data-testid="agent-awards-year-settled">
          <span className="font-semibold text-ink">Settled {yearSettled.year}: {formatCurrency(Math.round(yearSettled.api))}</span>
          {' · '}{provenanceLine(yearSettled)}
        </p>
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

      {/* Campaign hero — H3: top hero on the Awards tab when a campaign is
          active, fed from the same ledger the panel already loaded for
          `awardRowsFromLedger` above (no new fetch). */}
      {activeCampaigns.length > 0 && (
        <div className="flex flex-col gap-3">
          {activeCampaigns.map((c) => (
            <CampaignScreenWithTier
              key={c.id}
              campaign={c}
              policies={ledgerPolicies ?? []}
              persistencyRecords={persistency}
              loading={ledgerPolicies === null}
              error={ledgerError}
              onOpenPolicy={onOpenPolicy}
            />
          ))}
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
          <div className="grid grid-cols-1 @[28rem]/awards:grid-cols-2 @[56rem]/awards:grid-cols-4 gap-3">
            {qualified.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAwardId(a.id)} />)}
          </div>
        </div>
      )}

      {almostThere.length > 0 && (
        <div>
          <GroupHeader label="★ Almost there · 70%+" count={almostThere.length} accentStyle={{ color: 'var(--color-primary)' }} />
          <div className="grid grid-cols-1 @[28rem]/awards:grid-cols-2 @[56rem]/awards:grid-cols-4 gap-3">
            {almostThere.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAwardId(a.id)} />)}
          </div>
        </div>
      )}

      {makingProgress.length > 0 && (
        <div>
          <GroupHeader label="↗ Making progress · 30–70%" count={makingProgress.length} accentStyle={{ color: 'var(--color-primary)' }} />
          <div className="grid grid-cols-1 @[28rem]/awards:grid-cols-2 @[56rem]/awards:grid-cols-4 gap-3">
            {makingProgress.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAwardId(a.id)} />)}
          </div>
        </div>
      )}

      {justStarting.length > 0 && (
        <div>
          <GroupHeader label="◯ Just starting · under 30%" count={justStarting.length} accentStyle={{ color: 'var(--color-text-muted)' }} />
          <div className="grid grid-cols-1 @[28rem]/awards:grid-cols-2 @[56rem]/awards:grid-cols-4 gap-3">
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
          <div className="grid grid-cols-2 @[56rem]/awards:grid-cols-4 gap-3">
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
