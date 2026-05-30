import React, { useState, useMemo } from 'react';
import { Download, Loader2, ChevronRight, Flame } from 'lucide-react';
import { extractFields } from '../../utils/extractFields';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTtdShort(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)    return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000)      return `${(n / 1000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function fmtTtdFull(n) {
  if (n >= 1_000_000) return `TTD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000)    return `TTD ${(n / 1000).toFixed(0)}K`;
  if (n >= 1000)      return `TTD ${(n / 1000).toFixed(1)}K`;
  return `TTD ${Math.round(n).toLocaleString()}`;
}

function weekLabel(s) {
  if (!s.weekStarting) return '—';
  const d = new Date(s.weekStarting + 'T12:00:00Z');
  const day = d.toLocaleDateString('en-TT', { day: '2-digit', month: 'short' });
  return `Sun ${day}`;
}

function getSubmissionAPI(s) {
  return parseFloat(s.apiSold) || extractFields(s).apiSold || 0;
}

function deriveStatus(s) {
  if (s.unlockedBy) return 'unlocked';
  return s.status ?? 'draft';
}

function generateYearSundays(year) {
  // Get the first Sunday of the year (or the last Sunday of the previous year that falls in the year range)
  // Adjust to first Sunday of or before Jan 7
  const jan4 = new Date(Date.UTC(year, 0, 4)); // always in week 1
  const offset = jan4.getUTCDay(); // 0=Sun, so offset = days since last Sunday
  const firstSunday = new Date(Date.UTC(year, 0, 4 - offset));

  const sundays = [];
  for (let i = 0; i < 52; i++) {
    const d = new Date(firstSunday);
    d.setUTCDate(firstSunday.getUTCDate() + i * 7);
    if (d.getUTCFullYear() > year) break;
    sundays.push(d.toISOString().split('T')[0]);
  }
  return sundays;
}

function computeAnchor(submissions, year, weeklyTarget) {
  const thisYearSubs = submissions.filter(s => s.weekStarting?.startsWith(String(year)));
  const submitted    = thisYearSubs.filter(s => s.status === 'submitted');
  const drafts       = thisYearSubs.filter(s => s.status !== 'submitted' && !s.unlockedBy);
  const unlocked     = thisYearSubs.filter(s => !!s.unlockedBy);

  const ytdAPI  = submitted.reduce((sum, s) => sum + getSubmissionAPI(s), 0);
  const avgApi  = submitted.length > 0 ? Math.round(ytdAPI / submitted.length / 100) * 100 : 0;
  const award   = submitted.filter(s => getSubmissionAPI(s) >= weeklyTarget);

  // Best week
  const bestWeek = submitted.reduce((a, b) => getSubmissionAPI(b) > getSubmissionAPI(a) ? b : a, submitted[0] ?? null);

  // Streak computation — sort by weekStarting asc
  const sortedSubs = [...thisYearSubs].sort((a, b) => (a.weekStarting ?? '').localeCompare(b.weekStarting ?? ''));
  const weekSet    = new Set(submitted.map(s => s.weekStarting));

  // Longest streak in year
  let longest = 0, curLen = 0;
  for (const s of sortedSubs) {
    if (weekSet.has(s.weekStarting)) { curLen++; longest = Math.max(longest, curLen); }
    else curLen = 0;
  }

  // Current streak — consecutive submitted going backward from most recent submitted
  const sortedDesc = [...submitted].sort((a, b) => (b.weekStarting ?? '').localeCompare(a.weekStarting ?? ''));
  let current = 0;
  if (sortedDesc.length > 0) {
    current = 1;
    for (let i = 1; i < sortedDesc.length; i++) {
      const prev = new Date(sortedDesc[i - 1].weekStarting + 'T12:00:00Z');
      const curr = new Date(sortedDesc[i].weekStarting + 'T12:00:00Z');
      const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
      if (diffDays === 7) current++;
      else break;
    }
  }

  return {
    ytdAPI, avgApi, weeksSubmitted: submitted.length,
    drafts: drafts.length, unlocked: unlocked.length,
    awardEligible: award.length,
    longestStreak: longest, currentStreak: current,
    streakToRecord: Math.max(0, longest - current),
    atPersonalBest: current >= longest && longest > 0 && longest >= 2,
    bestWeek,
  };
}

// ── HistoryAnchorStrip ────────────────────────────────────────────────────────
function HistoryAnchorStrip({ anchor, year, weeklyTarget }) {
  const goalApi = weeklyTarget * 52;
  const pct = goalApi > 0 ? Math.min(100, Math.round((anchor.ytdAPI / goalApi) * 100)) : 0;
  const yearEnd = Math.round((anchor.ytdAPI / Math.max(anchor.weeksSubmitted, 1)) * 52);

  return (
    <div className="card p-5 relative overflow-hidden" style={{ border: '1px solid rgba(1,105,111,0.25)' }}>
      <div style={{
        position: 'absolute', top: -70, right: -70, width: 240, height: 240,
        background: 'radial-gradient(circle, var(--color-primary-tint) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div className="relative">
        <p className="text-xs font-bold tracking-widest font-mono uppercase text-primary mb-1">
          Your year · {year} · {anchor.weeksSubmitted} of 52 weeks submitted
        </p>
        <div className="flex items-baseline gap-3 flex-wrap mt-1">
          <span className="text-4xl font-bold text-ink" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.028em', lineHeight: 1 }}>
            {fmtTtdFull(anchor.ytdAPI)}
          </span>
          <span className="text-xs text-ink-faint font-mono tracking-wide">
            YTD API · AVG {fmtTtdFull(anchor.avgApi)}/WK
          </span>
        </div>
        {anchor.weeksSubmitted > 0 && (
          <p className="text-xs text-ink-muted mt-1.5">
            On track for <strong className="text-ink">{fmtTtdFull(yearEnd)}</strong> if pace holds through year-end.
          </p>
        )}

        {/* Progress bar */}
        <div className="relative h-2 bg-surface-muted rounded-full overflow-hidden mt-3">
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--color-primary-dark), var(--color-primary))',
          }} />
        </div>

        {/* Chip row */}
        <div className="flex flex-wrap gap-2 mt-3">
          {/* Streak chip */}
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${anchor.atPersonalBest ? 'bg-gold/5 border-gold/30' : 'bg-surface border-border'}`}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: anchor.currentStreak > 0
                ? 'linear-gradient(180deg, var(--color-gold), var(--color-warning))'
                : 'var(--color-surface-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Flame size={13} style={{ color: anchor.currentStreak > 0 ? 'white' : 'var(--color-text-faint)' }} />
            </div>
            <div>
              <p className="text-[9px] font-bold tracking-widest font-mono uppercase" style={{ color: anchor.atPersonalBest ? 'var(--color-gold)' : 'var(--color-text-faint)' }}>
                {anchor.atPersonalBest ? 'Personal best · live' : 'Streak'}
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold text-ink" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em', lineHeight: 1 }}>
                  {anchor.currentStreak}
                </span>
                <span className="text-[9px] text-ink-faint font-mono">wks now</span>
                {anchor.longestStreak > anchor.currentStreak && (
                  <>
                    <span className="text-[9px] text-ink-faint font-mono">·</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-gold)', fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.012em' }}>
                      {anchor.longestStreak}
                    </span>
                    <span className="text-[9px] text-ink-faint font-mono">best</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {anchor.bestWeek && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface">
              <div className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ background: 'var(--color-gold)' }} />
              <div>
                <p className="text-[9px] font-bold tracking-widest font-mono uppercase text-ink-faint">Best week</p>
                <p className="text-xs font-bold text-ink mt-0.5" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.012em' }}>
                  {fmtTtdFull(getSubmissionAPI(anchor.bestWeek))}
                </p>
              </div>
            </div>
          )}

          {[
            { label: 'Award weeks', val: anchor.awardEligible, warn: false },
            { label: 'Drafts',      val: anchor.drafts,        warn: anchor.drafts > 0 },
            { label: 'Unlocked',    val: anchor.unlocked,      warn: anchor.unlocked > 0 },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-surface">
              <div className="w-1.5 h-1.5 rounded-sm flex-shrink-0" style={{ background: c.warn ? 'var(--color-warning)' : 'var(--color-gold)' }} />
              <div>
                <p className="text-[9px] font-bold tracking-widest font-mono uppercase text-ink-faint">{c.label}</p>
                <p className="text-xs font-bold text-ink mt-0.5" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.012em' }}>
                  {c.val}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── YearHeatmap ───────────────────────────────────────────────────────────────
function YearHeatmap({ submissions, year, weeklyTarget }) {
  const sundays = useMemo(() => generateYearSundays(year), [year]);

  const byWeekStart = useMemo(() => {
    const m = {};
    for (const s of submissions) {
      if (s.weekStarting) m[s.weekStarting] = s;
    }
    return m;
  }, [submissions]);

  function colorClass(s) {
    if (!s) return 'bg-surface-muted';
    const st = deriveStatus(s);
    if (st === 'unlocked') return 'bg-warning/25';
    if (st === 'draft') return 'bg-surface-muted';
    const api = getSubmissionAPI(s);
    const ratio = weeklyTarget > 0 ? api / weeklyTarget : 0;
    if (ratio >= 1.2) return 'bg-primary';
    if (ratio >= 1.0) return 'bg-primary/75';
    if (ratio >= 0.8) return 'bg-primary/50';
    if (ratio >= 0.6) return 'bg-primary/30';
    return 'bg-primary/15';
  }

  // Month label positions
  const monthLabels = [];
  let lastMonth = null;
  sundays.forEach((ws, i) => {
    const mo = ws.slice(5, 7);
    if (mo !== lastMonth) { monthLabels.push({ i, label: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][parseInt(mo, 10) - 1] }); lastMonth = mo; }
  });

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-bold tracking-widest font-mono uppercase text-ink-faint">Year at a glance · {year}</p>
        <p className="text-[10px] text-ink-faint font-mono">Target {fmtTtdFull(weeklyTarget)}/wk</p>
      </div>

      {/* Month labels */}
      <div className="relative h-4 mb-1">
        {monthLabels.map(({ i, label }) => (
          <span key={label} className="absolute text-[9px] font-bold text-ink-faint font-mono tracking-widest" style={{ left: i * 20 }}>
            {label}
          </span>
        ))}
      </div>

      {/* Squares */}
      <div className="flex flex-wrap gap-[3px]" style={{ width: '100%' }}>
        {sundays.map((ws) => {
          const s = byWeekStart[ws];
          const st = s ? deriveStatus(s) : null;
          return (
            <div
              key={ws}
              title={s ? `${ws} · ${fmtTtdFull(getSubmissionAPI(s))} · ${st}` : `${ws} · no submission`}
              style={{ width: 17, height: 17, flexShrink: 0 }}
              className={`rounded-sm ${colorClass(s)} ${st === 'unlocked' ? 'border border-warning' : st === 'draft' ? 'border border-dashed border-border' : ''}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {[
          { bg: 'bg-primary/20', label: '< 60%' },
          { bg: 'bg-primary/50', label: '60–100%' },
          { bg: 'bg-primary',    label: '≥ 100%' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-sm ${l.bg}`} />
            <span className="text-[9px] text-ink-faint font-mono tracking-wide">{l.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-surface-muted border border-dashed border-border" />
          <span className="text-[9px] text-ink-faint font-mono tracking-wide">DRAFT</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-warning/25 border border-warning" />
          <span className="text-[9px] text-ink-faint font-mono tracking-wide">UNLOCKED</span>
        </div>
      </div>
    </div>
  );
}

// ── HistoryFilterRow ──────────────────────────────────────────────────────────
function HistoryFilterRow({ activeFilter, setFilter, counts }) {
  const tabs = [
    { key: 'all',       label: 'All weeks', count: counts.all },
    { key: 'submitted', label: 'Submitted', count: counts.submitted },
    { key: 'draft',     label: 'Draft',     count: counts.draft },
    { key: 'unlocked',  label: 'Unlocked',  count: counts.unlocked },
  ];
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl border border-border bg-surface-muted overflow-x-auto">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => setFilter(t.key)}
          className={`flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-xs font-bold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            activeFilter === t.key
              ? 'bg-card text-ink shadow-sm border border-border'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {t.label}
          {t.count > 0 && (
            <span className={`text-[10px] font-bold px-1.5 rounded-full font-mono ${activeFilter === t.key ? 'bg-primary/15 text-primary' : 'text-ink-faint'}`}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── MiniSpark — 5-bar API sparkline ──────────────────────────────────────────
function MiniSpark({ values, current }) {
  const all = [...values, current];
  const max = Math.max(...all, 1);
  return (
    <div className="flex items-end gap-0.5" style={{ height: 20 }}>
      {values.map((v, i) => (
        <div key={i} style={{
          width: 4, height: Math.max(2, (v / max) * 20),
          background: 'var(--color-primary)',
          opacity: 0.3 + (i / values.length) * 0.5,
          borderRadius: 1,
        }} />
      ))}
      <div style={{
        width: 5, height: Math.max(2, (current / max) * 20),
        background: 'var(--color-primary)', borderRadius: 1,
        boxShadow: '0 0 4px rgba(1,105,111,0.6)',
      }} />
    </div>
  );
}

// ── WeekCard ──────────────────────────────────────────────────────────────────
function WeekCard({ s, prevS, sparkValues, onClick }) {
  const st       = deriveStatus(s);
  const isDraft  = st === 'draft';
  const isUnlocked = st === 'unlocked';
  const api      = getSubmissionAPI(s);
  const fields   = extractFields(s);
  const apps     = fields.applicationsSold ?? 0;
  const cis      = parseInt(s.ciConducted) || 0;
  const dials    = (parseInt(s.referralCalls) || 0) + (parseInt(s.followUpCalls) || 0) + (parseInt(s.coldCalls) || 0);
  const prevApi  = prevS ? getSubmissionAPI(prevS) : null;
  const apiDelta = prevApi !== null ? api - prevApi : null;
  const prevApps = prevS ? (extractFields(prevS).applicationsSold ?? 0) : null;
  const appsDelta= prevApps !== null ? apps - prevApps : null;
  const overall  = parseInt(s.overallRating || s.ratingOverall) || 0;

  const statusBg = isUnlocked ? 'bg-warning/15 text-warning' : isDraft ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success';
  const statusLabel = isUnlocked ? 'Unlocked' : isDraft ? 'Draft' : 'Submitted';

  const borderColor = isUnlocked ? 'border-warning/30' : isDraft ? 'border-border' : 'border-border';

  return (
    <button
      onClick={onClick}
      aria-label={`View submission from ${weekLabel(s)}`}
      className={`card w-full text-left p-4 hover:shadow-md transition-shadow border ${borderColor}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-bold text-ink" style={{ letterSpacing: '-0.005em' }}>
              {weekLabel(s)}
            </span>
            {s.weekStarting && (
              <span className="text-xs text-ink-faint font-mono">{s.weekStarting}</span>
            )}
          </div>
          {isUnlocked && s.unlockedByName && (
            <p className="text-xs text-warning mt-0.5 font-mono tracking-wide">
              UNLOCKED BY {s.unlockedByName.toUpperCase()} · NEEDS RESUBMIT
            </p>
          )}
        </div>
        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${statusBg}`}>
          {statusLabel}
        </span>
      </div>

      {/* KPI 4-up grid */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'API',   value: `TTD ${fmtTtdShort(api)}`,  delta: apiDelta !== null ? Math.round(apiDelta / 100) : null, isCurrency: true },
          { label: 'APPS',  value: apps,                         delta: appsDelta },
          { label: 'CIs',   value: cis,                          delta: null },
          { label: 'DIALS', value: dials,                        delta: null },
        ].map((k, i) => (
          <div key={i} className="p-2 rounded-lg bg-surface-muted border border-border/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-ink-faint font-mono tracking-widest">{k.label}</span>
              {k.delta !== null && k.delta !== 0 && (
                <span className={`text-[8px] font-bold font-mono px-1 rounded-sm ${k.delta > 0 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                  {k.delta > 0 ? '▲' : '▼'}
                </span>
              )}
            </div>
            <span className="text-base font-bold text-ink leading-none" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}>
              {k.value}
            </span>
          </div>
        ))}
      </div>

      {/* Footer — spark + rating + view action */}
      <div className="flex items-center gap-3 flex-wrap">
        {sparkValues && sparkValues.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-ink-faint font-mono tracking-widest">5-WK API</span>
            <MiniSpark values={sparkValues} current={api} />
          </div>
        )}
        {overall > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-ink-faint font-mono tracking-widest">RATING</span>
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{
                  width: 4, height: 10, borderRadius: 1,
                  background: i < overall ? 'var(--color-primary)' : 'var(--color-surface-muted)',
                }} />
              ))}
            </div>
            <span className="text-[11px] font-bold text-ink font-mono">{overall}/10</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-ink-muted font-mono tracking-wide">
          {isDraft ? 'CONTINUE' : isUnlocked ? 'OPEN TO EDIT' : 'VIEW DETAIL'}
          <ChevronRight size={12} />
        </div>
      </div>
    </button>
  );
}

// ── HistoryTab (default export) ───────────────────────────────────────────────
export default function HistoryTab({ submissions, onView, loading, onDownload, generating, weeklyTarget = 4800 }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const thisYear = new Date().getFullYear();

  const anchor = useMemo(
    () => computeAnchor(submissions ?? [], thisYear, weeklyTarget),
    [submissions, thisYear, weeklyTarget]
  );

  // Sort submissions by weekStarting descending (most recent first)
  const sorted = useMemo(
    () => [...(submissions ?? [])].sort((a, b) => (b.weekStarting ?? '').localeCompare(a.weekStarting ?? '')),
    [submissions]
  );

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return sorted;
    if (filterStatus === 'unlocked') return sorted.filter(s => !!s.unlockedBy);
    if (filterStatus === 'submitted') return sorted.filter(s => s.status === 'submitted' && !s.unlockedBy);
    return sorted.filter(s => s.status !== 'submitted' && !s.unlockedBy);
  }, [sorted, filterStatus]);

  const counts = useMemo(() => ({
    all: sorted.length,
    submitted: sorted.filter(s => s.status === 'submitted' && !s.unlockedBy).length,
    draft: sorted.filter(s => s.status !== 'submitted' && !s.unlockedBy).length,
    unlocked: sorted.filter(s => !!s.unlockedBy).length,
  }), [sorted]);

  // Build prevS map — for each submission find the immediately previous one by weekStarting
  const prevSMap = useMemo(() => {
    const asc = [...sorted].reverse();
    const map = {};
    for (let i = 1; i < asc.length; i++) {
      map[asc[i].id ?? asc[i].weekStarting] = asc[i - 1];
    }
    return map;
  }, [sorted]);

  // Spark values — 4 trailing API values before each submission
  const sparkMap = useMemo(() => {
    const asc = [...sorted].reverse();
    const map = {};
    for (let i = 0; i < asc.length; i++) {
      const trailing = asc.slice(Math.max(0, i - 4), i).map(s => getSubmissionAPI(s));
      map[asc[i].id ?? asc[i].weekStarting] = trailing;
    }
    return map;
  }, [sorted]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-border/40 animate-pulse" />)}
      </div>
    );
  }

  if (!submissions?.length) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-ink-muted">No submissions yet — start submitting weekly reports to see your history here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Anchor strip */}
      <HistoryAnchorStrip anchor={anchor} year={thisYear} weeklyTarget={weeklyTarget} />

      {/* Heatmap */}
      <YearHeatmap submissions={submissions} year={thisYear} weeklyTarget={weeklyTarget} />

      {/* Filter + download row */}
      <div className="flex items-center gap-2 flex-wrap">
        <HistoryFilterRow activeFilter={filterStatus} setFilter={setFilterStatus} counts={counts} />
        <div className="ml-auto">
          <button
            onClick={onDownload}
            disabled={generating}
            className="flex items-center gap-2 min-h-[36px] px-4 rounded-lg border border-primary text-primary text-xs font-bold hover:bg-primary/5 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {generating ? 'Generating…' : 'Download report'}
          </button>
        </div>
      </div>

      {/* Week cards */}
      {filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm text-ink-muted">No {filterStatus} submissions.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(s => {
            const key = s.id ?? s.weekStarting;
            return (
              <WeekCard
                key={key}
                s={s}
                prevS={prevSMap[key]}
                sparkValues={sparkMap[key]}
                onClick={() => onView(s)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
