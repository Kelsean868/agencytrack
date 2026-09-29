import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { derivePolicyLens } from '../../lib/policyCampaignLens';
import {
  isTieredCampaign, normalizeGate, persistencyPctForGate, gateBandFor, getDaysRemaining,
} from '../../utils/campaignEngine';
import { toDateStr } from '../../lib/policyCampaignLens';
import { buildPersistencyOutlook, formatOutlookPct, outlookGateFor } from '../../lib/persistency/persistencyOutlook';
import { getTodayTT } from '../../utils/dateInputs';
import { provenanceLine } from '../../lib/settledProvenance';
import { outlookMonthLabel, outlookMonthShortLabel } from '../persistency/outlookLabels';
import { formatCurrency } from '../../utils/formatters';
import { campaignPace } from '../../lib/campaignPace';
import { campaignPersistencyReading } from '../../lib/campaignPersistencyReading';
import PanelSkeleton from '../ui/PanelSkeleton';
import CampaignHeroCompact from './CampaignHeroCompact';
import TargetTierPicker from './TargetTierPicker';
import CampaignPolicyList from './CampaignPolicyList';
import { buildCampaignPolicyGroups } from '../../lib/campaignPolicyGroups';
import {
  ProgressBlock, WhatItTakesBlock, PersistencyGateBarBlock, TierLadderBlock, WhatIfBlock, ScreenFooter,
} from './CampaignScreenBlocks';

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

function monthYearLabel(monthKey) {
  return new Date(`${monthKey}-01T12:00:00Z`).toLocaleDateString('en-TT', { month: 'long', year: 'numeric' });
}

// The preview comes from the persistency outlook (R5): the newest of a
// confirmed record and the month derived from the HO export, labelled with
// which it is. The outlook is the ONE derivation the Persistency tab and the
// Home pulse chip also read — this card does not derive a second figure.
//
// Why not the pulse-strip's year aggregate: it blends legacy-12-month records
// with 24-month ones (see src/lib/persistency/model.js).

// ── Hero-ledger H3 ──────────────────────────────────────────────────────────
//
// One campaign hero, reused on the agent Awards tab and on HomeV2, replacing
// HomeV2's old per-campaign CampaignCard. Both surfaces feed it from
// `derivePolicyLens` — the SAME call CampaignLensPanel makes (C-D10) — so the
// three rows below can never disagree with the ledger panel about the level
// in reach. API and Applications targets come straight off `lens.api.target`
// / `lens.apps.target`, which `derivePolicyLens` already resolves against
// `tierNext` (the level in reach, not the ladder's ceiling — C2 item 6).
//
// The old CampaignCard's lower progress bars totalled WEEKLY SUBMISSIONS
// (`computeCampaignProgress`), which is why they read "TTD 0 / 275,000" for
// an advisor whose campaign business was imported and never passed through a
// weekly report. This card has no submissions-based path at all.

function HeroRow({ label, current, target, unit, achieved, testId }) {
  const isTTD = unit === 'TTD';
  const isPct = unit === '%';
  // TTD keeps formatCurrency's own cents — the smoke expects an exact figure
  // (TTD 73,946.28), not a round-tripped whole number.
  const fmt = (v) => (isTTD ? formatCurrency(v) : isPct ? `${Math.round(v)}%` : String(Math.round(v)));
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : (achieved ? 100 : 0);
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
        <span className="text-xs text-ink tabular-nums">{fmt(current)} / {fmt(target)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-border/60 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${achieved ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * `variant="compact"` (Home redesign R1) renders the three-donut card with a
 * pace line and a Details link (`onOpenDetails`). The derivation below is
 * shared by both variants, so Home and the Awards tab read one set of figures.
 */
export default function CampaignHeroCard({
  campaign, policies = [], persistencyRecords = [], loading = false, error = false,
  variant = 'full', onOpenDetails, targetTierName = null, onTargetTierChange = null,
  onOpenPolicy = null,
}) {
  const tiered = Boolean(campaign) && isTieredCampaign(campaign) && campaign.structure === 'qualify';

  // L1 — the agent's "My target tier" (shared with the Policy Ledger's campaign
  // card via useLedgerTargetTier). Only the Campaign screen passes it; Home and
  // the full card measure against the level in reach, exactly as before.
  const lens = useMemo(
    () => (tiered ? derivePolicyLens(policies, campaign, { targetTierName }) : null),
    [tiered, policies, campaign, targetTierName],
  );

  const gate = useMemo(() => (campaign ? normalizeGate(campaign) : null), [campaign]);
  const gateEnabled = campaign?.persistencyGateEnabled !== false;
  const persPct = useMemo(
    () => (tiered && gateEnabled ? persistencyPctForGate(persistencyRecords, campaign) : null),
    [tiered, gateEnabled, persistencyRecords, campaign],
  );
  const band = tiered && gateEnabled ? gateBandFor(persPct, gate) : null;
  const gateAchieved = Boolean(band && band.payout > 0);

  // The actual gate reading wins whenever it exists. Only when it is still
  // unknown (the finalMonth hasn't arrived, or the period has no data yet) do
  // we fall back to a preview of the latest 24-month-model month on file —
  // labelled as a preview, never presented as the reading itself.
  const previewReading = useMemo(() => {
    if (!tiered || !gateEnabled) return null;
    const { headline } = buildPersistencyOutlook({
      policies, records: persistencyRecords, today: getTodayTT(),
    });
    return headline && Number.isFinite(headline.persistency) ? headline : null;
  }, [tiered, gateEnabled, policies, persistencyRecords]);
  const persistencyKnown = gateEnabled && persPct != null;
  const persistencyPreview = !persistencyKnown && previewReading ? previewReading : null;
  // The bar width works on the 0–100 scale; the preview keeps its decimals so
  // 89.6% is never rounded up to a passing 90%.
  const persistencyDisplayPct = persistencyKnown
    ? persPct
    : persistencyPreview ? persistencyPreview.persistency * 100 : null;
  const persistencyAchieved = persistencyKnown
    ? gateAchieved
    : persistencyPreview
      ? persistencyPreview.persistency * 100 >= (gate?.threshold ?? 0)
      : false;
  const persistencyWarning = Boolean(persistencyPreview) && !persistencyAchieved;

  const gateJudgedLabel = useMemo(() => {
    if (!gate) return '';
    if (gate.basis === 'finalMonth' && MONTH_KEY_RE.test(String(campaign?.endDate).slice(0, 7))) {
      return `Gate judged on ${monthYearLabel(String(campaign.endDate).slice(0, 7))} · ${gate.threshold}% needed`;
    }
    return `Gate judged across the campaign period · ${gate.threshold}% needed`;
  }, [gate, campaign]);

  // Screen variant (R2) only — the full persistency outlook (confirmed /
  // derived / estimateToday / gateMonth), gated on the campaign's own gate so
  // block 3 can show the projected month against the threshold, and the pace
  // maths block 2 needs (R1's campaignPace, reused, never recomputed).
  const fullOutlook = useMemo(() => {
    if (!tiered) return null;
    return buildPersistencyOutlook({
      policies,
      records: persistencyRecords,
      today: getTodayTT(),
      gate: outlookGateFor(campaign),
      productionTarget: Array.isArray(campaign?.tiers)
        ? { tiers: campaign.tiers.map((t) => ({ name: t.name, api: t.api })), current: lens?.api?.current ?? 0 }
        : null,
    });
  }, [tiered, campaign, policies, persistencyRecords, lens]);

  const screenDaysLeft = tiered ? getDaysRemaining(toDateStr(campaign?.endDate)) : null;
  const screenPace = useMemo(() => {
    if (!tiered || !lens) return null;
    return campaignPace({
      apiCurrent: lens.api.current, apiTarget: lens.api.target,
      appsCurrent: lens.apps.current, appsTarget: lens.apps.target,
      daysLeft: screenDaysLeft,
    });
  }, [tiered, lens, screenDaysLeft]);

  const compact = variant === 'compact';
  const screen = variant === 'screen';

  // R2-4 — "Policies in this campaign" (screen variant only). Grouped off the
  // SAME lens as every figure on this screen, so the Counting / Waiting totals
  // are the campaign's own API / applications figures by construction.
  const policyGroups = useMemo(
    () => (screen && lens ? buildCampaignPolicyGroups(lens, policies) : null),
    [screen, lens, policies],
  );

  if (loading) {
    if (compact) {
      return (
        <div className="rounded-2xl border border-border bg-card p-[18px]" data-testid="campaign-compact-loading">
          <PanelSkeleton variant="metric-row" count={3} label="Loading campaign progress…" />
        </div>
      );
    }
    return (
      <div className="card p-6">
        <PanelSkeleton variant="metric-row" count={3} label="Loading campaign progress…" />
      </div>
    );
  }

  if (error) {
    if (compact) {
      return (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-[18px] text-sm text-warning-ink"
          data-testid="campaign-hero-card-error"
        >
          <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
          Couldn&apos;t load your campaign progress — try again shortly.
        </div>
      );
    }
    return (
      <div
        role="alert"
        className="card p-6 flex items-center gap-3 text-sm text-warning-ink"
        data-testid="campaign-hero-card-error"
      >
        <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
        Couldn&apos;t load your campaign progress — try again shortly.
      </div>
    );
  }

  if (!campaign || !tiered || !lens) return null;

  const apiTarget = lens.api.target ?? lens.api.current;
  const appsTarget = lens.apps.target ?? lens.apps.current;
  const apiAchieved = lens.api.target == null ? true : lens.api.current >= lens.api.target;
  const appsAchieved = lens.apps.target == null ? true : lens.apps.current >= lens.apps.target;
  const tierLabel = lens.tierNext?.name ?? lens.tierReached?.name ?? lens.name;

  if (compact) {
    const endKey = toDateStr(campaign.endDate);
    // One derivation shared with the Policy Ledger's campaign card (LX).
    const persistency = campaignPersistencyReading({
      campaign, policies, records: persistencyRecords, today: getTodayTT(),
    }) ?? { value: null, label: '—', below: false, gateMonthKey: null };
    return (
      <CampaignHeroCompact
        lens={lens}
        daysLeft={endKey ? getDaysRemaining(endKey) : null}
        gate={gate}
        gateEnabled={gateEnabled}
        persistency={persistency}
        onOpenDetails={onOpenDetails}
      />
    );
  }

  if (screen) {
    const endKey = toDateStr(campaign.endDate);
    const threshold = gate?.threshold ?? 0;
    const gateMonth = fullOutlook?.gateMonth ?? null;
    const projectedPct = gateMonth ? gateMonth.persistency * 100 : (persistencyPreview?.persistency != null ? persistencyPreview.persistency * 100 : null);
    const persistencyDisplayPctScreen = persistencyKnown ? persPct : projectedPct;
    const persistencyLabelScreen = persistencyKnown
      ? `${persPct}%`
      : projectedPct != null ? formatOutlookPct(projectedPct / 100) : '—';
    const gateMonthKey = gate?.basis === 'finalMonth' && endKey ? endKey.slice(0, 7) : (gateMonth?.monthKey ?? null);
    const gateMonthShort = gateMonthKey && MONTH_KEY_RE.test(gateMonthKey) ? outlookMonthShortLabel(gateMonthKey) : null;
    const atOrAboveGate = persistencyDisplayPctScreen != null && persistencyDisplayPctScreen >= threshold;

    return (
      <div className="flex flex-col gap-5" data-testid="campaign-screen">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-gold-ink">Campaign</span>
            {screenDaysLeft != null && (
              <span className="rounded-full bg-gold-tint px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-gold-ink">
                {screenDaysLeft < 0 ? 'Ended' : screenDaysLeft === 0 ? 'Ends today' : `${screenDaysLeft} day${screenDaysLeft === 1 ? '' : 's'} left`}
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl font-bold leading-snug text-ink">{lens.name}</h1>
          <p className="text-sm text-ink-muted">
            {lens.targetTierChosen && lens.targetTier
              ? <>Aiming for <strong className="font-semibold text-ink">{lens.targetTier.name}</strong> ({formatCurrency(lens.targetTier.cash ?? 0)})</>
              : lens.tierNext ? <>Aiming for <strong className="font-semibold text-ink">{lens.tierNext.name}</strong> ({formatCurrency(lens.tierNext.cash ?? 0)})</> : `Top tier reached: ${lens.tierReached?.name ?? tierLabel}`}
          </p>
          {provenanceLine(lens.provenance) && (
            <p className="text-xs text-ink-muted" data-testid="campaign-screen-provenance">
              Counted so far: {provenanceLine(lens.provenance)}
            </p>
          )}
          {onTargetTierChange && (
            <div className="mt-2 max-w-[520px]">
              <TargetTierPicker
                tiers={campaign.tiers}
                value={lens.targetTier?.name ?? null}
                onChange={onTargetTierChange}
                testId="campaign-screen-target-tier"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-8">
            <ProgressBlock
              lens={lens}
              threshold={gateEnabled ? threshold : null}
              persistencyDisplayPct={gateEnabled ? persistencyDisplayPctScreen : null}
              persistencyLabel={persistencyLabelScreen}
              persistencyBelow={gateEnabled && !atOrAboveGate && persistencyDisplayPctScreen != null}
              gateMonthShort={gateMonthShort}
            />
            <WhatItTakesBlock
              pace={screenPace}
              weeksLeft={screenPace?.weeksLeft}
              reinstateNeeded={gateMonth?.gap?.reinstateNeeded ?? 0}
              gateThreshold={threshold}
              atOrAboveGate={!gateEnabled || atOrAboveGate}
            />
            {gateEnabled && (
              <PersistencyGateBarBlock
                projectedPct={projectedPct}
                threshold={threshold}
                judgedLabel={gate?.basis === 'finalMonth' && gateMonthShort ? `Judged on ${monthYearLabel(gateMonthKey).split(' ')[0]}` : null}
                outlook={fullOutlook}
              />
            )}
          </div>
          <div className="flex flex-col gap-5 lg:col-span-4">
            <TierLadderBlock
              tiers={campaign.tiers}
              tierNextName={lens.tierNext?.name ?? null}
              apiCurrent={lens.api.current}
              appsCurrent={lens.apps.current}
              appsPerTier={campaign.tiers?.[0]?.apps ?? null}
            />
            <WhatIfBlock
              apiCurrent={lens.api.current}
              tiers={campaign.tiers}
              today={getTodayTT()}
              endDate={toDateStr(campaign.endDate)}
              initialRate={screenPace?.apiPerWeek ?? 20000}
            />
          </div>
        </div>

        <CampaignPolicyList groups={policyGroups} exportDate={lens.exportDate} onOpenPolicy={onOpenPolicy} />

        <ScreenFooter />
      </div>
    );
  }

  return (
    <div
      className="card p-6 relative overflow-hidden flex flex-col gap-4"
      data-testid="campaign-hero-card"
      style={{ border: '1px solid var(--color-gold)', boxShadow: 'var(--shadow-md)' }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: -60, right: -100, width: 320, height: 320,
          background: 'radial-gradient(circle, var(--color-gold-tint) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative">
        <p className="text-xs font-bold tracking-widest text-gold-ink font-mono uppercase mb-1">
          ★ {lens.name}
        </p>
        <p
          className="text-xl font-bold text-ink leading-none"
          style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.02em' }}
        >
          {lens.tierNext ? `Toward ${tierLabel}` : `On for ${tierLabel}`}
        </p>
      </div>

      <div className="flex flex-col gap-3 relative">
        <HeroRow label="API" current={lens.api.current} target={apiTarget} unit="TTD" achieved={apiAchieved} testId="campaign-hero-row-api" />
        <HeroRow label="Applications" current={lens.apps.current} target={appsTarget} unit="apps" achieved={appsAchieved} testId="campaign-hero-row-apps" />
        {provenanceLine(lens.provenance) && (
          <p className="text-xs text-ink-muted" data-testid="campaign-hero-provenance">
            {provenanceLine(lens.provenance)}
          </p>
        )}

        <div className="flex flex-col gap-1" data-testid="campaign-hero-row-persistency">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">24-Month Persistency</span>
            <span className="text-xs text-ink tabular-nums">
              {persistencyKnown
                ? `${persPct}%`
                : persistencyPreview
                  ? `${formatOutlookPct(persistencyPreview.persistency)} ${persistencyPreview.kind}, ${outlookMonthLabel(persistencyPreview.monthKey)}`
                  : '—'}
              {' / '}{gate?.threshold ?? 0}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-border/60 overflow-hidden">
            {persistencyDisplayPct != null && (
              <div
                data-testid="campaign-hero-persistency-bar-fill"
                className={`h-2 rounded-full transition-all duration-500 ${
                  persistencyWarning ? 'bg-warning' : persistencyAchieved ? 'bg-success' : 'bg-primary'
                }`}
                style={{
                  width: `${gate?.threshold > 0 ? Math.min(100, Math.round((persistencyDisplayPct / gate.threshold) * 100)) : 0}%`,
                }}
              />
            )}
          </div>
        </div>
        {persistencyKnown ? null : persistencyPreview ? (
          <p
            className={`text-[11px] ${persistencyWarning ? 'text-warning-ink font-semibold' : 'text-ink-muted'}`}
            data-testid="campaign-hero-persistency-preview-note"
          >
            {gateJudgedLabel}
          </p>
        ) : gateEnabled ? (
          <p className="text-[11px] text-ink-muted" data-testid="campaign-hero-persistency-unknown">
            Persistency not yet known for this campaign period.
          </p>
        ) : (
          <p className="text-[11px] text-ink-muted" data-testid="campaign-hero-persistency-ungated">
            This campaign does not gate on persistency.
          </p>
        )}
      </div>

      {lens.exportDate && (
        <p className="text-[11px] text-ink-muted relative" data-testid="campaign-hero-as-at">
          As at {lens.exportDate}, from the portfolio import.
        </p>
      )}
    </div>
  );
}
