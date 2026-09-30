import React, { useState, useEffect, useMemo } from 'react';
import { Pencil, X, Check, Lock, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import BadgeGrid from '../gamification/BadgeGrid';
import { formatPersistencyPct } from '../../lib/persistency/persistencyRounding';
import {
  CAREER_LEVELS, LEVEL_TAGLINES, UNLOCK_COPY, getLevelState, computeQuarterlyAPI,
  estimateWeeksToNextLevel, careerStats, currentLevel as currentLevelFor, levelCriteria,
} from '../../lib/career/careerModel';
import CareerTrophiesCard from '../fr/compete/CareerTrophiesCard';
import useCareerCommitment from './useCareerCommitment';

const CAREER_PORTAL_YEAR = new Date().getFullYear();

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
      ? 'var(--color-gold-ink)'
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
              color: 'var(--color-gold-ink)',
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
        <p className="text-xs font-bold tracking-widest text-ink-muted font-mono uppercase">Your career ladder</p>
        <p className="text-xs text-ink-muted font-mono">{currentLevel} of {CAREER_LEVELS.length} levels</p>
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
        <p className="text-xs font-bold tracking-widest text-ink-muted font-mono uppercase mb-1.5">Next milestone</p>
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
        <p className="text-xs font-bold tracking-widest text-ink-muted font-mono uppercase">Trajectory · 8 quarters</p>
        {hasData && (
          <p className="text-xs font-mono text-success-ink font-bold">↗ Growth trend</p>
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
          <p className="text-xs text-ink-muted font-mono mt-2 tracking-wide">Quarterly API · TTD thousands</p>
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
        <p className="text-xs font-bold tracking-widest text-ink-muted font-mono uppercase">{label}</p>
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
      <p className="text-xs font-bold tracking-widest text-ink-muted font-mono uppercase">{label}</p>
      <div className="flex items-baseline justify-between gap-2">
        <span style={{
          fontSize: 22, fontWeight: 700, color: fillColor,
          fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em', lineHeight: 1,
        }}>
          {formatVal(mine)}
        </span>
        <span className="text-xs text-ink-muted font-mono uppercase tracking-wide">My commitment</span>
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

      <div className="flex justify-between text-[9.5px] text-ink-muted font-mono tracking-wide">
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

  const criteria = levelCriteria(lvl, { ytdApps, avgPersistency, yearsOfService, trailing2YrAPI });

  const fmtV = (v, kind) => {
    if (kind === 'currency') return v >= 1000 ? `TTD ${(v / 1000).toFixed(0)}K` : `TTD ${Math.round(v)}`;
    if (kind === 'percent')  return formatPersistencyPct(v);
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
          <p className="text-xs font-bold tracking-widest font-mono uppercase" style={{ color: isNext ? 'var(--color-gold-ink)' : 'var(--color-primary)' }}>
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
          <p className="text-xs font-bold tracking-widest text-ink-muted font-mono uppercase mb-2.5">
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
                    <span className="text-xs font-mono text-ink-muted">{fmtV(c.target, c.fmt)}</span>
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
              <p className="text-xs font-bold tracking-widest font-mono uppercase mt-5 mb-2.5" style={{ color: 'var(--color-gold-ink)' }}>
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
  const {
    editing, setEditing, saving, saveError, setSaveError, draft, setDraft,
    showNudge, setShowNudge, pendingDraft, setPendingDraft, moneyNeedsRequired,
    doSave, handleSave, mins, resolvedAnnualAPIFloor, mgr, mine,
  } = useCareerCommitment(CAREER_PORTAL_YEAR);

  return (
    <div className="flex flex-col gap-4">
      {/* Section header + edit toggle */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold tracking-widest text-ink-muted font-mono uppercase">Your annual commitment</p>
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
            <p className="text-xs text-danger-ink bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">{saveError}</p>
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
// `onOpenTrophies` is passed only under the FR look (R2-5, ruling R-c): the Trophy
// room exists only there (AgentDashboard FR_ONLY_FALLBACK sends `trophies` back to
// Career under Nexus), so without it the Nexus look keeps its badge grid as before.
export default function CareerPortal({ submissions, user, persistencyData, ytdTotals: _ytdTotals, onOpenTrophies }) {
  const { user: authUser, tenantId } = useAuth();
  const [drawerLevel, setDrawerLevel] = useState(null);
  const thisYear = CAREER_PORTAL_YEAR;

  const { ytdAPI, ytdApps, avgPersistency, yearsOfService, trailing2YrAPI, weeklyPace } = useMemo(
    () => careerStats(submissions, persistencyData, user, thisYear),
    [submissions, persistencyData, user, thisYear],
  );

  const currentLevel = useMemo(
    () => currentLevelFor({ trailing2YrAPI, ytdApps, avgPersistency, yearsOfService }),
    [trailing2YrAPI, ytdApps, avgPersistency, yearsOfService],
  );

  const nextLevel = CAREER_LEVELS.find(l => l.level === currentLevel.level + 1) ?? null;
  const estimateStr = nextLevel ? estimateWeeksToNextLevel(ytdAPI, nextLevel.minApi, weeklyPace) : null;

  // §2 staggered-assemble — the level drill drawer is a fixed-position
  // overlay rendered outside the `.stagger` container (same pattern as
  // GamePlanV2's modalsBlock split): it only opens on click, well after the
  // one-shot mount-time stagger animation has finished.
  return (
    <>
    <div className="flex flex-col gap-5 pb-8 stagger">

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

      {/* Achievement badges — FR look: the badge grid lives in the Trophy room (R-c);
          Career keeps a count card with a button there. Nexus look: unchanged. */}
      {onOpenTrophies ? (
        <CareerTrophiesCard tenantId={tenantId} uid={authUser?.uid} onOpen={onOpenTrophies} />
      ) : (
        <section aria-labelledby="career-portal-achievements-heading" className="card">
          <h3 id="career-portal-achievements-heading" className="text-sm font-semibold text-ink mb-4">
            Achievement badges
          </h3>
          <BadgeGrid submissions={submissions} />
        </section>
      )}
    </div>

      {/* Level drill drawer — outside `.stagger` (fixed-position overlay; see note above) */}
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
    </>
  );
}
