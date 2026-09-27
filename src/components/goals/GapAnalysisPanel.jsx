import React from 'react';
import { Target, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { statusToken } from '../../lib/policyStatusTokens';
import { tenureBandLabel } from '../../utils/tenureFloors';

// Group-key dots — one colour per org layer
const LAYER_DOT = {
  personal:           'bg-primary',
  unitTarget:         'bg-violet-600',
  branchTarget:       'bg-warning',
  salesManagerTarget: 'bg-amber-400',
  companyFloor:       'bg-danger',
};

// ── HeroMetricRow ─────────────────────────────────────────────────────────────
function HeroMetricRow({ label, ytd, pct, belowFloor }) {
  const barFg = belowFloor ? 'bg-warning'         : 'bg-white dark:bg-primary-dark';
  const barBg = belowFloor ? 'bg-warning/20'      : 'bg-white/20 dark:bg-border/40';
  const textCls = belowFloor ? 'text-warning-ink' : 'text-white dark:text-ink';
  const mutedCls = belowFloor ? 'text-warning-ink/70' : 'text-white/80 dark:text-ink-muted';
  const labelCls = belowFloor ? 'text-warning-ink/80' : 'text-white/90 dark:text-ink-muted';

  return (
    <div className="flex items-center gap-3 min-h-[22px]">
      <p className={`text-[10px] font-semibold w-8 shrink-0 ${labelCls}`}>{label}</p>
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${barBg}`}>
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${barFg}`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
      <p className={`text-[11px] font-semibold shrink-0 tabular-nums ${textCls}`}>{ytd}</p>
      {pct !== null && (
        <p className={`text-[10px] shrink-0 w-8 text-right ${mutedCls}`}>{pct}%</p>
      )}
    </div>
  );
}

// ── CommitmentHero ─────────────────────────────────────────────────────────────
// Hero pane for the agent's Personal Commitment — API + Apps + Persistency vs YTD.
// Flips to warning tone when any metric is below the company floor.
function CommitmentHero({ personal, ytdTotals, belowFloor, ytdPersistency, persistencyFloor }) {
  const apiTarget  = personal?.api  ?? null;
  const appsTarget = personal?.apps ?? null;
  const ytdApi     = ytdTotals?.api  ?? 0;
  const ytdApps    = ytdTotals?.apps ?? 0;

  const apiPct  = apiTarget  > 0 ? Math.max(0, Math.min(100, Math.round((ytdApi  / apiTarget)  * 100))) : null;
  const appsPct = appsTarget > 0 ? Math.max(0, Math.min(100, Math.round((ytdApps / appsTarget) * 100))) : null;

  const pstDisplay = ytdPersistency !== null
    ? `${(ytdPersistency * 100).toFixed(1)}%`
    : '—';
  const pstBarPct = ytdPersistency !== null && persistencyFloor > 0
    ? Math.max(0, Math.min(100, Math.round((ytdPersistency * 100 / persistencyFloor) * 100)))
    : null;

  const containerCls = belowFloor
    ? 'bg-warning-tint border border-warning/30 dark:bg-surface-raised dark:border-warning/50'
    : 'bg-primary dark:bg-surface-raised dark:border dark:border-primary-dark';
  const headingCls = belowFloor ? 'text-warning-ink/70' : 'text-white/90 dark:text-ink-muted';
  const bigNumCls  = belowFloor ? 'text-warning-ink'    : 'text-white dark:text-ink';
  const subCls     = belowFloor ? 'text-warning-ink/60' : 'text-white/80 dark:text-ink-muted';

  return (
    <div className={`rounded-xl p-4 ${containerCls}`} data-testid="commitment-hero">
      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${headingCls}`}>
        Your Commitment
      </p>
      {apiTarget !== null && (
        <div className="flex items-baseline gap-2 mb-3">
          <p className={`text-2xl font-bold tabular-nums ${bigNumCls}`}>
            {formatCurrency(apiTarget)}
          </p>
          <p className={`text-xs ${subCls}`}>Annual API target</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {apiTarget !== null && (
          <HeroMetricRow
            label="API"
            ytd={formatCurrency(Math.round(ytdApi))}
            pct={apiPct}
            belowFloor={belowFloor}
          />
        )}
        {appsTarget !== null && (
          <HeroMetricRow
            label="Apps"
            ytd={String(Math.round(ytdApps))}
            pct={appsPct}
            belowFloor={belowFloor}
          />
        )}
        <HeroMetricRow
          label="Pst."
          ytd={pstDisplay}
          pct={pstBarPct}
          belowFloor={belowFloor}
        />
      </div>
    </div>
  );
}

// ── OrgContextStrip ───────────────────────────────────────────────────────────
// Collapsed Unit / Branch / SM context — reference values, no competing YTD bars.
function OrgContextStrip({ hierarchy }) {
  if (!hierarchy) return null;
  const { salesManagerTarget, branchTarget, unitTarget } = hierarchy;

  const tiers = [
    { key: 'unitTarget',         label: 'Unit',   api: unitTarget?.api         ?? null },
    { key: 'branchTarget',       label: 'Branch', api: branchTarget?.api       ?? null },
    { key: 'salesManagerTarget', label: 'SM',     api: salesManagerTarget?.api ?? null },
  ].filter((t) => t.api !== null);

  if (tiers.length === 0) return null;

  return (
    <div
      className="rounded-lg border border-border/40 bg-surface-raised px-3 py-2.5 flex flex-col gap-1.5"
      data-testid="org-context-strip"
    >
      <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-muted">
        Rolls up through Unit → Branch → SM
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {tiers.map(({ key, label, api }) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${LAYER_DOT[key]}`} />
            <span className="font-medium text-ink">{label}:</span>
            &nbsp;{formatCurrency(Math.round(api))}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── FloorRow ──────────────────────────────────────────────────────────────────
// Company Floor full-detail row with YTD progress bar. `floorApps` is the
// company apps minimum (config/companyMinimums.annualApps, the same in every
// tenure band), shown beside the API figure when known.
function FloorRow({ floorApi, floorApps, ytdApi, contractStartDate }) {
  if (!floorApi) return null;
  const pct = Math.max(0, Math.min(100, Math.round((ytdApi / floorApi) * 100)));
  const gap = floorApi - ytdApi;
  // Tenure band, when known — never hard-codes a figure; falls back to the
  // unqualified "Company Floor" label when contractStartDate is missing (PR #984).
  const bandLabel = tenureBandLabel(contractStartDate);
  const floorLabel = bandLabel ? `Company minimum (${bandLabel})` : 'Company Floor';
  const appsSuffix = floorApps > 0 ? ` · ${Math.round(floorApps)} apps` : '';

  return (
    <div className="rounded-lg border border-border/40 p-3 flex flex-col gap-2" data-testid="floor-row">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${LAYER_DOT.companyFloor}`} />
        <p className="text-[10px] font-semibold text-ink-muted uppercase tracking-wide">{floorLabel}</p>
        <p className="ml-auto shrink-0 text-[11px] font-semibold text-ink tabular-nums" data-testid="floor-row-value">
          {formatCurrency(Math.round(floorApi))}{appsSuffix}
        </p>
      </div>
      <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
        <div
          className="h-1.5 rounded-full bg-danger transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-ink-muted">
          YTD: <span className="font-semibold text-ink">{formatCurrency(Math.round(ytdApi))}</span>
        </p>
        {gap <= 0 ? (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-success-tint text-success-ink">
            <CheckCircle2 size={10} /> Met
          </span>
        ) : (
          <span className="text-[10px] text-ink-muted">{pct}%</span>
        )}
      </div>
    </div>
  );
}

// ── GapNote ───────────────────────────────────────────────────────────────────
// Plain-words "commitment vs floor" readout.
// Reuses statusToken's settled/soft roles for consistent Nexus token colours.
function GapNote({ personal, companyFloor }) {
  const personalApi = personal?.api    ?? null;
  const floorApi    = companyFloor?.api ?? null;
  if (personalApi === null || floorApi === null) return null;

  const diff  = personalApi - floorApi;
  const above = diff >= 0;
  const tok   = statusToken(above ? 'settled' : 'soft');
  const amount = formatCurrency(Math.abs(Math.round(diff)));

  return (
    <div
      className={`rounded-lg px-3 py-2.5 flex items-center gap-2 ${tok.tint}`}
      data-testid="gap-note"
    >
      {above ? (
        <CheckCircle2 size={14} className={`shrink-0 ${tok.text}`} />
      ) : (
        <AlertTriangle size={14} className={`shrink-0 ${tok.text}`} />
      )}
      <p className={`text-xs font-medium ${tok.text}`}>
        Your commitment is {amount}{' '}
        <span className="font-semibold">{above ? 'above' : 'below'}</span>
        {' '}the company floor.
      </p>
    </div>
  );
}

// ── GapAnalysisPanel ──────────────────────────────────────────────────────────
export default function GapAnalysisPanel({
  hierarchy,
  ytdTotals,
  loading,
  error = null,
  title = 'Goal Hierarchy',
  ytdPersistency = null,
  persistencyFloor = 90,
  contractStartDate = null,
}) {
  const ytdApi      = ytdTotals?.api ?? 0;
  const hasPersonal = Boolean(hierarchy?.personal?.api);
  const belowFloor  =
    (hasPersonal &&
      hierarchy?.companyFloor?.api != null &&
      hierarchy.personal.api < hierarchy.companyFloor.api) ||
    (ytdPersistency !== null && parseFloat((ytdPersistency * 100).toFixed(1)) < persistencyFloor);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-3" data-testid="gap-analysis-loading">
        <div className="h-28 rounded-xl bg-primary/20 animate-pulse" />
        <div className="h-10 rounded-lg  bg-border/30 animate-pulse" />
        <div className="h-16 rounded-lg  bg-border/30 animate-pulse" />
        <div className="h-8  rounded-lg  bg-border/30 animate-pulse" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="card" data-testid="gap-analysis-error">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">{title}</p>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <AlertTriangle size={24} className="text-warning" />
          <p className="text-sm font-semibold text-ink">Nothing&apos;s wrong with your plan</p>
          <p className="text-xs text-ink-muted">{error}</p>
        </div>
      </div>
    );
  }

  // ── Empty — no hierarchy at all ───────────────────────────────────────────────
  if (!hierarchy) {
    return (
      <div className="card" data-testid="gap-analysis-empty">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">{title}</p>
        <p className="text-sm text-ink-muted italic">No targets have been set yet.</p>
      </div>
    );
  }

  // ── Empty — hierarchy present but no personal commitment ──────────────────────
  if (!hasPersonal) {
    return (
      <div className="card flex flex-col gap-3" data-testid="gap-analysis-no-commitment">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
        <div className="rounded-xl border-2 border-dashed border-border/50 p-5 flex flex-col items-center gap-2 text-center">
          <Target size={24} className="text-ink-muted" />
          <p className="text-sm font-semibold text-ink">No commitment set yet</p>
          <p className="text-xs text-ink-muted">
            Build it in Game Plan to see your goal hierarchy here.
          </p>
        </div>
        {/* Cascade still shows the floor so the agent can see what they&apos;re aiming for */}
        {hierarchy.companyFloor?.api && (
          <FloorRow floorApi={hierarchy.companyFloor.api} floorApps={hierarchy.companyFloor.apps} ytdApi={ytdApi} contractStartDate={contractStartDate} />
        )}
      </div>
    );
  }

  // ── Populated ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3" data-testid="gap-analysis-panel">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</p>

      <CommitmentHero
        personal={hierarchy.personal}
        ytdTotals={ytdTotals}
        belowFloor={belowFloor}
        ytdPersistency={ytdPersistency}
        persistencyFloor={persistencyFloor}
      />

      <OrgContextStrip hierarchy={hierarchy} />

      <FloorRow floorApi={hierarchy.companyFloor?.api} floorApps={hierarchy.companyFloor?.apps} ytdApi={ytdApi} contractStartDate={contractStartDate} />

      <GapNote personal={hierarchy.personal} companyFloor={hierarchy.companyFloor} />
    </div>
  );
}
