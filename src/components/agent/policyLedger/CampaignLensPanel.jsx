/**
 * CampaignLensPanel — flag-gated (`policyLedgerCampaignLens`) SHELL that views
 * the agent's policy ledger through an active campaign's eligibility rules
 * (item 3.4). Mounted inside PolicyLedgerPanel's list view; renders NOTHING and
 * fires NO fetch when the flag is OFF, so the ledger is byte-identical then.
 *
 * Design source: `docs/design-system/screens-v2/app-policy-v2.jsx`
 * (CampaignProgressStrip · ContributionBadge COUNTS/PENDING/EXCLUDED · lens
 * filter chips · "Export proof"). Contributions are DERIVED honestly from the
 * already-loaded policies + the campaign window (see policyCampaignLens.js);
 * the API target comes from the campaign's tier ladder when present and renders
 * a documented pending target otherwise. Export proof (Run-7 banked follow-up,
 * build-map Tier-2 #12 residual) downloads a client-side CSV of the lens's
 * contributions — enabled only when there is at least one contribution to
 * export; otherwise it stays honestly disabled with a tooltip.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, Target } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useFeatureFlag } from '../../../hooks/useFeatureFlag';
import { getActiveCampaignsForAgent } from '../../../services/campaignService';
import { formatCurrency } from '../../../utils/formatters';
import { accommodationLabel } from '../../../utils/campaignEngine';
import {
  derivePolicyLens, lensFilterCounts, LENS_FILTERS, buildCampaignProofExport,
} from '../../../lib/policyCampaignLens';
import { buildCsvContent, downloadCsv, slugifyForFilename } from '../../../lib/csvExport';
import PanelSkeleton from '../../ui/PanelSkeleton';

const BADGE = {
  counts: { cls: 'bg-success-tint text-success-ink', icon: '✓' },
  pending: { cls: 'bg-warning-tint text-warning-ink', icon: '◯' },
  excluded: { cls: 'bg-surface-muted text-ink-muted', icon: '✕' },
};

export function ContributionBadge({ contribution }) {
  if (!contribution) return null;
  const cfg = BADGE[contribution.state] ?? BADGE.excluded;
  // A counting policy shows BOTH halves of its credit, because under Rule 7
  // they come apart: Platinum Edge is 1 app and no API, a replacement is API
  // difference and no app. A badge showing only money would report a Platinum
  // Edge policy as worth nothing.
  const apps = contribution.apps ?? 0;
  const label = contribution.state === 'counts'
    ? `COUNTS · ${apps === 1 ? '1 app' : `${apps} apps`} · ${formatCurrency(contribution.value)}`
    : contribution.state.toUpperCase();
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-wide shrink-0 ${cfg.cls}`}
      title={contribution.reason}
      data-testid={`contribution-badge-${contribution.state}`}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {label}
    </span>
  );
}

/**
 * One progress row. Apps and API each get one, side by side and equally
 * weighted, because on this campaign APPLICATIONS are the binding constraint:
 * the operator's three counted policies average TTD 24,649 of API each where
 * Champion needs an average of 7,857 across 35 applications. A card that led
 * with an API bar alone would point the advisor at the wrong number.
 */
function ProgressRow({ label, current, target, format, testId }) {
  const pct = target ? Math.min(100, Math.round((current / target) * 100)) : null;
  const remaining = target != null ? Math.max(0, target - current) : null;
  return (
    <div className="flex-1 min-w-[150px]" data-testid={testId}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">{label}</p>
        <p className="text-sm font-bold text-ink tabular-nums">
          {format(current)}
          {target != null && <span className="text-ink-muted font-normal"> of {format(target)}</span>}
        </p>
      </div>
      <div className="h-2 rounded-full bg-surface-muted overflow-hidden mt-1.5">
        <div className="h-full bg-gold rounded-full" style={{ width: `${pct ?? 0}%` }} />
      </div>
      <p className="text-[10px] font-mono text-ink-muted mt-1 tabular-nums">
        {target == null
          ? 'target pending'
          : remaining === 0 ? 'target reached' : `${format(remaining)} to go`}
      </p>
    </div>
  );
}

function LensStrip({ lens, onExportProof, canExport }) {
  const targetLabel = lens.api.target != null
    ? `${formatCurrency(lens.api.current)} of ${formatCurrency(lens.api.target)}`
    : `${formatCurrency(lens.api.current)} counted · target pending`;
  return (
    <div
      className="card flex flex-col gap-3.5 border-gold/40"
      data-testid="campaign-lens-strip"
    >
      <div>
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-gold-ink">
          ★ Lens · {String(lens.kind).toUpperCase()} proof
        </p>
        <p className="text-xl font-bold text-ink mt-1">{lens.name}</p>
        <p className="text-xs text-ink-muted mt-0.5">
          Viewing your policies through this campaign&apos;s eligibility rules.
        </p>
      </div>

      {lens.creditTableApplied ? (
        <>
          <div className="flex items-start gap-4 flex-wrap">
            <ProgressRow
              label="Applications"
              current={lens.apps.current}
              target={lens.apps.target}
              format={(n) => String(n)}
              testId="campaign-lens-apps"
            />
            <ProgressRow
              label="API"
              current={lens.api.current}
              target={lens.api.target}
              format={formatCurrency}
              testId="campaign-lens-api"
            />
          </div>
          {/* The level in reach, named. Both bars above are measured against
              THIS tier, not the ladder ceiling, so the advisor is told which
              level the percentages belong to rather than left to guess. */}
          <p className="text-[11px] text-ink-muted" data-testid="campaign-lens-tier">
            {lens.tierNext ? (
              <>
                {lens.tierReached
                  ? <>On for <strong className="font-semibold text-ink">{lens.tierReached.name}</strong>. Next up: </>
                  : <>No level reached yet. Working toward </>}
                <strong className="font-semibold text-ink">{lens.tierNext.name}</strong>
                {accommodationLabel(lens.tierNext.accommodation)
                  ? <> — a {accommodationLabel(lens.tierNext.accommodation)} room</>
                  : null}.
              </>
            ) : lens.atTop ? (
              <>On for <strong className="font-semibold text-ink">{lens.tierReached.name}</strong> — the top level.</>
            ) : null}
          </p>
          <div className="flex justify-between gap-2 flex-wrap text-[10px] font-mono text-ink-muted">
            <span className="tabular-nums">{lens.counts.covered}/{lens.counts.tracked} settled</span>
            {lens.endsIn && <span className="text-gold-ink font-bold">{lens.endsIn}</span>}
          </div>
        </>
      ) : (
        <div className="flex items-baseline gap-4 flex-wrap">
          <div className="shrink-0">
            <p className="text-4xl font-bold text-gold-ink tabular-nums leading-none">{lens.progressPct}%</p>
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted mt-1">
              {lens.targetDerived ? 'of goal' : 'settled / tracked'}
            </p>
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
              <div
                className="h-full bg-gold rounded-full"
                style={{ width: `${lens.progressPct}%` }}
              />
            </div>
            <div className="flex justify-between gap-2 flex-wrap mt-2 text-[10px] font-mono text-ink-muted">
              <span className="tabular-nums">
                {lens.counts.covered}/{lens.counts.tracked} settled · {targetLabel}
              </span>
              {lens.endsIn && <span className="text-gold-ink font-bold">{lens.endsIn}</span>}
            </div>
          </div>
        </div>
      )}

      {/* C-D11 — the as-at stamp. With no organic policies in the ledger, this
          readout is only ever as current as the last portfolio export. Saying so
          is the difference between a number and a number you can act on. */}
      {lens.exportDate && (
        <p className="text-[11px] text-ink-muted" data-testid="campaign-lens-as-at">
          As at {lens.exportDate}, from the portfolio import. Business issued after
          that date is not included yet.
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={canExport ? onExportProof : undefined}
          disabled={!canExport}
          aria-disabled={!canExport}
          title={canExport ? 'Download a CSV of this campaign\'s contribution proof.' : 'No contributions yet — nothing to export.'}
          className={`min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold ${
            canExport ? 'hover:opacity-90 transition-opacity' : 'opacity-60 cursor-not-allowed'
          }`}
          data-testid="campaign-lens-export"
        >
          <Download size={14} /> Export proof
        </button>
        {!lens.targetDerived && (
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
            <Target size={11} className="shrink-0" />
            Goal target not set on this campaign — progress shows settled vs tracked.
          </span>
        )}
      </div>
    </div>
  );
}

export default function CampaignLensPanel({ policies }) {
  const flagOn = useFeatureFlag('policyLedgerCampaignLens');
  const { user, userProfile, tenantId } = useAuth();

  const [campaigns, setCampaigns] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = () => {
    if (!flagOn || !tenantId || !user?.uid) return;
    setLoading(true);
    setError(null);
    getActiveCampaignsForAgent(tenantId, user.uid, userProfile?.unitId)
      .then((rows) => {
        setCampaigns(rows);
        setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
      })
      .catch((e) => setError(e.message ?? 'Failed to load campaigns.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!flagOn) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagOn, tenantId, user?.uid, userProfile?.unitId]);

  const selected = useMemo(
    () => (campaigns ?? []).find((c) => c.id === selectedId) ?? (campaigns ?? [])[0] ?? null,
    [campaigns, selectedId],
  );
  const lens = useMemo(
    () => (selected ? derivePolicyLens(policies, selected, {}) : null),
    [policies, selected],
  );
  const counts = useMemo(() => lensFilterCounts(lens?.contributions), [lens]);
  const proof = useMemo(() => buildCampaignProofExport(lens, policies), [lens, policies]);
  const canExport = Boolean(proof?.rows?.length);

  const handleExportProof = () => {
    if (!proof || !canExport) return;
    const today = new Date().toISOString().slice(0, 10);
    const csvRows = [
      ['Campaign', proof.campaignName],
      ['Generated', today],
      [],
      proof.headers,
      ...proof.rows,
    ];
    const filename = `campaign-proof-${slugifyForFilename(proof.campaignName)}-${today}.csv`;
    downloadCsv(filename, buildCsvContent(csvRows));
  };

  // Flag OFF ⇒ surface entirely absent (no fetch, no markup).
  if (!flagOn) return null;

  if (loading && campaigns === null) {
    return (
      <div className="flex flex-col gap-3" data-testid="campaign-lens-loading">
        <PanelSkeleton variant="metric-row" count={1} label="Loading campaign lens…" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="card flex items-center gap-2 text-sm text-danger-ink flex-wrap"
        data-testid="campaign-lens-error"
      >
        <AlertCircle size={16} className="shrink-0" />
        <span className="flex-1">{error}</span>
        <button
          type="button"
          onClick={load}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-lg border border-border bg-card text-ink text-sm font-semibold hover:bg-surface transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!lens) {
    return (
      <div
        className="card flex items-start gap-2 bg-surface-muted"
        data-testid="campaign-lens-empty"
      >
        <Target size={16} className="text-ink-muted shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-sm text-ink">
          <p className="font-semibold">No active campaign to view through.</p>
          <p className="text-xs text-ink-muted mt-1">
            When a campaign you&apos;re in is running, this lens shows which of your
            policies count toward it.
          </p>
        </div>
      </div>
    );
  }

  const visibleIds = Object.entries(lens.contributions)
    .filter(([, c]) => filter === 'all' || c.state === filter)
    .map(([id]) => id);
  const policyById = Object.fromEntries((policies ?? []).map((p) => [p.id, p]));

  return (
    <div className="flex flex-col gap-3" data-testid="campaign-lens-panel">
      {/* Campaign selector (only when >1 active) */}
      {(campaigns ?? []).length > 1 && (
        <div className="flex items-center gap-2">
          <label htmlFor="lens-campaign" className="text-xs font-semibold text-ink-muted">Lens</label>
          <select
            id="lens-campaign"
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-10 px-3 rounded-lg border border-border bg-card text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="campaign-lens-selector"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name ?? c.id}</option>
            ))}
          </select>
        </div>
      )}

      <LensStrip lens={lens} onExportProof={handleExportProof} canExport={canExport} />

      {/* Lens filter chips */}
      <div className="flex gap-1 p-1 bg-surface-muted border border-border rounded-[10px] self-start" role="tablist" aria-label="Filter contributions">
        {LENS_FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(f.key)}
              className={`min-h-[36px] px-3 rounded-md text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                on ? 'bg-card text-ink border border-border shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
              data-testid={`lens-filter-${f.key}`}
            >
              {f.label}
              <span className={`font-mono text-[10px] px-1.5 rounded-full ${on ? 'bg-gold-tint text-gold-ink' : 'text-ink-muted'}`}>
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contribution list */}
      <div className="flex flex-col gap-2" data-testid="campaign-lens-contributions">
        {visibleIds.length === 0 ? (
          <div className="card text-center py-6">
            <p className="text-sm text-ink-muted">No policies in this bucket.</p>
          </div>
        ) : (
          visibleIds.map((id) => {
            const p = policyById[id];
            if (!p) return null;
            return (
              <div key={id} className="card flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{p.ownerName || 'Policy'}</p>
                  <p className="text-xs text-ink-muted truncate">
                    {p.planName || p.policyClass || '—'}
                    {p.policyNumber ? ` · #${p.policyNumber}` : ''}
                  </p>
                  {/* The reason is shown, not just tooltipped. "Excluded" with
                      no stated cause is the shape that makes an advisor
                      distrust the whole surface. */}
                  {lens.contributions[id]?.reason && (
                    <p className="text-[11px] text-ink-muted mt-0.5">{lens.contributions[id].reason}</p>
                  )}
                </div>
                <ContributionBadge contribution={lens.contributions[id]} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
