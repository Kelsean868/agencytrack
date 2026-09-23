import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { derivePolicyLens } from '../../lib/policyCampaignLens';
import { isTieredCampaign, normalizeGate, persistencyPctForGate, gateBandFor } from '../../utils/campaignEngine';
import { aggregatePersistency } from '../../lib/persistency/calculations';
import { isTwentyFourMonthModel } from '../../lib/persistency/model';
import { formatCurrency } from '../../utils/formatters';
import PanelSkeleton from '../ui/PanelSkeleton';

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

function monthYearLabel(monthKey) {
  return new Date(`${monthKey}-01T12:00:00Z`).toLocaleDateString('en-TT', { month: 'long', year: 'numeric' });
}

// The latest 24-month-model record, reduced to its own persistency % — never
// the pulse-strip's `aggregatePersistency(persistency.filter(year))`. That
// figure blends legacy-12-month records (pre Sep 2026) with 24-month ones
// into a single year-to-date number (see src/lib/persistency/model.js), which
// is not "the 24-month persistency" the brief asks for. This reduces exactly
// one record — the newest one that actually IS on the 24-month model — through
// the same `aggregatePersistency` math everyone else uses, just scoped to one.
function latestTwentyFourMonthReading(records) {
  const eligible = (Array.isArray(records) ? records : [])
    .filter((r) => r && MONTH_KEY_RE.test(r?.monthKey) && isTwentyFourMonthModel(r.monthKey));
  if (!eligible.length) return null;
  const latest = eligible.reduce((a, b) => (b.monthKey > a.monthKey ? b : a));
  const { aggregatedPersistency, sumGrossSettled } = aggregatePersistency([latest]);
  if (!(sumGrossSettled > 0)) return null;
  return { pct: Math.round(aggregatedPersistency * 100), monthKey: latest.monthKey };
}

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

export default function CampaignHeroCard({
  campaign, policies = [], persistencyRecords = [], loading = false, error = false,
}) {
  const tiered = Boolean(campaign) && isTieredCampaign(campaign) && campaign.structure === 'qualify';

  const lens = useMemo(
    () => (tiered ? derivePolicyLens(policies, campaign, {}) : null),
    [tiered, policies, campaign],
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
  const previewReading = useMemo(
    () => (tiered && gateEnabled ? latestTwentyFourMonthReading(persistencyRecords) : null),
    [tiered, gateEnabled, persistencyRecords],
  );
  const persistencyKnown = gateEnabled && persPct != null;
  const persistencyPreview = !persistencyKnown && previewReading ? previewReading : null;
  const persistencyDisplayPct = persistencyKnown ? persPct : persistencyPreview ? persistencyPreview.pct : null;
  const persistencyAchieved = persistencyKnown
    ? gateAchieved
    : persistencyPreview
      ? persistencyPreview.pct >= (gate?.threshold ?? 0)
      : false;
  const persistencyWarning = Boolean(persistencyPreview) && !persistencyAchieved;

  const gateJudgedLabel = useMemo(() => {
    if (!gate) return '';
    if (gate.basis === 'finalMonth' && MONTH_KEY_RE.test(String(campaign?.endDate).slice(0, 7))) {
      return `Gate judged on ${monthYearLabel(String(campaign.endDate).slice(0, 7))} · ${gate.threshold}% needed`;
    }
    return `Gate judged across the campaign period · ${gate.threshold}% needed`;
  }, [gate, campaign]);

  if (loading) {
    return (
      <div className="card p-6">
        <PanelSkeleton variant="metric-row" count={3} label="Loading campaign progress…" />
      </div>
    );
  }

  if (error) {
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

        <div className="flex flex-col gap-1" data-testid="campaign-hero-row-persistency">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">24-Month Persistency</span>
            <span className="text-xs text-ink tabular-nums">
              {persistencyDisplayPct == null ? '—' : `${persistencyDisplayPct}%`}
              {persistencyPreview && ` as at ${monthYearLabel(persistencyPreview.monthKey)}`}
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
