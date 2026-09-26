/**
 * AwardLensView — the Policy Ledger's "Counts toward" award lens (L1,
 * docs/briefs/ledger-lens-build.md § L1; mockups D4 / D1 / D3 in
 * docs/design-system/proposals/ledger-2026-09/).
 *
 * Presentational only. `lens` is a `deriveAwardLens` result and `summary` its
 * `awardLensSummary`; every figure, group and reason arrives already decided
 * by the engines. The container (AwardLensPanel) owns fetching and state.
 *
 * Blocks:
 *   AwardSelector     — "Counts toward" radio chips (★ campaigns first, this
 *                       month, this quarter, annual, MDRT) + "Past period…"
 *   AwardSummaryCard  — eyebrow / chip / title; ring (target awards) or the two
 *                       settled/submitted boxes (ranked); target-tier picker
 *                       (campaign); the rule lines. A strip across the top at lg.
 *   AwardLensGroups   — Counting · Submitted, not settled · Not counting here,
 *                       each card keeping its tap-through to the drill drawer.
 */
import React, { useId } from 'react';
import { AlertCircle, Download } from 'lucide-react';
import ProgressDonut, { RingLegend } from '../../dashboard/ProgressDonut';
import TargetTierPicker from '../../campaigns/TargetTierPicker';
import PolicyCard from './PolicyCard';
import { formatWhole } from '../../../lib/awardLensView';

// ── Selector ────────────────────────────────────────────────────────────────

function chipClass(on) {
  return `min-h-[44px] rounded-full px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
    on
      ? 'border border-primary bg-primary font-bold text-white dark:border-primary-dark dark:bg-primary-dark'
      : 'border border-border bg-card font-semibold text-ink hover:border-primary/40'
  }`;
}

export function AwardSelector({ current, past, selectedKey, onSelect, campaignsLoading, campaignsError, onRetryCampaigns }) {
  const labelId = useId();
  const pastSelected = past.find((a) => a.key === selectedKey) ?? null;
  return (
    <div className="flex flex-col gap-1.5" data-testid="award-lens-selector">
      <span id={labelId} className="text-[13px] font-bold text-ink">Counts toward</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
          {current.map((a) => {
            const on = a.key === selectedKey;
            return (
              <button
                key={a.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onSelect(a.key)}
                className={chipClass(on)}
                data-testid={`award-lens-option-${a.key}`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        {campaignsLoading && (
          <span className="h-9 w-28 animate-pulse rounded-full bg-border/60" data-testid="award-lens-campaigns-loading">
            <span className="sr-only">Loading campaigns…</span>
          </span>
        )}
        {past.length > 0 && (
          <select
            aria-label="Past period"
            value={pastSelected ? pastSelected.key : ''}
            onChange={(e) => { if (e.target.value) onSelect(e.target.value); }}
            className={`${chipClass(Boolean(pastSelected))} appearance-none pr-3`}
            data-testid="award-lens-past"
          >
            <option value="">Past period…</option>
            {past.map((a) => (
              <option key={a.key} value={a.key}>{a.label}</option>
            ))}
          </select>
        )}
      </div>
      {campaignsError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-danger-ink" data-testid="award-lens-campaigns-error">
          <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">Couldn’t load your campaigns — the other awards still show.</span>
          <button
            type="button"
            onClick={onRetryCampaigns}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-xs font-semibold text-ink hover:bg-surface"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

// ── Summary card ────────────────────────────────────────────────────────────

function RingFigures({ summary, lens }) {
  const pendingApi = lens.pending.api;
  return (
    <div className="flex items-center gap-4" data-testid="award-lens-ring">
      <ProgressDonut
        value={lens.settled.api}
        max={lens.target.api}
        pending={pendingApi}
        centerLabel={`${summary.pct}%`}
        ariaLabel={summary.ringAria}
        className="h-[112px] w-[112px]"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xl font-bold text-ink tabular-nums">TTD {summary.settledLabel}</span>
        <span className="text-[13px] text-ink-muted">of {summary.targetLabel} · {summary.appsLabel}</span>
        {pendingApi > 0 && (
          <span className="text-[13px] font-semibold text-ink tabular-nums">+ TTD {summary.pendingLabel} submitted</span>
        )}
      </div>
    </div>
  );
}

function RankedBoxes({ summary }) {
  return (
    <div className="grid grid-cols-2 gap-3" data-testid="award-lens-boxes">
      <div className="flex min-w-0 flex-col gap-0.5 rounded-[14px] bg-primary-tint p-3">
        <span className="text-xs font-semibold text-primary">Settled — counts</span>
        <span className="font-display text-2xl font-bold text-ink tabular-nums">{summary.settledLabel}</span>
        <span className="text-xs text-ink">{summary.appsLabel}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 rounded-[14px] border border-dashed border-primary/40 bg-surface p-3">
        <span className="text-xs font-semibold text-ink-muted">Submitted — waiting</span>
        <span className="font-display text-2xl font-bold text-ink tabular-nums">{summary.pendingLabel}</span>
        <span className="text-xs text-ink-muted">{summary.pendingAppsLabel}</span>
      </div>
    </div>
  );
}

export function AwardSummaryCard({ lens, summary, tierPicker, onExportProof }) {
  const campaignTiers = lens.award.kind === 'campaign' ? lens.award.campaign?.tiers : null;
  return (
    <section
      aria-label="Award summary"
      className="flex flex-col gap-3 rounded-[20px] border border-border bg-card p-4 lg:flex-row lg:items-start lg:gap-6"
      data-testid="award-lens-card"
    >
      <div className="flex min-w-0 flex-col gap-3 lg:w-[360px] lg:shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-gold-ink">
            {summary.eyebrow}
          </span>
          {summary.chip && (
            <span className="shrink-0 whitespace-nowrap rounded-full bg-gold-tint px-2 py-[3px] font-mono text-[11px] font-semibold uppercase text-gold-ink" data-testid="award-lens-chip">
              {summary.chip}
            </span>
          )}
        </div>
        <h3 className="font-display text-[22px] font-bold leading-tight text-ink" data-testid="award-lens-title">{summary.title}</h3>
        {tierPicker && Array.isArray(campaignTiers) && campaignTiers.length > 0 && (
          <TargetTierPicker
            tiers={campaignTiers}
            value={tierPicker.value}
            onChange={tierPicker.onChange}
            testId="ledger-target-tier"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2 lg:flex-1">
        {summary.hasRing
          ? <RingFigures summary={summary} lens={lens} />
          : <RankedBoxes summary={summary} />}
        {summary.hasRing && <RingLegend show={lens.pending.api > 0} className="justify-start" />}
      </div>

      <div className="flex min-w-0 flex-col gap-2 lg:w-[260px] lg:shrink-0">
        <div className="flex flex-col gap-1 rounded-xl bg-surface px-3 py-2.5" data-testid="award-lens-rule">
          <span className="text-[13px] font-bold text-ink" data-testid="award-lens-line1">{summary.line1}</span>
          <span className="text-xs leading-snug text-ink-muted" data-testid="award-lens-line2">{summary.line2}</span>
        </div>
        {onExportProof && (
          <button
            type="button"
            onClick={onExportProof}
            className="inline-flex min-h-[44px] items-center gap-2 self-start rounded-lg border border-border bg-card px-3 text-xs font-semibold text-ink hover:bg-surface"
            data-testid="award-lens-export-proof"
          >
            <Download size={14} aria-hidden="true" /> Export campaign proof
          </button>
        )}
      </div>
    </section>
  );
}

// ── Grouped list ────────────────────────────────────────────────────────────

const GROUP_COPY = {
  counting: { heading: 'Counting', empty: 'Nothing counts toward this yet.' },
  pending: { heading: 'Submitted, not settled', empty: 'Nothing waiting to settle here.' },
  not: { heading: 'Not counting here', empty: 'Every policy here counts.' },
};

function groupAside(group, rows) {
  if (group === 'counting') {
    const api = rows.reduce((s, r) => s + r.credit.api, 0);
    return rows.length ? `TTD ${formatWhole(api)}` : null;
  }
  if (group === 'pending') {
    const api = rows.reduce((s, r) => s + r.credit.api, 0);
    return rows.length ? `TTD ${formatWhole(api)} waiting` : null;
  }
  return rows.length ? 'why is shown on each' : null;
}

export function AwardLensGroups({ lens, visibleIds, onOpen }) {
  return (
    <div className="flex flex-col gap-[18px]" data-testid="award-lens-groups">
      {['counting', 'pending', 'not'].map((group) => {
        const all = lens.groups[group];
        const rows = all.filter((r) => !visibleIds || visibleIds.has(r.policy.id));
        const hiddenByFilter = all.length - rows.length;
        const copy = GROUP_COPY[group];
        const aside = groupAside(group, rows);
        return (
          <section key={group} className="flex flex-col gap-2" aria-label={copy.heading} data-testid={`award-lens-group-${group}`}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-bold text-ink">
                {copy.heading} <span className="font-semibold text-ink-muted">· {rows.length}</span>
              </h3>
              {aside && <span className="shrink-0 text-xs text-ink-muted tabular-nums">{aside}</span>}
            </div>
            {rows.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-ink-muted" data-testid={`award-lens-empty-${group}`}>
                {hiddenByFilter > 0 ? 'No policies here match this filter.' : copy.empty}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                {rows.map((r) => (
                  <PolicyCard key={r.policy.id} policy={r.policy} onOpen={onOpen} lensRow={r} awardKind={lens.award.kind} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
