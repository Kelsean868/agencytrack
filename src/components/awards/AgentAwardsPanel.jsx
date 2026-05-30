import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { computeAgentAwards, computeRatioTrends, computeAtRiskStatus, getPeriodCtx, nextTierDistance, isPersistencyOnlyBlock } from '../../utils/awardsEngine';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { getOwnPolicies, settlementShapeFromPolicies } from '../../services/policiesService';

const CATEGORY_TABS = ['All', 'Monthly', 'Quarterly', 'Annual', 'Club'];

// ── AwardDonut — SVG progress ring ───────────────────────────────────────────
function AwardDonut({ percent, state, size = 100, strokeWidth = 10 }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, percent / 100)) * c;
  const accentColor = state === 'qualified' ? 'var(--color-gold)' : state === 'contention' ? 'var(--color-primary)' : 'var(--color-text-faint)';
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={accentColor} strokeOpacity="0.15" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={accentColor} strokeWidth={strokeWidth}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span style={{ fontSize: size * 0.26, fontWeight: 700, color: accentColor, letterSpacing: '-0.025em', fontFamily: '"Cabinet Grotesk", system-ui', lineHeight: 1, position: 'relative' }}>
        {percent}%
      </span>
    </div>
  );
}

// ── HeroAwardCard — Tier 1 hero for closest in-contention award ──────────────
function HeroAwardCard({ award }) {
  if (!award) return null;
  const gap = award.criteria?.[0] ? Math.max(0, award.criteria[0].target - award.criteria[0].current) : null;
  const gapLabel = gap !== null && award.criteria?.[0]?.unit === 'TTD' ? formatCurrency(gap) : gap !== null ? String(Math.round(gap)) : null;

  return (
    <div className="card p-6 relative overflow-hidden flex items-center gap-6" style={{ border: '1px solid rgba(1,105,111,0.3)', boxShadow: '0 8px 24px rgba(1,105,111,0.12)' }}>
      <div style={{
        position: 'absolute', top: -60, right: -100, width: 320, height: 320,
        background: 'radial-gradient(circle, var(--color-primary-tint) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <AwardDonut state="contention" percent={award.progressPercent} size={140} strokeWidth={12} />
      </div>

      <div className="flex-1 min-w-0 relative">
        <p className="text-xs font-bold tracking-widest text-primary font-mono uppercase mb-1">★ Almost there</p>
        <p className="text-3xl font-bold text-ink leading-none" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.022em', marginBottom: 6 }}>
          {award.name}
        </p>
        <p className="text-sm text-ink-muted">{award.prize}</p>

        {gapLabel && (
          <div className="inline-flex items-baseline gap-2 mt-3.5 px-3 py-2 rounded-xl bg-surface-muted border border-border">
            <span className="text-xs text-ink-muted font-mono tracking-wide">Gap</span>
            <span className="text-lg font-bold text-ink" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}>
              {gapLabel}
            </span>
            <span className="text-sm text-ink-muted">to qualify</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GroupHeader ───────────────────────────────────────────────────────────────
function GroupHeader({ label, count, accentStyle }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p className="text-xs font-bold tracking-widest font-mono uppercase" style={accentStyle}>{label}</p>
      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full" style={{ background: accentStyle.color + '20', color: accentStyle.color }}>
        {count}
      </span>
      <div className="flex-1 h-px bg-border ml-1" />
    </div>
  );
}

// ── AwardCard — Tier 2 compact grid card ─────────────────────────────────────
function AwardCard({ award, onClick }) {
  const isQualified  = award.eligible;
  const isContention = !award.eligible && award.inContention;
  const accentColor = isQualified ? 'var(--color-gold)' : isContention ? 'var(--color-primary)' : 'var(--color-text-faint)';
  const pillBg      = isQualified ? 'var(--color-gold-tint)' : isContention ? 'var(--color-primary-tint)' : 'var(--color-surface-muted)';
  const stateText   = isQualified ? 'QUALIFIED' : isContention ? `${award.progressPercent}%` : 'NOT STARTED';

  const prim = award.criteria?.[0];
  const gapLine = isQualified ? (award.earnedDate ?? 'Earned')
    : prim ? (prim.unit === 'TTD'
      ? `${formatCurrency(Math.max(0, prim.target - prim.current))} to go`
      : `${Math.max(0, Math.round(prim.target - prim.current))} to go`)
    : '';

  return (
    <button
      onClick={onClick}
      className="card p-4 text-left flex flex-col gap-3 hover:shadow-md transition-shadow w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`View ${award.name} — ${stateText}`}
    >
      {/* Name + state pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink" style={{ letterSpacing: '-0.005em' }}>{award.name}</p>
          <p className="text-xs text-ink-muted mt-0.5 leading-snug">{award.prize}</p>
        </div>
        <span className="text-[9px] font-bold tracking-wide font-mono shrink-0 px-2 py-1 rounded-full" style={{ color: accentColor, background: pillBg }}>
          {stateText}
        </span>
      </div>

      {/* Percent + bar */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-2xl font-bold" style={{ color: accentColor, fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.022em', lineHeight: 1 }}>
            {award.progressPercent}<span className="text-sm text-ink-muted ml-0.5">%</span>
          </span>
          <span className="text-[10px] text-ink-muted font-mono tracking-wide">{gapLine}</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
          <div style={{ width: `${Math.max(2, award.progressPercent)}%`, height: '100%', background: accentColor, borderRadius: 999 }} />
        </div>
        {prim && (
          <p className="text-[10px] text-ink-faint font-mono text-center mt-1.5 tracking-wide">
            {prim.unit === 'TTD' ? formatCurrency(prim.current) : Math.round(prim.current)} of {prim.unit === 'TTD' ? formatCurrency(prim.target) : Math.round(prim.target)}
          </p>
        )}
      </div>
    </button>
  );
}

// ── RatioMiniSpark — SVG polyline sparkline ──────────────────────────────────
function RatioMiniSpark({ values, color, width = 120, height = 24 }) {
  if (!values?.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 4) + 2;
    const y = (height - 4) - ((v - min) / range) * (height - 4) + 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const last = pts.split(' ').pop().split(',');
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
    </svg>
  );
}

function RatioTrendCard({ label, value4w, value12w, trend, format, sparkValues, color }) {
  const fmt = (v) => {
    if (format === 'currency') return formatCurrency(v);
    if (format === 'percent') return `${v}%`;
    return String(v);
  };
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendCls  = trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-ink-muted';

  return (
    <div className="card p-4 flex flex-col gap-2">
      <p className="text-[10px] font-bold tracking-widest text-ink-faint font-mono uppercase">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-2xl font-bold text-ink leading-none" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}>
          {fmt(value4w)}
        </p>
        <TrendIcon size={14} className={trendCls} />
      </div>
      {sparkValues && <RatioMiniSpark values={sparkValues} color={color ?? 'var(--color-primary)'} />}
      <p className="text-[10px] text-ink-muted font-mono tracking-wide">12w avg · {fmt(value12w)}</p>
    </div>
  );
}

// ── AwardDrillDrawer — slide-in detail panel ─────────────────────────────────
function AwardDrillDrawer({ award, onClose }) {
  const handleKey = useCallback((e) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  if (!award) return null;

  const isQualified = award.eligible;
  const accentColor = isQualified ? 'var(--color-gold)' : 'var(--color-primary)';

  return (
    <>
      <div className="fixed inset-0 z-30" style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)' }} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog" aria-modal="true" aria-label={`${award.name} details`}
        className="fixed top-0 right-0 bottom-0 z-40 flex flex-col bg-card"
        style={{ width: '100%', maxWidth: 460, borderLeft: '1px solid var(--color-border)', boxShadow: '-12px 0 32px rgba(0,0,0,0.12)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 min-h-[36px] rounded-full border border-border text-sm font-bold text-ink bg-surface hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close"
        >
          <X size={13} /> Close
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <p className="text-xs font-bold tracking-widest font-mono uppercase mb-1.5" style={{ color: accentColor }}>
            {isQualified ? '✓ Qualified' : '★ In contention'}
          </p>
          <div className="flex items-center gap-4">
            <AwardDonut state={isQualified ? 'qualified' : 'contention'} percent={award.progressPercent} size={72} strokeWidth={8} />
            <div>
              <p className="text-xl font-bold text-ink" style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}>
                {award.name}
              </p>
              <p className="text-xs text-ink-muted mt-1">{award.prize}</p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs font-bold tracking-widest text-ink-faint font-mono uppercase mb-2.5">Criteria</p>
          <div className="flex flex-col gap-2.5">
            {(award.criteria ?? []).map((c, i) => {
              const pct = c.target > 0 ? Math.min(100, Math.round((c.current / c.target) * 100)) : 0;
              const met = c.met;
              const fmtV = (v) => c.unit === 'TTD' ? formatCurrency(v) : c.unit === '%' ? `${Number(v).toFixed(1)}%` : String(Math.round(v));
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
                    <span className="text-xs font-mono text-ink-muted">{fmtV(c.current)}</span>
                    <span className="text-xs font-mono text-ink-faint">{fmtV(c.target)}</span>
                  </div>
                  <div className="h-1 rounded-full bg-surface-muted overflow-hidden">
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: met ? 'var(--color-success)' : 'var(--color-warning)', borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {award.note && (
            <div className="mt-4 p-3 rounded-xl bg-warning/8 border border-warning/20">
              <p className="text-xs text-warning leading-relaxed">{award.note}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function AgentAwardsPanel({ submissions, confirmedSettlements, agentProfile, currentDate, ruleset }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [drawerAward, setDrawerAward]        = useState(null);
  const { tenantId } = useAuth();
  const [ledgerPolicies, setLedgerPolicies] = useState(null);
  const usesPolicyLedger = Boolean(agentProfile?.usesPolicyLedger);

  useEffect(() => {
    if (!usesPolicyLedger || !tenantId || !agentProfile?.uid) return;
    getOwnPolicies(tenantId, agentProfile.uid)
      .then(setLedgerPolicies)
      .catch(() => setLedgerPolicies([]));
  }, [usesPolicyLedger, tenantId, agentProfile?.uid]);

  const activeConfirmedData = useMemo(() => {
    if (!usesPolicyLedger) return confirmedSettlements ?? [];
    if (ledgerPolicies === null) return [];
    const ledgerShape = settlementShapeFromPolicies(ledgerPolicies);
    const persistByPeriod = {};
    for (const s of (confirmedSettlements ?? [])) {
      if (s.periodKey && s.persistency) persistByPeriod[s.periodKey] = s.persistency;
    }
    return ledgerShape.map((row) => ({ ...row, persistency: persistByPeriod[row.periodKey] ?? 0 }));
  }, [usesPolicyLedger, ledgerPolicies, confirmedSettlements]);

  const now = useMemo(() => currentDate ?? new Date(), [currentDate]);

  const computation = useMemo(() => {
    try {
      const rawAwards = computeAgentAwards(activeConfirmedData, submissions, agentProfile, now, ruleset);
      const awards = {};
      for (const [id, award] of Object.entries(rawAwards)) {
        const paceStatus = computeAtRiskStatus(award, getPeriodCtx(award.category, now));
        const persistencyBlock = isPersistencyOnlyBlock(award);
        let tierGap = null;
        if (award.category === 'club' && !award.eligible) {
          const annualApi = award.criteria[0]?.current ?? 0;
          tierGap = nextTierDistance(annualApi, ruleset.clubAward.tiers);
        }
        awards[id] = { ...award, paceStatus, persistencyBlock, tierGap };
      }
      return { awards, ratioTrends: computeRatioTrends(submissions), error: null };
    } catch (e) {
      console.error(e);
      return { awards: {}, ratioTrends: null, error: 'Failed to compute awards.' };
    }
  }, [activeConfirmedData, submissions, agentProfile, now, ruleset]);

  const { awards, ratioTrends, error } = computation;

  // Filter by active category tab
  const filteredAwards = useMemo(() => {
    const all = Object.values(awards);
    if (activeCategory === 'All') return all;
    return all.filter(a => a.category === activeCategory.toLowerCase());
  }, [awards, activeCategory]);

  // Group awards by progress level
  const { heroAward, qualified, almostThere, makingProgress, justStarting } = useMemo(() => {
    const qualified    = filteredAwards.filter(a => a.eligible);
    const inContention = filteredAwards.filter(a => !a.eligible && a.inContention);
    const notYet       = filteredAwards.filter(a => !a.eligible && !a.inContention);

    const almostThere     = inContention.filter(a => a.progressPercent >= 70);
    const makingProgress  = inContention.filter(a => a.progressPercent >= 30 && a.progressPercent < 70)
      .concat(notYet.filter(a => a.progressPercent >= 30));
    const justStarting    = notYet.filter(a => a.progressPercent < 30);

    // Hero: highest % among inContention (not qualified)
    const hero = inContention.sort((a, b) => b.progressPercent - a.progressPercent)[0] ?? null;

    return { heroAward: hero, qualified, almostThere, makingProgress, justStarting };
  }, [filteredAwards]);

  if (!submissions?.length) {
    return (
      <div className="card text-center py-12">
        <p className="text-sm text-ink-muted">Start submitting weekly reports to see your awards progress.</p>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-sm text-danger">{error}</div>;
  }

  const totalTracked = Object.keys(awards).length;

  return (
    <div className="flex flex-col gap-6">

      {/* Hero card */}
      {heroAward && <HeroAwardCard award={heroAward} />}

      {/* Category tabs + total count */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl bg-surface-muted border border-border overflow-x-auto">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={`px-3.5 min-h-[36px] rounded-lg text-xs font-bold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                activeCategory === tab
                  ? 'bg-card text-ink shadow-sm border border-border'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-faint font-mono tracking-wide">{totalTracked} awards tracked</p>
      </div>

      {/* Award groups */}
      {qualified.length > 0 && (
        <div>
          <GroupHeader label="✓ Qualified" count={qualified.length} accentStyle={{ color: 'var(--color-gold)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {qualified.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />)}
          </div>
        </div>
      )}

      {almostThere.length > 0 && (
        <div>
          <GroupHeader label="★ Almost there · 70%+" count={almostThere.length} accentStyle={{ color: 'var(--color-primary)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {almostThere.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />)}
          </div>
        </div>
      )}

      {makingProgress.length > 0 && (
        <div>
          <GroupHeader label="↗ Making progress · 30–70%" count={makingProgress.length} accentStyle={{ color: 'var(--color-primary-light)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {makingProgress.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />)}
          </div>
        </div>
      )}

      {justStarting.length > 0 && (
        <div>
          <GroupHeader label="◯ Just starting · under 30%" count={justStarting.length} accentStyle={{ color: 'var(--color-text-faint)' }} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {justStarting.map(a => <AwardCard key={a.id} award={a} onClick={() => setDrawerAward(a)} />)}
          </div>
        </div>
      )}

      {filteredAwards.length === 0 && (
        <div className="card text-center py-10">
          <p className="text-sm text-ink-muted">No awards in this category.</p>
        </div>
      )}

      {/* Ratio trends */}
      {ratioTrends && (
        <div>
          <p className="text-xs font-bold tracking-widest text-ink-faint font-mono uppercase mb-3">Activity ratio trends · last 12 weeks</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <RatioTrendCard
              label="CI to Sale"
              value4w={ratioTrends.ciToSaleRatio.trailing4w}
              value12w={ratioTrends.ciToSaleRatio.trailing12w}
              trend={ratioTrends.ciToSaleRatio.trend}
              sparkValues={ratioTrends.ciToSaleRatio.weeklyValues}
              color="var(--color-primary)"
            />
            <RatioTrendCard
              label="Dials to CI"
              value4w={ratioTrends.dialsToCIRatio.trailing4w}
              value12w={ratioTrends.dialsToCIRatio.trailing12w}
              trend={ratioTrends.dialsToCIRatio.trend}
              sparkValues={ratioTrends.dialsToCIRatio.weeklyValues}
              color="var(--color-gold)"
            />
            <RatioTrendCard
              label="Avg Policy Size"
              value4w={ratioTrends.avgPolicySize.trailing4w}
              value12w={ratioTrends.avgPolicySize.trailing12w}
              trend={ratioTrends.avgPolicySize.trend}
              format="currency"
              sparkValues={ratioTrends.avgPolicySize.weeklyValues}
              color="var(--color-primary-dark)"
            />
            <RatioTrendCard
              label="FFI to Dial"
              value4w={ratioTrends.ffiToDialRatio.trailing4w}
              value12w={ratioTrends.ffiToDialRatio.trailing12w}
              trend={ratioTrends.ffiToDialRatio.trend}
              sparkValues={ratioTrends.ffiToDialRatio.weeklyValues}
              color="var(--color-danger)"
            />
          </div>
        </div>
      )}

      {/* Drill drawer */}
      {drawerAward && <AwardDrillDrawer award={drawerAward} onClose={() => setDrawerAward(null)} />}
    </div>
  );
}
