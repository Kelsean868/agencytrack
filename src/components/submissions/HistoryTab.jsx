import React, { useState, useMemo } from 'react';
import { Download, Loader2, ChevronRight, ArrowRight, Flame, FileClock, Plus, Search, Star, X } from 'lucide-react';
import { extractFields } from '../../utils/extractFields';
import { computeSubmissionStreak } from '../../utils/submissionStreak';
import { getSubmissionAPI, isAwardWeek, longestStreakWeeks } from '../../utils/historyDerivations';
import useFocusTrap from '../../hooks/useFocusTrap';
import { getTodayTT, ymdUTC } from '../../utils/dateInputs';

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

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function deriveStatus(s) {
  if (s.unlockedBy) return 'unlocked';
  return s.status ?? 'draft';
}

// The stored free-text reflection note (self-evaluation notes), used as the
// mockup's italic week "note" snippet on cards + drill.
function submissionNote(s) {
  const f = extractFields(s);
  return (f.evaluationNotes || '').trim();
}

// 5-category canonical dials sum (referral + follow-up + cold + seminar/tradeshow
// + service). Missing seminar/tradeshow + service was the Gemini PR #390 bug.
function dialsSum(s) {
  return (parseInt(s.referralCalls)        || 0)
       + (parseInt(s.followUpCalls)         || 0)
       + (parseInt(s.coldCalls)             || 0)
       + (parseInt(s.seminarTradeshowCalls) || 0)
       + (parseInt(s.serviceCalls)          || 0);
}

function generateYearSundays(year) {
  // First Sunday of or before Jan 7 (always in ISO week 1 range for our purpose).
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const offset = jan4.getUTCDay();
  const firstSunday = new Date(Date.UTC(year, 0, 4 - offset));

  const sundays = [];
  for (let i = 0; i < 52; i++) {
    const d = new Date(firstSunday);
    d.setUTCDate(firstSunday.getUTCDate() + i * 7);
    if (d.getUTCFullYear() > year) break;
    sundays.push(ymdUTC(d));
  }
  return sundays;
}

// Most-recent Sunday on or before today (ISO yyyy-mm-dd) — the "current week".
function currentWeekStarting() {
  const d = new Date(`${getTodayTT()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return ymdUTC(d);
}

function computeAnchor(submissions, year, weeklyTarget) {
  const thisYearSubs = submissions.filter(s => s.weekStarting?.startsWith(String(year)));
  const submitted    = thisYearSubs.filter(s => s.status === 'submitted' && !s.unlockedBy);
  const drafts       = thisYearSubs.filter(s => s.status !== 'submitted' && !s.unlockedBy);
  const unlocked     = thisYearSubs.filter(s => !!s.unlockedBy);

  const ytdAPI  = submitted.reduce((sum, s) => sum + getSubmissionAPI(s), 0);
  const avgApi  = submitted.length > 0 ? Math.round(ytdAPI / submitted.length / 100) * 100 : 0;
  const award   = submitted.filter(s => getSubmissionAPI(s) >= weeklyTarget);

  const bestWeek = submitted.reduce((a, b) => getSubmissionAPI(b) > getSubmissionAPI(a) ? b : a, submitted[0] ?? null);

  const { currentStreak: current, longestStreak: longest } =
    computeSubmissionStreak(submissions, year);

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

  // @@hero-pane-start
  return (
    <div className="glass hero teal p-5 relative overflow-hidden">
      <div className="relative">
        <p className="text-xs font-bold tracking-widest font-mono uppercase text-[--hero-ink-muted-teal] mb-1">
          Your year · {year} · {anchor.weeksSubmitted} of 52 weeks submitted
        </p>
        <div className="flex items-baseline gap-3 flex-wrap mt-1">
          <span className="text-4xl font-bold text-[--hero-ink]" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.028em', lineHeight: 1 }}>
            {fmtTtdFull(anchor.ytdAPI)}
          </span>
          <span className="text-xs text-[--hero-ink-muted-teal] font-mono tracking-wide">
            YTD API · AVG {fmtTtdFull(anchor.avgApi)}/WK
          </span>
        </div>
        {anchor.weeksSubmitted > 0 && (
          <p className="text-xs text-[--hero-ink-muted-teal] mt-1.5">
            On track for <strong className="text-[--hero-ink]">{fmtTtdFull(yearEnd)}</strong> if pace holds through year-end.
          </p>
        )}

        {/* Progress bar */}
        <div className="relative h-2 bg-white/20 rounded-full overflow-hidden mt-3">
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: 'var(--hero-ink)',
          }} />
        </div>

        {/* Chip row */}
        <div className="flex flex-wrap gap-2 mt-3">
          {/* Streak chip */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[--hero-chip-island] border border-[--hero-chip-border]">
            <div style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: anchor.currentStreak > 0
                ? 'var(--hero-dot-warning)'
                : 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Flame size={13} style={{ color: anchor.currentStreak > 0 ? 'white' : 'rgba(255,255,255,0.5)' }} />
            </div>
            <div>
              <p className="text-[9px] font-bold tracking-widest font-mono uppercase" style={{ color: anchor.atPersonalBest ? 'var(--hero-accent)' : 'var(--hero-ink-muted-teal)' }}>
                {anchor.atPersonalBest ? 'Personal best · live' : 'Streak'}
              </p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold text-[--hero-ink]" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em', lineHeight: 1 }}>
                  {anchor.currentStreak}
                </span>
                <span className="text-[9px] text-[--hero-ink-muted-teal] font-mono">wks now</span>
                {anchor.longestStreak > anchor.currentStreak && (
                  <>
                    <span className="text-[9px] text-[--hero-ink-muted-teal] font-mono">·</span>
                    <span className="text-sm font-bold text-[--hero-accent]" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.012em' }}>
                      {anchor.longestStreak}
                    </span>
                    <span className="text-[9px] text-[--hero-ink-muted-teal] font-mono">best</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {anchor.bestWeek && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[--hero-chip-island] border border-[--hero-chip-border]">
              <div className="w-1.5 h-1.5 rounded-sm flex-shrink-0 bg-[--hero-dot-warning]" />
              <div>
                <p className="text-[9px] font-bold tracking-widest font-mono uppercase text-[--hero-ink-muted-teal]">Best week</p>
                <p className="text-xs font-bold text-[--hero-ink] mt-0.5" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.012em' }}>
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
            <div key={c.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[--hero-chip-island] border border-[--hero-chip-border]">
              <div className={`w-1.5 h-1.5 rounded-sm flex-shrink-0 ${c.warn ? 'bg-[--hero-dot-warning]' : 'bg-[--hero-dot-success]'}`} />
              <div>
                <p className="text-[9px] font-bold tracking-widest font-mono uppercase text-[--hero-ink-muted-teal]">{c.label}</p>
                <p className="text-xs font-bold text-[--hero-ink] mt-0.5" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.012em' }}>
                  {c.val}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  // @@hero-pane-end
}

// ── YearHeatmap ───────────────────────────────────────────────────────────────
function YearHeatmap({ submissions, year, weeklyTarget, bestWeekWs, awardWeekSet, streakWeekSet, longestStreak }) {
  const sundays = useMemo(() => generateYearSundays(year), [year]);
  const currentWs = useMemo(() => currentWeekStarting(), []);

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
    if (mo !== lastMonth) { monthLabels.push({ i, label: MONTH_ABBR[parseInt(mo, 10) - 1] }); lastMonth = mo; }
  });

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <p className="text-xs font-bold tracking-widest font-mono uppercase text-ink-muted">Year at a glance · {year}</p>
        <p className="text-[10px] text-ink-muted font-mono">Target {fmtTtdFull(weeklyTarget)}/wk</p>
      </div>

      {/* Month labels */}
      <div className="relative h-4 mb-1">
        {monthLabels.map(({ i, label }) => (
          <span key={`${label}-${i}`} className="absolute text-[9px] font-bold text-ink-muted font-mono tracking-widest" style={{ left: i * 20 }}>
            {label}
          </span>
        ))}
      </div>

      {/* Squares */}
      <div className="flex flex-wrap gap-[3px]" style={{ width: '100%' }}>
        {sundays.map((ws) => {
          const s = byWeekStart[ws];
          const st = s ? deriveStatus(s) : null;
          const isBest = ws === bestWeekWs;
          const isAward = awardWeekSet.has(ws);
          const isStreak = streakWeekSet.has(ws);
          const isCurrent = ws === currentWs;
          const titleBits = s
            ? `${ws} · ${fmtTtdFull(getSubmissionAPI(s))} · ${st}`
            : `${ws} · no submission`;
          const enrich = [
            isBest ? 'best week' : null,
            isAward ? 'award-eligible' : null,
            isStreak ? 'longest streak' : null,
            isCurrent ? 'current week' : null,
          ].filter(Boolean).join(' · ');
          return (
            <div
              key={ws}
              title={enrich ? `${titleBits} · ${enrich}` : titleBits}
              style={{
                width: 17, height: 17, flexShrink: 0, position: 'relative',
                boxShadow: isStreak ? 'inset 0 -3px 0 0 var(--color-primary)' : undefined,
              }}
              className={[
                'rounded-sm', colorClass(s),
                st === 'unlocked' ? 'border border-warning' : st === 'draft' ? 'border border-dashed border-border' : '',
                isBest ? 'outline outline-2 outline-gold outline-offset-1' : '',
                isCurrent ? 'ring-2 ring-primary animate-pulse motion-reduce:animate-none' : '',
              ].filter(Boolean).join(' ')}
            >
              {isAward && (
                <span aria-hidden="true" className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-gold" />
              )}
            </div>
          );
        })}
      </div>

      {longestStreak >= 2 && (
        <p className="text-[10px] font-bold text-ink-muted font-mono tracking-wide mt-2">
          <span className="text-primary">▬</span> Longest streak · {longestStreak} consecutive weeks
        </p>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {[
          { bg: 'bg-primary/20', label: '< 60%' },
          { bg: 'bg-primary/50', label: '60–100%' },
          { bg: 'bg-primary',    label: '≥ 100%' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-sm ${l.bg}`} />
            <span className="text-[9px] text-ink-muted font-mono tracking-wide">{l.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-surface-muted border border-dashed border-border" />
          <span className="text-[9px] text-ink-muted font-mono tracking-wide">DRAFT</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-warning/25 border border-warning" />
          <span className="text-[9px] text-ink-muted font-mono tracking-wide">UNLOCKED</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-surface-muted outline outline-2 outline-gold outline-offset-1" />
          <span className="text-[9px] text-ink-muted font-mono tracking-wide">BEST</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative w-2 h-2 rounded-sm bg-primary/40">
            <span aria-hidden="true" className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-gold" />
          </div>
          <span className="text-[9px] text-ink-muted font-mono tracking-wide">AWARD</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-primary/40 ring-2 ring-primary" />
          <span className="text-[9px] text-ink-muted font-mono tracking-wide">THIS WK</span>
        </div>
      </div>
    </div>
  );
}

// ── HistoryFilterRow ──────────────────────────────────────────────────────────
function HistoryFilterRow({
  activeFilter, setFilter, counts,
  year, setYear, years,
  month, setMonth,
  awardOnly, setAwardOnly,
  search, setSearch,
}) {
  const tabs = [
    { key: 'all',       label: 'All weeks', count: counts.all },
    { key: 'submitted', label: 'Submitted', count: counts.submitted },
    { key: 'draft',     label: 'Draft',     count: counts.draft },
    { key: 'unlocked',  label: 'Unlocked',  count: counts.unlocked },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 flex-1">
      {/* Status segmented */}
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
              <span className={`text-[10px] font-bold px-1.5 rounded-full font-mono ${activeFilter === t.key ? 'bg-primary/15 text-primary' : 'text-ink-muted'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Year dropdown */}
      <select
        aria-label="Filter by year"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="min-h-[44px] px-3 rounded-lg border border-border bg-card text-xs font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>

      {/* Month dropdown */}
      <select
        aria-label="Filter by month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        className="min-h-[44px] px-3 rounded-lg border border-border bg-card text-xs font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <option value="all">All months</option>
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>
        ))}
      </select>

      {/* Award-weeks toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={awardOnly}
        onClick={() => setAwardOnly(v => !v)}
        className={`inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          awardOnly
            ? 'bg-gold/15 border-gold/50 text-gold-ink'
            : 'bg-card border-border text-ink-muted hover:text-ink'
        }`}
      >
        <Star size={13} className={awardOnly ? 'fill-gold text-gold' : ''} aria-hidden="true" />
        Award weeks
      </button>

      {/* Search */}
      <div className="flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-border bg-card flex-1 min-w-[160px] focus-within:ring-2 focus-within:ring-primary">
        <Search size={13} className="text-ink-muted shrink-0" aria-hidden="true" />
        <input
          type="text"
          aria-label="Search notes and goals"
          placeholder="Search notes, goals…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 bg-transparent outline-none text-xs text-ink placeholder:text-ink-muted"
        />
      </div>
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
function WeekCard({ s, prevS, sparkValues, isBest, isAward, onClick }) {
  const st       = deriveStatus(s);
  const isDraft  = st === 'draft';
  const isUnlocked = st === 'unlocked';
  const api      = getSubmissionAPI(s);
  const fields   = extractFields(s);
  const apps     = fields.applicationsSold ?? 0;
  const cis      = parseInt(s.ciConducted) || 0;
  const dials    = dialsSum(s);
  const note     = submissionNote(s);
  const prevApi  = prevS ? getSubmissionAPI(prevS) : null;
  const apiDelta = prevApi !== null ? api - prevApi : null;
  const prevApps = prevS ? (extractFields(prevS).applicationsSold ?? 0) : null;
  const appsDelta= prevApps !== null ? apps - prevApps : null;
  const overall  = parseInt(s.overallRating || s.ratingOverall) || 0;

  const statusBg = isUnlocked ? 'bg-warning/15 text-warning-ink' : isDraft ? 'bg-warning/15 text-warning-ink' : 'bg-success/15 text-success-ink';
  const statusLabel = isUnlocked ? 'Unlocked' : isDraft ? 'Draft' : 'Submitted';

  const borderColor = isUnlocked ? 'border-warning/30' : 'border-border';

  return (
    <button
      onClick={onClick}
      aria-label={`Open submission from ${weekLabel(s)}`}
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
              <span className="text-xs text-ink-muted font-mono">{s.weekStarting}</span>
            )}
            {isBest && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest font-mono bg-gold/15 text-gold-ink">
                ★ BEST WEEK
              </span>
            )}
            {isAward && !isBest && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest font-mono bg-gold/15 text-gold-ink">
                AWARD-ELIGIBLE
              </span>
            )}
          </div>
          {note && (
            <p className="text-xs text-ink-muted mt-1 italic line-clamp-1">“{note}”</p>
          )}
          {isUnlocked && s.unlockedByName && (
            <p className="text-xs text-warning-ink mt-0.5 font-mono tracking-wide">
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
          { label: 'API',   value: `TTD ${fmtTtdShort(api)}`,  delta: apiDelta !== null ? Math.round(apiDelta / 100) : null, deltaLabel: apiDelta ? fmtTtdShort(Math.abs(apiDelta)) : null },
          { label: 'APPS',  value: apps,                         delta: appsDelta,  deltaLabel: appsDelta ? Math.abs(appsDelta) : null },
          { label: 'CIs',   value: cis,                          delta: null },
          { label: 'DIALS', value: dials,                        delta: null },
        ].map((k, i) => (
          <div key={i} className="p-2 rounded-lg bg-surface-muted border border-border/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-ink-muted font-mono tracking-widest">{k.label}</span>
              {k.delta !== null && k.delta !== 0 && (
                <span className={`text-[8px] font-bold font-mono px-1 rounded-sm ${k.delta > 0 ? 'bg-success/15 text-success-ink' : 'bg-warning/15 text-warning-ink'}`}>
                  {k.delta > 0 ? '▲' : '▼'} {k.deltaLabel}
                </span>
              )}
            </div>
            <span className="text-base font-bold text-ink leading-none" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}>
              {k.value}
            </span>
          </div>
        ))}
      </div>

      {/* Footer — spark + rating + action */}
      <div className="flex items-center gap-3 flex-wrap">
        {sparkValues && sparkValues.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-ink-muted font-mono tracking-widest">5-WK API</span>
            <MiniSpark values={sparkValues} current={api} />
          </div>
        )}
        {overall > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-ink-muted font-mono tracking-widest">RATING</span>
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

// ── HistoryDrillDrawer ────────────────────────────────────────────────────────
// History-scoped action drawer. Replaces the generic SubmissionViewer for the
// History surface (SubmissionViewer stays as-is for MasterSheet/Compliance).
// §4 dialog contract via useFocusTrap. Status-driven footer CTA:
//   submitted → Download PDF · draft → Continue editing · unlocked → Edit & resubmit
function DrillRow({ label, value, big = false }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 ${big ? 'bg-primary/10' : ''}`}>
      <span className={`text-xs ${big ? 'text-ink font-bold' : 'text-ink-muted'}`}>{label}</span>
      <span className={`font-bold ${big ? 'text-sm text-primary' : 'text-xs text-ink'}`} style={big ? { fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.012em' } : undefined}>
        {value}
      </span>
    </div>
  );
}

function DrillSection({ eyebrow, rows }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] font-bold tracking-widest font-mono uppercase text-ink-muted mb-2">{eyebrow}</p>
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {rows.map((r, i) => <DrillRow key={i} label={r.label} value={r.value} big={r.big} />)}
      </div>
    </div>
  );
}

function HistoryDrillDrawer({ s, prevS, onClose, onEditWeek, onDownload }) {
  const drawerRef = useFocusTrap({ onEscape: onClose });
  if (!s) return null;

  const st = deriveStatus(s);
  const isDraft = st === 'draft';
  const isUnlocked = st === 'unlocked';
  const isSubmitted = st === 'submitted';

  const f = extractFields(s);
  const prevF = prevS ? extractFields(prevS) : null;
  const api = getSubmissionAPI(s);
  const apps = f.applicationsSold ?? 0;
  const cis = f.ciConducted ?? 0;
  const dials = dialsSum(s);
  const note = submissionNote(s);
  const overall = f.overallRating || 0;

  const prevApi = prevS ? getSubmissionAPI(prevS) : null;
  const heroKpis = [
    { eye: 'API',   value: fmtTtdFull(api), delta: prevApi !== null ? api - prevApi : null, isCurrency: true, tone: 'text-primary' },
    { eye: 'APPS',  value: apps,            delta: prevF ? apps - (prevF.applicationsSold ?? 0) : null, tone: 'text-gold-ink' },
    { eye: 'CIs',   value: cis,             delta: prevF ? cis - (prevF.ciConducted ?? 0) : null, tone: 'text-ink' },
    { eye: 'DIALS', value: dials,           delta: prevS ? dials - dialsSum(prevS) : null, tone: 'text-ink' },
  ];

  const eyebrow = isUnlocked
    ? `UNLOCKED${s.unlockedByName ? ` BY ${s.unlockedByName.toUpperCase()}` : ''}`
    : isDraft ? 'DRAFT · NOT SUBMITTED' : 'SUBMITTED';
  const eyebrowColor = isSubmitted ? 'text-primary' : 'text-warning-ink';

  const avgPolicy = apps > 0 ? api / apps : 0;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/20" aria-hidden="true" onClick={onClose} />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-drill-title"
        className="fixed top-0 right-0 h-full z-50 w-full sm:w-[440px] max-w-full bg-card shadow-2xl flex flex-col"
      >
        {/* Close strip */}
        <div className="flex justify-end px-4 pt-4 shrink-0">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full border border-border bg-surface-muted text-xs font-bold text-ink hover:bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={14} aria-hidden="true" /> Close
          </button>
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-4 border-b border-border shrink-0">
          <p className={`text-[10px] font-bold tracking-widest font-mono uppercase ${eyebrowColor}`}>{eyebrow}</p>
          <h2 id="history-drill-title" className="text-xl font-bold text-ink mt-1" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}>
            {weekLabel(s)}
          </h2>
          {s.weekStarting && <p className="text-xs text-ink-muted font-mono mt-0.5">{s.weekStarting}</p>}
          {note && <p className="text-xs text-ink-muted italic mt-2 leading-relaxed">“{note}”</p>}

          {/* Hero KPI 2x2 with deltas */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {heroKpis.map((k, i) => (
              <div key={i} className="p-3 rounded-xl bg-surface-muted border border-border">
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-bold tracking-widest font-mono uppercase ${k.tone}`}>{k.eye}</span>
                  {k.delta !== null && k.delta !== 0 && (
                    <span className={`text-[8px] font-bold font-mono px-1 rounded-sm ${k.delta > 0 ? 'bg-success/15 text-success-ink' : 'bg-warning/15 text-warning-ink'}`}>
                      {k.delta > 0 ? '▲' : '▼'} {k.isCurrency ? fmtTtdShort(Math.abs(k.delta)) : Math.abs(k.delta)}
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-ink mt-1.5 leading-none" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.022em' }}>
                  {k.value}
                </p>
                <p className="text-[9px] text-ink-muted font-mono mt-1">vs prev week</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable sections */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <DrillSection eyebrow="Production" rows={[
            { label: 'New business apps', value: apps || '—' },
            { label: 'New business API',  value: api > 0 ? fmtTtdFull(api) : '—', big: true },
            { label: 'Lives sold',        value: (f.livesSold ?? 0) || '—' },
            { label: 'Avg policy size',   value: avgPolicy > 0 ? fmtTtdFull(avgPolicy) : '—' },
          ]} />
          <DrillSection eyebrow="Activity" rows={[
            { label: 'Total dials',        value: dials || '—' },
            { label: 'Referral calls',     value: (parseInt(s.referralCalls) || 0) || '—' },
            { label: 'Follow-up calls',    value: (parseInt(s.followUpCalls) || 0) || '—' },
            { label: 'Cold calls',         value: (parseInt(s.coldCalls) || 0) || '—' },
            { label: 'Seminar/tradeshow',  value: (parseInt(s.seminarTradeshowCalls) || 0) || '—' },
            { label: 'Service calls',      value: (parseInt(s.serviceCalls) || 0) || '—' },
            { label: 'Tel contacts',       value: (f.telContacts ?? 0) || '—' },
            { label: 'F2F contacts',       value: (f.f2fContacts ?? 0) || '—' },
          ]} />
          <DrillSection eyebrow="Interviews" rows={[
            { label: 'FFIs scheduled',  value: (f.ffisScheduled ?? 0) || '—' },
            { label: 'FFIs conducted',  value: (f.ffiConducted ?? 0) || '—' },
            { label: 'New CIs booked',  value: (f.newCIBooked ?? 0) || '—' },
            { label: 'Old CIs booked',  value: (f.oldCIBooked ?? 0) || '—' },
            { label: 'CIs conducted',   value: cis || '—' },
          ]} />
          {overall > 0 && (
            <DrillSection eyebrow="Reflection" rows={[
              { label: 'Planning',        value: f.planningEffectiveness ? `${f.planningEffectiveness}/10` : '—' },
              { label: 'Time management', value: f.timeManagement ? `${f.timeManagement}/10` : '—' },
              { label: 'Sales',           value: f.salesPerformance ? `${f.salesPerformance}/10` : '—' },
              { label: 'Prospecting',     value: f.prospectingEffort ? `${f.prospectingEffort}/10` : '—' },
              { label: 'Overall',         value: `${overall}/10`, big: true },
            ]} />
          )}
          {(f.targetAPI > 0 || f.targetAppsSold > 0 || f.goalNotes) && (
            <DrillSection eyebrow="Next week goals set" rows={[
              { label: 'Target apps', value: (f.targetAppsSold ?? 0) || '—' },
              { label: 'Target API',  value: f.targetAPI > 0 ? fmtTtdFull(f.targetAPI) : '—', big: true },
              ...(f.goalNotes ? [{ label: 'Goal notes', value: f.goalNotes }] : []),
            ]} />
          )}
        </div>

        {/* Status-driven footer CTA */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border bg-surface-muted shrink-0" data-testid="history-drill-footer">
          {isSubmitted && (
            <>
              <p className="text-xs text-ink-muted leading-snug">Locked record · download a copy</p>
              {onDownload && (
                <button
                  type="button"
                  onClick={() => { onDownload(); onClose(); }}
                  data-testid="drill-cta-download"
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-bold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Download size={15} aria-hidden="true" /> Download PDF
                </button>
              )}
            </>
          )}
          {isDraft && (
            <>
              <p className="text-xs text-ink-muted leading-snug">Draft saved · resume any time</p>
              {onEditWeek && (
                <button
                  type="button"
                  onClick={() => { onEditWeek(s.weekStarting, s); onClose(); }}
                  data-testid="drill-cta-edit"
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-bold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Continue editing <ArrowRight size={15} aria-hidden="true" />
                </button>
              )}
            </>
          )}
          {isUnlocked && (
            <>
              <p className="text-xs text-warning-ink leading-snug">Manager unlocked this week · update &amp; resubmit</p>
              {onEditWeek && (
                <button
                  type="button"
                  onClick={() => { onEditWeek(s.weekStarting, s); onClose(); }}
                  data-testid="drill-cta-edit"
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-warning text-white text-sm font-bold hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
                >
                  Edit &amp; resubmit <ArrowRight size={15} aria-hidden="true" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── HistoryTab (default export) ───────────────────────────────────────────────
export default function HistoryTab({ submissions, loading, onDownload, generating, weeklyTarget = 4800, onStartReport, onEditWeek }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMonth, setFilterMonth]   = useState('all');
  const [awardOnly, setAwardOnly]       = useState(false);
  const [search, setSearch]             = useState('');
  const [drillSub, setDrillSub]         = useState(null);

  const thisYear = new Date().getFullYear();

  // Years available from the loaded submissions (desc), always including this year.
  const years = useMemo(() => {
    const set = new Set([thisYear]);
    for (const s of submissions ?? []) {
      const y = parseInt(s.weekStarting?.slice(0, 4), 10);
      if (y) set.add(y);
    }
    return [...set].sort((a, b) => b - a);
  }, [submissions, thisYear]);

  const [filterYear, setFilterYear] = useState(thisYear);

  const anchor = useMemo(
    () => computeAnchor(submissions ?? [], filterYear, weeklyTarget),
    [submissions, filterYear, weeklyTarget]
  );

  // Sort submissions by weekStarting descending (most recent first)
  const sorted = useMemo(
    () => [...(submissions ?? [])].sort((a, b) => (b.weekStarting ?? '').localeCompare(a.weekStarting ?? '')),
    [submissions]
  );

  // Best-week / award-week / streak-week derivations for the SELECTED year.
  const yearSubs = useMemo(
    () => sorted.filter(s => s.weekStarting?.startsWith(String(filterYear))),
    [sorted, filterYear]
  );
  const bestWeekWs = useMemo(() => {
    const submitted = yearSubs.filter(s => s.status === 'submitted' && !s.unlockedBy);
    if (submitted.length === 0) return null;
    const best = submitted.reduce((a, b) => getSubmissionAPI(b) > getSubmissionAPI(a) ? b : a, submitted[0]);
    return getSubmissionAPI(best) > 0 ? best.weekStarting : null;
  }, [yearSubs]);
  const awardWeekSet = useMemo(
    () => new Set(yearSubs.filter(s => isAwardWeek(s, weeklyTarget)).map(s => s.weekStarting)),
    [yearSubs, weeklyTarget]
  );
  const streakWeekSet = useMemo(
    () => new Set(longestStreakWeeks(submissions ?? [], filterYear)),
    [submissions, filterYear]
  );

  // Base scope (year + month + award + search) — status counts computed on top.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter(s => {
      if (!s.weekStarting?.startsWith(String(filterYear))) return false;
      if (filterMonth !== 'all' && s.weekStarting.slice(5, 7) !== filterMonth) return false;
      if (awardOnly && !isAwardWeek(s, weeklyTarget)) return false;
      if (q) {
        const hay = `${submissionNote(s)} ${extractFields(s).goalNotes || ''} ${s.weekStarting} ${weekLabel(s)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, filterYear, filterMonth, awardOnly, search, weeklyTarget]);

  const counts = useMemo(() => ({
    all: scoped.length,
    submitted: scoped.filter(s => s.status === 'submitted' && !s.unlockedBy).length,
    draft: scoped.filter(s => s.status !== 'submitted' && !s.unlockedBy).length,
    unlocked: scoped.filter(s => !!s.unlockedBy).length,
  }), [scoped]);

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return scoped;
    if (filterStatus === 'unlocked') return scoped.filter(s => !!s.unlockedBy);
    if (filterStatus === 'submitted') return scoped.filter(s => s.status === 'submitted' && !s.unlockedBy);
    return scoped.filter(s => s.status !== 'submitted' && !s.unlockedBy);
  }, [scoped, filterStatus]);

  // Build prevS map — immediately previous submission by weekStarting
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
      <div className="card text-center py-12 flex flex-col items-center gap-3" data-testid="history-empty-state">
        <div className="p-3 rounded-full bg-primary/10 text-primary">
          <FileClock size={28} aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">No submissions yet</p>
          <p className="text-sm text-ink-muted mt-0.5">Your weekly reports will show up here once you submit your first one.</p>
        </div>
        {onStartReport && (
          <button
            type="button"
            onClick={onStartReport}
            className="min-h-[44px] mt-1 inline-flex items-center gap-2 px-4 rounded-lg bg-primary dark:bg-primary-dark text-white text-sm font-semibold hover:bg-primary/90 dark:hover:bg-primary-dark/90 transition-colors"
          >
            <Plus size={16} aria-hidden="true" />
            Log your first report
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Anchor strip */}
      <HistoryAnchorStrip anchor={anchor} year={filterYear} weeklyTarget={weeklyTarget} />

      {/* Heatmap */}
      <YearHeatmap
        submissions={yearSubs}
        year={filterYear}
        weeklyTarget={weeklyTarget}
        bestWeekWs={bestWeekWs}
        awardWeekSet={awardWeekSet}
        streakWeekSet={streakWeekSet}
        longestStreak={anchor.longestStreak}
      />

      {/* Filter + download row */}
      <div className="flex items-start gap-2 flex-wrap">
        <HistoryFilterRow
          activeFilter={filterStatus}
          setFilter={setFilterStatus}
          counts={counts}
          year={filterYear}
          setYear={setFilterYear}
          years={years}
          month={filterMonth}
          setMonth={setFilterMonth}
          awardOnly={awardOnly}
          setAwardOnly={setAwardOnly}
          search={search}
          setSearch={setSearch}
        />
        <button
          onClick={onDownload}
          disabled={generating}
          className="flex items-center gap-2 min-h-[44px] px-4 rounded-lg border border-primary text-primary text-xs font-bold hover:bg-primary/5 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {generating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          {generating ? 'Generating…' : 'Download report'}
        </button>
      </div>

      {/* Week cards */}
      {filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-sm text-ink-muted">No matching submissions.</p>
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
                isBest={s.weekStarting === bestWeekWs}
                isAward={awardWeekSet.has(s.weekStarting)}
                onClick={() => setDrillSub(s)}
              />
            );
          })}
        </div>
      )}

      {/* Drill drawer */}
      {drillSub && (
        <HistoryDrillDrawer
          s={drillSub}
          prevS={prevSMap[drillSub.id ?? drillSub.weekStarting]}
          onClose={() => setDrillSub(null)}
          onEditWeek={onEditWeek}
          onDownload={onDownload}
        />
      )}
    </div>
  );
}
