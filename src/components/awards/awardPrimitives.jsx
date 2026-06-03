/**
 * Track J — Agent Awards v2 shared primitives.
 *
 * The five visual primitives that compose the v2 awards surfaces:
 *   • AwardDonut       — SVG progress ring with state-driven accent color
 *   • HeroAwardCard    — Tier 1 hero for the closest in-contention award
 *   • GroupHeader      — eyebrow label + count pill + horizontal divider
 *   • AwardCard        — Tier 2 compact grid card with state pill + bar
 *   • AwardDrillDrawer — Tier 3 slide-in detail panel with criteria checklist
 *
 * State → token mapping (matches the #391 precedent for the agent panel):
 *   • qualified  → `var(--color-gold)`
 *   • contention → `var(--color-primary)`
 *   • locked     → `var(--color-text-faint)`
 *
 * The mockup's raw hex (`#f59e0b` / `#4ab5b8` / `#a89a85`) is intentionally
 * NOT used here — Nexus tokens carry the same hue family and theme-flip in
 * dark mode without any code change.
 *
 * AgentAwardsPanel.jsx still carries inline-duplicated copies of these (per
 * #391's terminal scope at ship time). A future cleanup FU consumes from
 * this module to dedup; until then the duplicates are knowingly retained.
 */

import React, { useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { formatCurrency, formatAwardPct } from '../../utils/formatters';

// ─────────────────────────────────────────────────────────────────────────────
// AwardDonut — SVG progress ring
// ─────────────────────────────────────────────────────────────────────────────
export function AwardDonut({ percent, state, size = 100, strokeWidth = 10 }) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, percent / 100)) * c;
  const accentColor =
    state === 'qualified'  ? 'var(--color-gold)' :
    state === 'contention' ? 'var(--color-primary)' :
                             'var(--color-text-faint)';
  return (
    <div
      style={{
        position: 'relative', width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
      data-testid="award-donut"
      data-state={state}
      data-percent={percent}
    >
      <svg width={size} height={size} style={{ position: 'absolute' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={accentColor} strokeOpacity="0.15" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={accentColor} strokeWidth={strokeWidth}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <span style={{
        fontSize: size * 0.26, fontWeight: 700, color: accentColor,
        letterSpacing: '-0.025em', fontFamily: '"Cabinet Grotesk", system-ui',
        lineHeight: 1, position: 'relative',
      }}>
        {formatAwardPct(percent)}%
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroAwardCard — Tier 1 hero for closest in-contention award
// ─────────────────────────────────────────────────────────────────────────────
export function HeroAwardCard({ award, eyebrow = '★ Almost there' }) {
  if (!award) return null;
  const prim = award.criteria?.[0];
  const gap = prim ? Math.max(0, prim.target - prim.current) : null;
  const gapLabel = gap === null
    ? null
    : prim.unit === 'TTD'
      ? formatCurrency(gap)
      : prim.unit === '%'
        ? `${Number(gap).toFixed(1)}%`
        : String(Math.round(gap));

  return (
    <div
      className="card p-6 relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6"
      data-testid="hero-award-card"
      style={{ border: '1px solid var(--color-primary)', boxShadow: 'var(--shadow-md)' }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: -60, right: -100, width: 320, height: 320,
          background: 'radial-gradient(circle, var(--color-primary-tint) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <AwardDonut state="contention" percent={award.progressPercent} size={140} strokeWidth={12} />
      </div>

      <div className="flex-1 min-w-0 relative">
        <p className="text-xs font-bold tracking-widest text-primary font-mono uppercase mb-1">
          {eyebrow}
        </p>
        <p
          className="text-3xl font-bold text-ink leading-none"
          style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.022em', marginBottom: 6 }}
        >
          {award.name}
        </p>
        {award.prize && <p className="text-sm text-ink-muted">{award.prize}</p>}

        {gapLabel && (
          <div className="inline-flex items-baseline gap-2 mt-3.5 px-3 py-2 rounded-xl bg-surface-muted border border-border">
            <span className="text-xs text-ink-muted font-mono tracking-wide">Gap</span>
            <span
              className="text-lg font-bold text-ink"
              style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}
            >
              {gapLabel}
            </span>
            <span className="text-sm text-ink-muted">to qualify</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupHeader — eyebrow label + count pill + horizontal divider
// ─────────────────────────────────────────────────────────────────────────────
export function GroupHeader({ label, count, accentStyle }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p className="text-xs font-bold tracking-widest font-mono uppercase" style={accentStyle}>
        {label}
      </p>
      <span
        className="text-xs font-bold font-mono px-2 py-0.5 rounded-full"
        style={{ background: `${accentStyle.color}20`, color: accentStyle.color }}
      >
        {count}
      </span>
      <div className="flex-1 h-px bg-border ml-1" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AwardCard — Tier 2 compact grid card
// ─────────────────────────────────────────────────────────────────────────────
export function AwardCard({ award, onClick }) {
  const isQualified  = award.eligible;
  const isContention = !award.eligible && award.inContention;
  const accentColor =
    isQualified  ? 'var(--color-gold)' :
    isContention ? 'var(--color-primary)' :
                   'var(--color-text-faint)';
  const pillBg =
    isQualified  ? 'var(--color-gold-tint)' :
    isContention ? 'var(--color-primary-tint)' :
                   'var(--color-surface-muted)';
  const stateText =
    isQualified  ? 'QUALIFIED' :
    isContention ? `${formatAwardPct(award.progressPercent)}%` :
                   'NOT STARTED';

  const prim = award.criteria?.[0];
  const gapLine = isQualified
    ? (award.earnedDate ?? 'Earned')
    : prim
      ? (prim.unit === 'TTD'
        ? `${formatCurrency(Math.max(0, prim.target - prim.current))} to go`
        : `${Math.max(0, Math.round(prim.target - prim.current))} to go`)
      : '';

  return (
    <button
      onClick={onClick}
      className="card p-4 text-left flex flex-col gap-3 hover:shadow-md transition-shadow w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`View ${award.name} — ${stateText}`}
      data-testid={`award-card-${award.id}`}
      data-state={isQualified ? 'qualified' : isContention ? 'contention' : 'locked'}
    >
      {/* Name + state pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink" style={{ letterSpacing: '-0.005em' }}>
            {award.name}
          </p>
          {award.prize && (
            <p className="text-xs text-ink-muted mt-0.5 leading-snug">{award.prize}</p>
          )}
        </div>
        <span
          className="text-[9px] font-bold tracking-wide font-mono shrink-0 px-2 py-1 rounded-full"
          style={{ color: accentColor, background: pillBg }}
        >
          {stateText}
        </span>
      </div>

      {/* Percent + bar */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span
            className="text-2xl font-bold"
            style={{
              color: accentColor, fontFamily: '"Cabinet Grotesk", system-ui',
              letterSpacing: '-0.022em', lineHeight: 1,
            }}
          >
            {formatAwardPct(award.progressPercent)}<span className="text-sm text-ink-muted ml-0.5">%</span>
          </span>
          <span className="text-[10px] text-ink-muted font-mono tracking-wide">{gapLine}</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
          <div
            style={{
              width: `${Math.max(2, award.progressPercent)}%`,
              height: '100%', background: accentColor, borderRadius: 999,
            }}
          />
        </div>
        {prim && (
          <p className="text-[10px] text-ink-faint font-mono text-center mt-1.5 tracking-wide">
            {prim.unit === 'TTD' ? formatCurrency(prim.current) : Math.round(prim.current)}
            {' of '}
            {prim.unit === 'TTD' ? formatCurrency(prim.target) : Math.round(prim.target)}
          </p>
        )}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AwardDrillDrawer — Tier 3 slide-in detail panel
// ─────────────────────────────────────────────────────────────────────────────
export function AwardDrillDrawer({ award, onClose }) {
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
      <div
        className="fixed inset-0 z-30"
        style={{ background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog" aria-modal="true" aria-label={`${award.name} details`}
        className="fixed top-0 right-0 bottom-0 z-40 flex flex-col bg-card"
        style={{
          width: '100%', maxWidth: 460,
          borderLeft: '1px solid var(--color-border)',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.12)',
        }}
        data-testid="award-drill-drawer"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 min-h-[44px] rounded-full border border-border text-sm font-bold text-ink bg-surface hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close"
        >
          <X size={13} /> Close
        </button>

        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <p
            className="text-xs font-bold tracking-widest font-mono uppercase mb-1.5"
            style={{ color: accentColor }}
          >
            {isQualified ? '✓ Qualified' : '★ In contention'}
          </p>
          <div className="flex items-center gap-4">
            <AwardDonut
              state={isQualified ? 'qualified' : 'contention'}
              percent={award.progressPercent}
              size={72} strokeWidth={8}
            />
            <div>
              <p
                className="text-xl font-bold text-ink"
                style={{ fontFamily: '"Cabinet Grotesk", system-ui', letterSpacing: '-0.018em' }}
              >
                {award.name}
              </p>
              {award.prize && <p className="text-xs text-ink-muted mt-1">{award.prize}</p>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs font-bold tracking-widest text-ink-faint font-mono uppercase mb-2.5">
            Criteria
          </p>
          <div className="flex flex-col gap-2.5">
            {(award.criteria ?? []).map((c, i) => {
              const pct = c.target > 0 ? Math.min(100, Math.round((c.current / c.target) * 100)) : 0;
              const met = c.met;
              const fmtV = (v) =>
                c.unit === 'TTD' ? formatCurrency(v) :
                c.unit === '%'   ? `${Number(v).toFixed(1)}%` :
                                   String(Math.round(v));
              return (
                <div key={i} className="p-3 rounded-xl border border-border">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div
                      style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        background: met ? 'var(--color-success)' : 'transparent',
                        border: met ? 'none' : '1.5px solid var(--color-warning)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      aria-hidden="true"
                    >
                      {met && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <p className="flex-1 text-xs font-semibold text-ink">{c.label}</p>
                    <p
                      className="text-xs font-bold font-mono"
                      style={{ color: met ? 'var(--color-success)' : 'var(--color-warning)' }}
                    >
                      {pct}%
                    </p>
                  </div>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-mono text-ink-muted">{fmtV(c.current)}</span>
                    <span className="text-xs font-mono text-ink-faint">{fmtV(c.target)}</span>
                  </div>
                  <div className="h-1 rounded-full bg-surface-muted overflow-hidden">
                    <div
                      style={{
                        width: `${Math.min(pct, 100)}%`, height: '100%',
                        background: met ? 'var(--color-success)' : 'var(--color-warning)',
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {award.note && (
            <div className="mt-4 p-3 rounded-xl bg-warning-tint border border-warning/30">
              <p className="text-xs text-warning leading-relaxed">{award.note}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// groupByProgress lives in awardGrouping.js (pure logic; JSX modules must
// export components only per react-refresh/only-export-components).
