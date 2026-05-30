import React, { useState, useEffect, useMemo } from 'react';
import { Pencil, X, Check, Lock, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { getGoals, setGoals, getCompanyMinimums } from '../../services/goalsService';
import { getMoneyNeeds } from '../../services/moneyNeedsService';
import { resolveAnnualAPIFloor, FLAT_ANNUAL_API_FALLBACK } from '../../utils/tenureFloors';
import { compute2YearAverageAPI } from '../../utils/careerLevelHelpers';
import { aggregatePersistency } from '../../lib/persistency/calculations';
import { useAuth } from '../../context/AuthContext';
import BadgeGrid from '../gamification/BadgeGrid';

const CAREER_LEVELS = [
  { level: 1, title: 'Salesperson',    minApi: 200000, minApps: 42, minPersistency: 90, minYears: 0  },
  { level: 2, title: 'Advisor II',     minApi: 250000, minApps: 42, minPersistency: 90, minYears: 2  },
  { level: 3, title: 'Advisor III',    minApi: 350000, minApps: 48, minPersistency: 90, minYears: 3  },
  { level: 4, title: 'Advisor IV',     minApi: 450000, minApps: 48, minPersistency: 90, minYears: 4  },
  { level: 5, title: 'Senior Advisor', minApi: 600000, minApps: 52, minPersistency: 90, minYears: 5  },
  { level: 6, title: 'Elite Advisor',  minApi: 800000, minApps: 52, minPersistency: 90, minYears: 6  },
  { level: 7, title: 'Legend',         minApi: null,   minApps: null, minPersistency: null, minYears: 10 },
];

const LEVEL_TAGLINES = {
  1: 'Where every journey starts.',
  2: 'Earned consistency — the first tier reward.',
  3: 'Repeatable production — referrals open up.',
  4: 'Senior tier of the producing ranks.',
  5: 'Industry recognition — advisor seniority.',
  6: 'Elite producer — top-tier rewards.',
  7: "Chairman's recognition — the pinnacle.",
};

const UNLOCK_COPY = {
  2: [{ label: 'Higher commission rate',   detail: 'Tier 2 schedule' },
      { label: '"Advisor II" title',        detail: 'Official designation' },
      { label: 'Advanced training modules', detail: 'Onboarded access' }],
  3: [{ label: 'Elevated commission tier',   detail: 'Tier 3 schedule' },
      { label: '"Advisor III" designation',  detail: 'Official designation' },
      { label: 'Priority client referrals',  detail: 'Branch-routed leads' }],
  4: [{ label: 'Senior commission tier',   detail: 'Tier 4 schedule' },
      { label: '"Advisor IV" + cards',      detail: 'Title + business cards' },
      { label: 'Mentorship eligibility',    detail: 'Bring on a junior' }],
  5: [{ label: 'Senior Advisor recognition', detail: 'Industry standing' },
      { label: 'Dedicated branch support',   detail: 'Direct BM channel' },
      { label: 'Quarterly bonus eligibility',detail: 'TTD 8K–25K per quarter' },
      { label: 'Conference seat',            detail: 'Annual leadership event' }],
  6: [{ label: '"Elite Advisor" title',   detail: 'Top of the producing ranks' },
      { label: 'Top-tier commission',      detail: 'Maximum schedule' },
      { label: 'Conference + retreat',     detail: 'Annual incentive trip' }],
  7: [{ label: '"Legend" designation',    detail: "Chairman's recognition" },
      { label: 'Lifetime acknowledgement', detail: 'Hall of fame' },
      { label: 'Legacy portfolio',         detail: 'Senior advisor lineage' }],
};

const CAREER_PORTAL_YEAR = new Date().getFullYear();

// ── Helpers ─────────────────────────────────────────────────────────────────
function getLevelState(level, currentLevel) {
  if (level < currentLevel) return 'achieved';
  if (level === currentLevel) return 'current';
  return 'locked';
}

function computeQuarterlyAPI(submissions) {
  // Returns up to 8 quarterly API totals (oldest first)
  const byQuarterKey = {};
  for (const s of (submissions ?? [])) {
    if (s.status !== 'submitted' || !s.weekStarting) continue;
    const d = new Date(s.weekStarting + 'T12:00:00Z');
    const y = d.getUTCFullYear();
    const q = Math.floor(d.getUTCMonth() / 3);
    const key = `${y}-Q${q}`;
    byQuarterKey[key] = (byQuarterKey[key] || 0) + (parseFloat(s.apiSold) || 0);
  }
  const sorted = Object.entries(byQuarterKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([, v]) => Math.round(v / 1000)); // TTD thousands
  // Pad to 8 if fewer
  while (sorted.length < 8) sorted.unshift(0);
  return sorted;
}

function weeksSubmittedThisYear(submissions, year) {
  return (submissions ?? []).filter(
    s => s.status === 'submitted' && s.weekStarting?.startsWith(String(year))
  ).length;
}

function estimateWeeksToNextLevel(ytdAPI, nextLevelApi, weeklyPace) {
  if (!nextLevelApi) return null;
  if (ytdAPI >= nextLevelApi) return 'You qualify!';
  if (!weeklyPace || weeklyPace <= 0) return null;
  const remaining = nextLevelApi - ytdAPI;
  const weeks = Math.ceil(remaining / weeklyPace);
  if (weeks <= 4) return `about ${weeks} week${weeks === 1 ? '' : 's'}`;
  const months = Math.round(weeks / 4.33);
  return `about ${months} month${months === 1 ? '' : 's'}`;
}

// ── LadderCoin — the 3D circular medal for a ladder node ────────────────────
function LadderCoin({ state, levelNum, size = 56 }) {
  const isAchieved = state === 'achieved';
  const isCurrent  = state === 'current';
  const isLocked   = state === 'locked';

  if (isLocked) {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: '50%',
          background: 'var(--color-surface-muted)',
          border: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: Math.round(size * 0.32),
          fontFamily: '"Cabinet Grotesk", system-ui, sans-serif',
          letterSpacing: '-0.02em',
          color: 'var(--color-text-faint)',
          flexShrink: 0, zIndex: 1, position: 'relative',
        }}
        aria-hidden="true"
      >
        {levelNum}
        {/* Lock badge */}
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 22, height: 22, borderRadius: '50%',
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={10} style={{ color: 'var(--color-text-muted)' }} />
        </span>
      </div>
    );
  }

  const gradient = isAchieved
    ? 'radial-gradient(circle at 32% 28%, var(--color-primary-light) 0%, var(--color-primary) 50%, var(--color-primary-dark) 100%)'
    : 'radial-gradient(circle at 32% 28%, var(--color-medal-1-light) 0%, var(--color-medal-1-mid) 50%, var(--color-medal-1-deep) 100%)';

  const boxShadow = isCurrent
    ? '0 0 0 4px var(--color-gold-tint), 0 0 20px rgba(245,158,11,0.35), inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.42)'
    : 'inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.42), 0 2px 8px rgba(0,0,0,0.08)';

  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: gradient,
        boxShadow,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, zIndex: 1, position: 'relative',
      }}
      aria-hidden="true"
    >
      {isAchieved ? (
        <svg width={Math.round(size * 0.38)} height={Math.round(size * 0.38)} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <span style={{
          fontWeight: 800, fontSize: Math.round(size * 0.32),
          fontFamily: '"Cabinet Grotesk", system-ui, sans-serif',
          letterSpacing: '-0.02em', color: 'white', lineHeight: 1,
        }}>{levelNum}</span>
      )}
      {/* Specular highlight */}
      <span style={{
        position: 'absolute', top: '12%', left: '20%', width: '36%', height: '20%',
        borderRadius: '50%', background: 'rgba(255,255,255,0.42)', filter: 'blur(2.5px)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

// ── LadderNode — one row in the vertical timeline ────────────────────────────
function LadderNode({ lvl, state, isLast, onClick }) {
  const isAchieved = state === 'achieved';
  const isCurrent  = state === 'current';
  const isLocked   = state === 'locked';

  const accentColor = isAchieved
    ? 'var(--color-primary)'
    : isCurrent
      ? 'var(--color-gold)'
      : 'var(--color-text-faint)';

  const fmtApi = lvl.minApi ? `TTD ${(lvl.minApi / 1000).toFixed(0)}K API` : 'Pinnacle';

  return (
    <div
      style={{ position: 'relative', display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 24 }}
    >
      {/* Connector line */}
      {!isLast && (
        <div style={{
          position: 'absolute', left: 27, top: 56, bottom: 4, width: 2,
          background: isAchieved ? 'var(--color-primary)' : 'transparent',
          borderLeft: !isAchieved ? '2px dashed var(--color-border)' : 'none',
        }} />
      )}

      {/* Coin */}
      {isLocked ? (
        <button
          onClick={onClick}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
          style={{ flexShrink: 0, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
          aria-label={`View Level ${lvl.level} — ${lvl.title} criteria`}
        >
          <LadderCoin state={state} levelNum={lvl.level} />
        </button>
      ) : (
        <LadderCoin state={state} levelNum={lvl.level} />
      )}

      {/* Content */}
      <div style={{ flex: 1, paddingTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
            color: accentColor, fontFamily: '"JetBrains Mono", monospace',
            textTransform: 'uppercase',
          }}>
            Level {lvl.level}
          </span>
          {isCurrent && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              padding: '2px 7px',
              background: 'var(--color-gold-tint)',
              color: 'var(--color-gold)',
              borderRadius: 999, fontFamily: '"JetBrains Mono", monospace',
              textTransform: 'uppercase',
            }}>
              You are here
            </span>
          )}
        </div>
        <p style={{
          fontSize: 17, fontWeight: 700,
          color: 'var(--color-text)',
          fontFamily: '"Cabinet Grotesk", system-ui, sans-serif',
          letterSpacing: '-0.012em', margin: 0,
        }}>
          {lvl.title}
        </p>
        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.4 }}>
          {isAchieved && 'Achieved'}
          {isCurrent && 'Your current level'}
          {isLocked && `${fmtApi} · ${lvl.minYears}+ yrs of service`}
        </p>
        {isLocked && (
          <button
            onClick={onClick}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            style={{
              marginTop: 6, fontSize: 11, fontWeight: 700,
              color: 'var(--color-text-muted)',
              background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              minHeight: 24,
            }}
            aria-label={`View Level ${lvl.level} — ${lvl.title} criteria`}
          >
            View criteria <ChevronRight size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── CareerLadder — all 7 nodes ────────────────────────────────────────────────
function CareerLadder({ currentLevel, onLevelClick }) {
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-5">
        <p className="text-xs font-bold tracking-widest text-ink-faint font-mono uppercase">Your career ladder</p>
        <p className="text-xs text-ink-faint font-mono">{currentLevel} of {CAREER_LEVELS.length} levels</p>
      </div>
      <div>
        {CAREER_LEVELS.map((lvl, i) => (
          <LadderNode
            key={lvl.level}
            lvl={lvl}
            state={getLevelState(lvl.level, currentLevel)}
            isLast={i === CAREER_LEVELS.length - 1}
            onClick={() => onLevelClick(lvl.level)}
          />
        ))}
      </div>
    </div>
  );
}

// ── TimeToNextCard ────────────────────────────────────────────────────────────
function TimeToNextCard({ currentLevel, estimate, weeklyPace }) {
  const nextLevel = CAREER_LEVELS.find(l => l.level === currentLevel + 1);
  if (!nextLevel) return null;
  return (
    <div className="card p-5 relative overflow-hidden" style={{ border: '1px solid rgba(1,105,111,0.25)' }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 200, height: 200,
        background: 'radial-gradient(circle, var(--color-primary-tint) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative' }}>
        <p className="text-xs font-bold tracking-widest text-ink-faint font-mono uppercase mb-1.5">Next milestone</p>
        <p className="text-base font-bold text-ink" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.012em' }}>
          Level {nextLevel.level} — {nextLevel.title}
        </p>
        {estimate ? (
          <>
            <p className="text-3xl font-bold text-primary mt-3" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.025em', lineHeight: 1 }}>
              {estimate}
            </p>
            {weeklyPace > 0 && (
              <p className="text-xs text-ink-muted mt-1.5">
                At your current pace of {formatCurrency(weeklyPace)}/week
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-ink-muted mt-3">Submit weekly reports to see your estimate.</p>
        )}
      </div>
    </div>
  );
}

// ── TrajectoryCard — quarterly bar chart ─────────────────────────────────────
function TrajectoryCard({ submissions }) {
  const quarters = useMemo(() => computeQuarterlyAPI(submissions), [submissions]);
  const maxQ = Math.max(...quarters, 1);
  const hasData = quarters.some(v => v > 0);

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold tracking-widest text-ink-faint font-mono uppercase">Trajectory · 8 quarters</p>
        {hasData && (
          <p className="text-xs font-mono text-success font-bold">↗ Growth trend</p>
        )}
      </div>
      {hasData ? (
        <>
          <div className="flex items-end gap-1.5 mt-3.5" style={{ height: 56 }}>
            {quarters.map((v, i) => {
              const h = Math.max(3, (v / maxQ) * 52);
              const isLatest = i === quarters.length - 1;
              const isRecent = i >= quarters.length - 2;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end">
                  <div
                    style={{
                      width: '100%', height: h,
                      background: isLatest
                        ? 'var(--color-primary-light)'
                        : isRecent
                          ? 'var(--color-primary)'
                          : 'var(--color-border)',
                      borderRadius: 3,
                    }}
                    title={`${v}K TTD`}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-xs text-ink-faint font-mono mt-2 tracking-wide">Quarterly API · TTD thousands</p>
        </>
      ) : (
        <p className="text-xs text-ink-muted mt-4 text-center py-4">Submit reports to see your trajectory.</p>
      )}
    </div>
  );
}

// ── CommitmentScorecard — one metric card with step-bar ──────────────────────
function CommitmentScorecard({ label, mine, managerTarget, floor, formatVal }) {
  if (!mine && mine !== 0) {
    return (
      <div className="card p-4 flex flex-col gap-2">
        <p className="text-xs font-bold tracking-widest text-ink-faint font-mono uppercase">{label}</p>
        <p className="text-sm text-ink-muted">—</p>
      </div>
    );
  }

  const max = Math.max(mine, managerTarget || 0, floor || 0) * 1.08 || 1;
  const fillPct = Math.min(100, (mine / max) * 100);
  const floorPct = floor ? Math.min(100, (floor / max) * 100) : 0;
  const targetPct = managerTarget ? Math.min(100, (managerTarget / max) * 100) : 0;

  const fillColor = mine >= (managerTarget || 0) && managerTarget > 0
    ? 'var(--color-success)'
    : mine >= (floor || 0)
      ? 'var(--color-warning)'
      : 'var(--color-danger)';

  return (
    <div className="card p-4 flex flex-col gap-2">
      <p className="text-xs font-bold tracking-widest text-ink-faint font-mono uppercase">{label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <span style={{
          fontSize: 22, fontWeight: 700, color: fillColor,
          fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em', lineHeight: 1,
        }}>
          {formatVal(mine)}
        </span>
        <span className="text-xs text-ink-faint font-mono uppercase tracking-wide">My commitment</span>
      </div>

      {/* Step bar with floor + target markers */}
      <div className="relative" style={{ height: 20 }}>
        {/* Track */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 8, height: 4,
          background: 'var(--color-surface-muted)', borderRadius: 999,
        }} />
        {/* Fill */}
        <div style={{
          position: 'absolute', left: 0, top: 8, height: 4,
          width: `${fillPct}%`,
          background: fillColor, borderRadius: 999,
        }} />
        {/* Floor marker */}
        {floorPct > 0 && (
          <div style={{
            position: 'absolute', left: `${floorPct}%`, top: 5,
            width: 1.5, height: 10, background: 'var(--color-text-faint)',
          }} />
        )}
        {/* Manager target marker */}
        {targetPct > 0 && (
          <div style={{
            position: 'absolute', left: `${targetPct}%`, top: 3,
            width: 2, height: 14, background: 'var(--color-text)',
          }} />
        )}
      </div>

      <div className="flex justify-between text-[9.5px] text-ink-faint font-mono tracking-wide">
        {floor > 0 && <span>FLOOR · {formatVal(floor)}</span>}
        {managerTarget > 0 && <span>TARGET · {formatVal(managerTarget)}</span>}
      </div>
    </div>
  );
}

// ── LevelDrillDrawer — slide-in panel for locked levels ─────────────────────
function LevelDrillDrawer({ level, currentLevel, ytdAPI, ytdApps, avgPersistency, yearsOfService, trailing2YrAPI, weeklyPace, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const lvl = CAREER_LEVELS.find(l => l.level === level);
  if (!lvl) return null;

  const isNext = level === currentLevel + 1;
  const tagline = LEVEL_TAGLINES[level] || '';
  const unlocks = UNLOCK_COPY[level] || [];
  const estimate = isNext ? estimateWeeksToNextLevel(ytdAPI, lvl.minApi, weeklyPace) : null;

  const criteria = [];
  if (lvl.minApi !== null)          criteria.push({ label: '2-yr Avg API', current: trailing2YrAPI, target: lvl.minApi, fmt: 'currency' });
  if (lvl.minApps !== null)         criteria.push({ label: 'YTD Applications', current: ytdApps, target: lvl.minApps, fmt: 'count' });
  if (lvl.minPersistency !== null)  criteria.push({ label: 'Persistency rate', current: avgPersistency ?? 0, target: lvl.minPersistency, fmt: 'percent' });
  if (lvl.minYears > 0)             criteria.push({ label: 'Years of service', current: yearsOfService ?? 0, target: lvl.minYears, fmt: 'years' });

  const fmtV = (v, kind) => {
    if (kind === 'currency') return v >= 1000 ? `TTD ${(v / 1000).toFixed(0)}K` : `TTD ${Math.round(v)}`;
    if (kind === 'percent')  return `${Math.round(v)}%`;
    if (kind === 'years')    return `${v.toFixed(1)} yrs`;
    return String(Math.round(v));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30"
        style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Level ${lvl.level} — ${lvl.title} criteria`}
        className="fixed top-0 right-0 bottom-0 z-40 flex flex-col bg-card"
        style={{ width: '100%', maxWidth: 460, borderLeft: '1px solid var(--color-border)', boxShadow: '-12px 0 32px rgba(0,0,0,0.12)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 min-h-[36px] rounded-full border border-border text-sm font-bold text-ink bg-surface hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close drawer"
        >
          <X size={13} />
          Close
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <p className="text-xs font-bold tracking-widest font-mono uppercase" style={{ color: isNext ? 'var(--color-gold)' : 'var(--color-primary)' }}>
            {isNext ? '★ Next milestone' : 'Future level'}
          </p>
          <p className="text-xl font-bold text-ink mt-1.5" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}>
            Level {lvl.level} — {lvl.title}
          </p>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">{tagline}</p>

          {isNext && estimate && (
            <div className="mt-3.5 p-3 rounded-xl" style={{ background: 'var(--color-primary-tint)', border: '1px solid rgba(1,105,111,0.2)' }}>
              <p className="text-xs font-bold tracking-widest text-primary font-mono uppercase">Estimated arrival</p>
              <p className="text-lg font-bold text-ink mt-1" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.012em' }}>{estimate}</p>
              {weeklyPace > 0 && (
                <p className="text-xs text-ink-muted mt-1">At your current pace · {formatCurrency(weeklyPace)}/week</p>
              )}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs font-bold tracking-widest text-ink-faint font-mono uppercase mb-2.5">
            Criteria · {criteria.length} to clear
          </p>
          <div className="flex flex-col gap-2.5">
            {criteria.map((c, i) => {
              const pct = c.target > 0 ? Math.min(100, Math.round((c.current / c.target) * 100)) : 0;
              const met = c.current >= c.target;
              return (
                <div key={i} className="p-3 rounded-xl border border-border">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      background: met ? 'var(--color-success)' : 'transparent',
                      border: met ? 'none' : '1.5px solid var(--color-warning)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {met && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <p className="flex-1 text-xs font-semibold text-ink">{c.label}</p>
                    <p className="text-xs font-bold font-mono" style={{ color: met ? 'var(--color-success)' : 'var(--color-warning)' }}>{pct}%</p>
                  </div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-mono text-ink-muted">{fmtV(c.current, c.fmt)}</span>
                    <span className="text-xs font-mono text-ink-faint">{fmtV(c.target, c.fmt)}</span>
                  </div>
                  <div className="h-1 rounded-full" style={{ background: 'var(--color-surface-muted)' }}>
                    <div style={{
                      width: `${Math.min(pct, 100)}%`, height: '100%',
                      background: met ? 'var(--color-success)' : 'var(--color-warning)',
                      borderRadius: 999,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          {unlocks.length > 0 && (
            <>
              <p className="text-xs font-bold tracking-widest font-mono uppercase mt-5 mb-2.5" style={{ color: 'var(--color-gold)' }}>
                ★ What you unlock
              </p>
              <div className="flex flex-col gap-2">
                {unlocks.map((u, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: 'var(--color-gold-tint)', border: '1px solid rgba(176,125,26,0.2)' }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: 'radial-gradient(circle at 32% 28%, var(--color-medal-1-light) 0%, var(--color-medal-1-mid) 50%, var(--color-medal-1-deep) 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.4)',
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-ink">{u.label}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{u.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── GoalsSection — loads + edits goals, renders CommitmentScorecards ─────────
function GoalsSection() {
  const { user: authUser, userProfile, tenantId } = useAuth();
  const [goals, setGoalsState]         = useState(null);
  const [minimums, setMinimums]        = useState(null);
  const [editing, setEditing]          = useState(false);
  const [saving, setSaving]            = useState(false);
  const [saveError, setSaveError]      = useState('');
  const [moneyNeedsRequired, setMoneyNeedsRequired] = useState(0);
  const [showNudge, setShowNudge]      = useState(false);
  const [pendingDraft, setPendingDraft]= useState(null);
  const [draft, setDraft] = useState({
    personalAnnualAPI:         '',
    personalAnnualApps:        '',
    personalAnnualPersistency: '',
  });

  useEffect(() => {
    if (!authUser?.uid || !tenantId) return;
    Promise.all([
      getGoals(tenantId, authUser.uid).catch(() => null),
      getCompanyMinimums(tenantId).catch(() => ({ annualAPI: 200000, annualApps: 42, persistency: 90 })),
      getMoneyNeeds(tenantId, authUser.uid, CAREER_PORTAL_YEAR).catch(() => null),
    ]).then(([g, mins, mn]) => {
      setGoalsState(g);
      setMinimums(mins);
      setMoneyNeedsRequired(parseFloat(mn?.firstYearCommissionsRequired) || 0);
      setDraft({
        personalAnnualAPI:         g?.personalAnnualAPI         ?? '',
        personalAnnualApps:        g?.personalAnnualApps        ?? '',
        personalAnnualPersistency: g?.personalAnnualPersistency ?? '',
      });
    });
  }, [authUser?.uid, tenantId]);

  async function doSave(draftToSave) {
    setSaving(true); setSaveError('');
    try {
      const name = userProfile?.name ?? userProfile?.email ?? 'Agent';
      await setGoals(tenantId, authUser.uid, {
        personalAnnualAPI:         draftToSave.personalAnnualAPI,
        personalAnnualApps:        draftToSave.personalAnnualApps,
        personalAnnualPersistency: draftToSave.personalAnnualPersistency,
      }, authUser.uid, name);
      const updated = await getGoals(tenantId, authUser.uid);
      setGoalsState(updated);
      setEditing(false);
    } catch (e) {
      setSaveError(e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  const handleSave = async () => {
    if (!tenantId) return;
    const api = parseFloat(draft.personalAnnualAPI) || 0;
    if (moneyNeedsRequired > 0 && api < moneyNeedsRequired) {
      setPendingDraft({ ...draft }); setShowNudge(true); return;
    }
    await doSave(draft);
  };

  const mins  = minimums ?? { annualAPI: 200000, annualApps: 42, persistency: 90 };
  const resolvedAnnualAPIFloor = resolveAnnualAPIFloor({
    contractStartDate: userProfile?.contractStartDate ?? null,
    tenureApiFloors: mins.tenureApiFloors,
    fallback: FLAT_ANNUAL_API_FALLBACK,
  });
  const mgr  = { api: goals?.targetAnnualAPI ?? 0, apps: goals?.targetAnnualApps ?? 0, persistency: goals?.targetAnnualPersistency ?? 0 };
  const mine = { api: goals?.personalAnnualAPI ?? 0, apps: goals?.personalAnnualApps ?? 0, persistency: goals?.personalAnnualPersistency ?? 0 };

  return (
    <div className="flex flex-col gap-4">
      {/* Section header + edit toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold tracking-widest text-ink-faint font-mono uppercase">Your annual commitment</p>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 h-11 px-3 rounded-lg border border-border text-xs font-semibold text-ink-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Pencil size={11} /> Edit My Goals
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              onClick={() => { setEditing(false); setSaveError(''); }}
              className="flex items-center gap-1 h-11 px-3 rounded-lg border border-border text-xs font-semibold text-ink-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Cancel editing goals"
            >
              <X size={11} /> Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 h-11 px-3 rounded-lg bg-primary dark:bg-primary-dark text-white text-xs font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Check size={11} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        /* Edit form */
        <div className="card p-5 flex flex-col gap-4">
          {[
            { key: 'personalAnnualAPI',         label: 'Annual API (TTD)',    step: 1000 },
            { key: 'personalAnnualApps',        label: 'Annual Applications', step: 1 },
            { key: 'personalAnnualPersistency', label: 'Persistency %',       step: 1 },
          ].map(f => (
            <div key={f.key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-muted" htmlFor={`cp-${f.key}`}>{f.label}</label>
              <input
                id={`cp-${f.key}`}
                type="number"
                min={0}
                step={f.step}
                value={draft[f.key]}
                onChange={e => setDraft(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="input text-sm"
              />
            </div>
          ))}
          {saveError && (
            <p className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{saveError}</p>
          )}
        </div>
      ) : (
        /* CommitmentScorecards display */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CommitmentScorecard
            label="Annual API"
            mine={mine.api || null}
            managerTarget={mgr.api}
            floor={resolvedAnnualAPIFloor}
            formatVal={v => `TTD ${(v / 1000).toFixed(0)}K`}
          />
          <CommitmentScorecard
            label="Applications"
            mine={mine.apps || null}
            managerTarget={mgr.apps}
            floor={mins.annualApps}
            formatVal={v => String(Math.round(v))}
          />
          <CommitmentScorecard
            label="Persistency"
            mine={mine.persistency || null}
            managerTarget={mgr.persistency}
            floor={mins.persistency}
            formatVal={v => `${Math.round(v)}%`}
          />
        </div>
      )}

      {showNudge && pendingDraft && (
        <div className="rounded-xl border border-warning/40 bg-warning/8 px-4 py-3 flex flex-col gap-2">
          <p className="text-sm font-semibold text-ink">Commitment below Money Needs</p>
          <p className="text-xs text-ink-muted leading-relaxed">
            Your commitment ({formatCurrency(parseFloat(pendingDraft.personalAnnualAPI) || 0)}) is below
            your Money Needs requirement ({formatCurrency(moneyNeedsRequired)}). Save anyway?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setShowNudge(false); doSave(pendingDraft); setPendingDraft(null); }}
              disabled={saving}
              className="min-h-[44px] px-4 rounded-lg bg-warning text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              Yes, continue
            </button>
            <button type="button" onClick={() => { setShowNudge(false); setPendingDraft(null); }}
              className="min-h-[44px] px-4 rounded-lg border border-border text-xs font-semibold text-ink hover:bg-surface-muted transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CareerPortal({ submissions, user, persistencyData, ytdTotals: _ytdTotals }) {
  const [drawerLevel, setDrawerLevel] = useState(null);
  const thisYear = CAREER_PORTAL_YEAR;

  const { ytdAPI, ytdApps, avgPersistency, yearsOfService, trailing2YrAPI, weeklyPace } = useMemo(() => {
    const ytdSubs = (submissions ?? []).filter(
      s => s.status === 'submitted' && s.weekStarting?.startsWith(String(thisYear))
    );
    const ytdAPI  = ytdSubs.reduce((sum, s) => sum + (parseFloat(s.apiSold) || 0), 0);
    const ytdApps = ytdSubs.reduce((sum, s) => sum + (parseFloat(s.applicationsSold || s.appsSold) || 0), 0);

    const persArr = Array.isArray(persistencyData) ? persistencyData : [];
    const ytdPers = persArr.filter(p => p.year === thisYear);
    const avgPersistency = ytdPers.length > 0
      ? aggregatePersistency(ytdPers).aggregatedPersistency * 100
      : null;

    let yearsOfService = null;
    if (user?.startDate) {
      const start = new Date(user.startDate);
      if (!isNaN(start)) yearsOfService = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    }

    const trailing2YrAPI = compute2YearAverageAPI(submissions, thisYear);
    const weeksCount = weeksSubmittedThisYear(submissions, thisYear);
    const weeklyPace = weeksCount > 0 ? ytdAPI / weeksCount : 0;

    return { ytdAPI, ytdApps, avgPersistency, yearsOfService, trailing2YrAPI, weeklyPace };
  }, [submissions, persistencyData, user, thisYear]);

  const currentLevel = useMemo(() => {
    let highest = CAREER_LEVELS[0];
    for (const lvl of CAREER_LEVELS) {
      const apiOk   = lvl.minApi === null   || trailing2YrAPI >= lvl.minApi;
      const appsOk  = lvl.minApps === null  || ytdApps >= lvl.minApps;
      const persOk  = lvl.minPersistency === null || (avgPersistency !== null && avgPersistency >= lvl.minPersistency);
      const yearsOk = lvl.minYears === 0 || (yearsOfService !== null && yearsOfService >= lvl.minYears);
      if (apiOk && appsOk && persOk && yearsOk) highest = lvl;
      else break;
    }
    return highest;
  }, [trailing2YrAPI, ytdApps, avgPersistency, yearsOfService]);

  const nextLevel = CAREER_LEVELS.find(l => l.level === currentLevel.level + 1) ?? null;
  const estimateStr = nextLevel ? estimateWeeksToNextLevel(ytdAPI, nextLevel.minApi, weeklyPace) : null;

  return (
    <div className="flex flex-col gap-5 pb-8">

      {/* 2-column: ladder (left) + sidebar cards (right) — stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">

        {/* Left — career ladder */}
        <CareerLadder
          currentLevel={currentLevel.level}
          onLevelClick={setDrawerLevel}
        />

        {/* Right — sidebar stack */}
        <div className="flex flex-col gap-3">
          <TimeToNextCard
            currentLevel={currentLevel.level}
            estimate={estimateStr}
            weeklyPace={weeklyPace}
          />
          <TrajectoryCard submissions={submissions} />
        </div>
      </div>

      {/* Commitment scorecards */}
      <GoalsSection />

      {/* Achievement badges */}
      <section aria-labelledby="career-portal-achievements-heading" className="card">
        <h3 id="career-portal-achievements-heading" className="text-sm font-semibold text-ink mb-4">
          Achievement badges
        </h3>
        <BadgeGrid submissions={submissions} />
      </section>

      {/* Level drill drawer */}
      {drawerLevel !== null && (
        <LevelDrillDrawer
          level={drawerLevel}
          currentLevel={currentLevel.level}
          ytdAPI={ytdAPI}
          ytdApps={ytdApps}
          avgPersistency={avgPersistency}
          yearsOfService={yearsOfService}
          trailing2YrAPI={trailing2YrAPI}
          weeklyPace={weeklyPace}
          onClose={() => setDrawerLevel(null)}
        />
      )}
    </div>
  );
}
