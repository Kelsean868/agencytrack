import React, { useMemo, useState } from 'react';
import { AlertTriangle, Download, Loader2, FileText } from 'lucide-react';
import PanelSkeleton from '../ui/PanelSkeleton';
import TimePeriodToggle from '../productionReport/TimePeriodToggle';
import DataSourceBadge from '../productionReport/DataSourceBadge';
import { useCountUp } from '../../hooks/useCountUp';
import { formatCurrency } from '../../utils/formatters';
import {
  RATIO_KEY_ORDER, RATIO_LABELS, formatRatioValue, ratioColorClass,
} from '../../utils/extractFields';
import { deriveAgentReportModel } from './agentReportModel';
import { formatPersistencyPct } from '../../lib/persistency/persistencyRounding';

/**
 * AgentReportView — the live, in-app twin of the Agent Performance Report PDF
 * (AgentReportDocument.jsx). Presentational + reuse-ready: it derives EVERY
 * number through {@link deriveAgentReportModel} (the shared extractFields path),
 * never re-deriving activity/production locally. Hosts the SAME "Download PDF"
 * flow the dashboard already exposes (passed down via `onDownloadPDF`).
 *
 * Reused (later, out of scope for 1.2) by the manager coaching drawer (item 1.5)
 * and Meeting Mode (item 3.3) — hence no AgentDashboard coupling here.
 *
 * @param {'wide'|'narrow'} [props.layout='wide']  wide = 2-col dashboard tab; narrow = 1-col drawer/mobile
 * @param {Array}   props.submissions
 * @param {Array}   props.settlements
 * @param {object}  props.goals
 * @param {Array}   props.persistency
 * @param {object}  props.ruleset       (reserved — awards parity with the PDF; not surfaced in 1.2)
 * @param {object}  props.agentProfile
 * @param {string}  [props.displayName]
 * @param {string}  [props.roleLabel]
 * @param {boolean} [props.loading]
 * @param {boolean} [props.error]
 * @param {Function}[props.onRetry]
 * @param {Function}[props.onDownloadPDF]  triggers the existing ReportRangeModal → generateAgentPDF flow
 * @param {boolean} [props.generating]     PDF generation in flight
 * @param {Date}    [props.now]
 */
export default function AgentReportView({
  layout = 'wide',
  submissions = [],
  settlements = [],
  goals = null,
  persistency = [],
  ruleset = null, // eslint-disable-line no-unused-vars -- reserved for awards parity (item 1.5+)
  agentProfile = null,
  displayName,
  roleLabel,
  loading = false,
  error = false,
  onRetry,
  onDownloadPDF,
  generating = false,
  now,
}) {
  const [period, setPeriod] = useState('ytd');
  const referenceNow = useMemo(() => now ?? new Date(), [now]);

  const model = useMemo(
    () => deriveAgentReportModel({
      submissions, settlements, goals, persistency,
      agentProfile, period, now: referenceNow,
    }),
    [submissions, settlements, goals, persistency, agentProfile, period, referenceNow]
  );

  // §2 count-up — hero numeral counts from 0 on load; the hook snaps straight to
  // the exact value under prefers-reduced-motion (no rounding drift on TTD).
  const displayHeroApi = useCountUp(model.heroPrimaryAPI, { duration: 1000, decimals: 2 });

  // ── Four states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col gap-4" data-testid="agent-report-loading">
        <PanelSkeleton variant="metric-row" count={4} label="Loading your performance report…" />
        <PanelSkeleton variant="card-grid" count={4} />
        <PanelSkeleton variant="list" count={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 p-8 rounded-xl bg-danger/10 border border-danger/30 text-center"
        data-testid="agent-report-error"
      >
        <AlertTriangle size={28} className="text-danger-ink" aria-hidden="true" />
        <p className="text-sm text-danger-ink font-medium">
          Couldn&apos;t load your performance report — check your connection and try again.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[44px] px-4 rounded-lg bg-card border border-border text-ink text-sm font-semibold hover:bg-surface transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!model.hasAnySubmission) {
    return (
      <div
        className="flex flex-col items-center gap-3 p-10 rounded-xl bg-card border border-border text-center"
        data-testid="agent-report-empty"
      >
        <FileText size={30} className="text-ink-muted" aria-hidden="true" />
        <p className="text-base font-semibold text-ink">No reports yet</p>
        <p className="text-sm text-ink-muted max-w-sm">
          Your performance report builds itself from your weekly reports. Submit your first
          weekly report and your numbers will appear here.
        </p>
      </div>
    );
  }

  const wide = layout === 'wide';
  const initials = (displayName ?? 'Agent')
    .split(' ').filter(Boolean).map((s) => s[0]).join('').toUpperCase().slice(0, 2) || '?';

  const downloadBtn = onDownloadPDF && (
    <button
      type="button"
      onClick={onDownloadPDF}
      disabled={generating}
      data-testid="agent-report-download"
      className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-lg border border-primary text-primary text-sm font-semibold hover:bg-primary/5 transition-colors disabled:opacity-60"
    >
      {generating
        ? (<><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Generating…</>)
        : (<><Download size={15} aria-hidden="true" /> {wide ? 'Download PDF' : 'PDF'}</>)}
    </button>
  );

  // ── Header ────────────────────────────────────────────────────────────────
  const header = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="w-11 h-11 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-base font-display shrink-0"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold font-display text-ink leading-tight truncate">
            {displayName ?? 'Agent'}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            {[roleLabel, 'Performance report'].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex-1" />
        <DataSourceBadge source={model.dataSource} />
        {downloadBtn}
      </div>
      <div>
        <TimePeriodToggle selected={period} onChange={setPeriod} />
      </div>
    </div>
  );

  // ── Hero stat card ──────────────────────────────────────────────────────
  const heroCard = (
    <div className="card" data-testid="agent-report-hero">
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <ReportStat
          k={model.heroEyebrow}
          v={formatCurrency(displayHeroApi)}
          testId="agent-report-hero-api"
        />
        <ReportStat
          k={model.hasSettlements ? 'APPS · Settled' : 'APPS · Submitted'}
          v={String(model.heroApps)}
        />
        <ReportStat
          k="Persistency"
          v={formatPersistencyPct(model.persistencyPct)}
        />
        <div className="flex-1" />
        <ReportStat
          k="Closing ratio"
          v={formatRatioValue('closingRatio', model.closingRatio)}
        />
      </div>
    </div>
  );

  // ── Period windows ──────────────────────────────────────────────────────
  const WINDOWS = [
    { id: 'week', label: 'Week' },
    { id: 'mtd', label: 'Month' },
    { id: 'quarter', label: 'Quarter' },
    { id: 'ytd', label: 'Year' },
  ];
  const windowsGrid = (
    <div>
      <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted mb-2.5">
        Production · week → year
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="agent-report-windows">
        {WINDOWS.map((p) => {
          const t = model.windows[p.id];
          const active = p.id === model.activePeriod;
          return (
            <div
              key={p.id}
              className={`rounded-xl p-3 border ${active ? 'bg-primary-tint border-primary/30' : 'bg-card border-border'}`}
            >
              <p className={`text-[9px] font-bold font-mono uppercase tracking-widest ${active ? 'text-primary' : 'text-ink-muted'}`}>
                {p.label}
              </p>
              <p className="text-lg font-bold font-display text-ink tracking-tight mt-1 tabular-nums">
                {formatCurrency(t.totalApi)}
              </p>
              <p className="text-[10px] text-ink-muted mt-0.5 font-mono tabular-nums">{t.totalApps} apps</p>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Activity tiles (period-scoped) ──────────────────────────────────────
  const ACTIVITY_TILES = [
    { key: 'dials', label: 'Dials' },
    { key: 'contacts', label: 'Tel Contacts' },
    { key: 'f2f', label: 'F2F' },
    { key: 'ffi', label: 'FFI' },
    { key: 'ci', label: 'CI' },
    { key: 'apps', label: 'Apps' },
    { key: 'names', label: 'New Names' },
  ];
  const activityCard = (
    <div className="card">
      <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted mb-3">
        Activity · {WINDOWS.find((w) => w.id === model.activePeriod)?.label}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5" data-testid="agent-report-activity">
        {ACTIVITY_TILES.map((tile) => (
          <div key={tile.key} className="rounded-xl p-3 border border-border bg-surface-raised">
            <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
              {tile.label}
            </p>
            <p
              className="text-xl font-bold font-display text-ink tracking-tight mt-1 tabular-nums"
              data-testid={`agent-report-activity-${tile.key}`}
            >
              {model.activity[tile.key]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  // ── 6-week API trajectory ───────────────────────────────────────────────
  const trajectoryCard = (
    <div className="card">
      <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted mb-3">
        6-week API trajectory
      </p>
      <Trajectory values={model.trajectory} />
    </div>
  );

  // ── Coaching ratios (canonical computeRatios via shared helpers) ─────────
  const ratiosCard = (
    <div className="card">
      <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted mb-3">
        Coaching ratios
      </p>
      <div className="grid grid-cols-2 gap-2.5" data-testid="agent-report-ratios">
        {RATIO_KEY_ORDER.map((key) => (
          <div key={key} className="rounded-lg p-2.5 border border-border bg-surface-raised">
            <p className="text-[10px] text-ink-muted font-mono">{RATIO_LABELS[key].label}</p>
            <p
              className={`text-lg font-bold font-display tracking-tight mt-0.5 tabular-nums ${ratioColorClass(key, model.ratios[key])}`}
              data-testid={`agent-report-ratio-${key}`}
            >
              {formatRatioValue(key, model.ratios[key])}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Floor bar ───────────────────────────────────────────────────────────
  const floorCard = (
    <div className="card">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">
          Year to date vs tenure floor
        </p>
        <span className="text-xs text-ink-muted tabular-nums">
          {formatCurrency(model.ytdAPI)} / {formatCurrency(model.ytdFloor)}
        </span>
      </div>
      <div className="w-full bg-surface-muted rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${model.aboveFloor ? 'bg-primary' : 'bg-warning'}`}
          style={{ width: `${model.floorPct}%` }}
        />
      </div>
      <p className={`text-xs font-semibold mt-2 ${model.aboveFloor ? 'text-success-ink' : 'text-warning-ink'}`}>
        {model.aboveFloor
          ? `✓ ${model.floorPct}% — above floor`
          : `${model.floorPct}% — keep pushing to clear floor`}
      </p>
    </div>
  );

  // ── Layout composition ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 stagger" data-testid={`agent-report-${layout}`}>
      {header}
      {heroCard}
      {wide ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_360px] gap-4 items-start">
          <div className="flex flex-col gap-4 min-w-0">
            {windowsGrid}
            {activityCard}
          </div>
          <div className="flex flex-col gap-4 min-w-0">
            {trajectoryCard}
            {ratiosCard}
            {floorCard}
          </div>
        </div>
      ) : (
        <>
          {windowsGrid}
          {activityCard}
          {trajectoryCard}
          {ratiosCard}
          {floorCard}
        </>
      )}
    </div>
  );
}

// ── Small pieces ────────────────────────────────────────────────────────────
function ReportStat({ k, v, testId }) {
  return (
    <div>
      <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-ink-muted">{k}</p>
      <p
        className="text-2xl font-bold font-display text-ink tracking-tight mt-1 leading-none tabular-nums"
        data-testid={testId}
      >
        {v}
      </p>
    </div>
  );
}

// Transform-free inline sparkline. Theme-aware via currentColor (text-primary).
function Trajectory({ values }) {
  if (!values || values.length < 2) {
    return (
      <p className="text-sm text-ink-muted" data-testid="agent-report-trajectory-empty">
        Submit at least 2 weekly reports to see your API trajectory.
      </p>
    );
  }
  const W = 320;
  const H = 64;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((val, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((val - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-16 text-primary"
      preserveAspectRatio="none"
      role="img"
      aria-label="Six-week API trajectory"
      data-testid="agent-report-trajectory"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
