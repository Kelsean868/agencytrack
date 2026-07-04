import React from 'react';
import { ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import { MDRT_THRESHOLDS_2026 } from '../../../config/mdrtThresholds/2026';

/**
 * HeroCard (v2 Agent Dashboard home).
 *
 * Big YTD API number + progress bar to personal annual API goal, with an
 * MDRT marker at the shared constant. CTA "Submit weekly report" fires the
 * onSubmit callback (parent wires to setShowWizard(true)).
 *
 * No YoY chip — last-year aggregation isn't available; banked as a LOW FU
 * in docs/FOLLOW_UPS.md.
 */
export default function HeroCard({ ytdApi, personalAnnualAPI, onSubmit }) {
  const goal = personalAnnualAPI > 0 ? personalAnnualAPI : MDRT_THRESHOLDS_2026.mdrt;
  const pct = goal > 0 ? Math.min(100, Math.max(0, Math.round((ytdApi / goal) * 100))) : 0;
  // MDRT marker renders only when on-scale (MDRT ≤ goal). When MDRT exceeds the
  // goal it's off-scale for this bar — hide it rather than clamping it onto the
  // goal label (the clamp was the marker/label collision). Over-goal MDRT
  // progress is surfaced separately (Career/MDRT tracker).
  const mdrtOnScale = goal > 0 && MDRT_THRESHOLDS_2026.mdrt <= goal;
  const mdrtPct = mdrtOnScale ? Math.round((MDRT_THRESHOLDS_2026.mdrt / goal) * 100) : 0;

  // Weeks left in current calendar year (approximate, for the secondary copy)
  const now = new Date();
  const yearEnd = new Date(now.getFullYear(), 11, 31);
  const weeksLeft = Math.max(0, Math.ceil((yearEnd - now) / (1000 * 60 * 60 * 24 * 7)));

  return (
    <div
      className="glass hero teal relative overflow-hidden flex items-center gap-6 flex-wrap"
      style={{ padding: '22px 26px' }}
    >
      {/* Left — content */}
      <div className="flex-1 min-w-0 relative">
        <p className="text-xs font-bold tracking-widest uppercase text-[--hero-ink-muted-teal] font-mono">
          YTD · Settled API
        </p>
        <p
          className="text-[--hero-ink] mt-2"
          style={{
            fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1,
            fontFamily: '"Cabinet Grotesk", system-ui, sans-serif',
          }}
        >
          {formatCurrency(ytdApi)}
        </p>
        <p className="text-sm text-[--hero-ink-muted-teal] mt-2">
          {pct}% of {formatCurrency(goal)} goal · {weeksLeft} {weeksLeft === 1 ? 'week' : 'weeks'} to year-end
        </p>

        {/* Progress bar with MDRT marker */}
        <div className="mt-4 w-full" style={{ maxWidth: 520 }}>
          <div
            className="relative rounded-full overflow-hidden bg-white/20"
            style={{ height: 8 }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`YTD progress: ${pct}% of ${formatCurrency(goal)} goal`}
          >
            <div
              className="h-full rounded-full bg-[--hero-ink]"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* MDRT marker — only when on-scale; staggered into its own band above
              the axis endpoints so its label never collides with "Goal". */}
          {mdrtOnScale && (
            <div className="relative mt-2 text-[10px] font-mono tracking-wider uppercase" style={{ height: 14 }}>
              <span
                className="absolute top-0 whitespace-nowrap"
                style={{ left: `${mdrtPct}%`, transform: 'translateX(-50%)', color: 'var(--hero-dot-warning)' }}
              >
                MDRT · {formatCurrency(MDRT_THRESHOLDS_2026.mdrt)}
              </span>
            </div>
          )}
          {/* Axis endpoints — goal amount lives in the subtitle above, so the
              end label is a bare "Goal" tick (no duplicated amount). */}
          <div className="flex justify-between items-center mt-2 text-[10px] font-mono tracking-wider uppercase text-[--hero-ink-muted-teal]">
            <span>{formatCurrency(0)}</span>
            <span>Goal</span>
          </div>
        </div>
      </div>

      {/* Right — CTA */}
      <div className="relative shrink-0 text-right" style={{ minWidth: 220 }}>
        <p className="text-xs font-bold tracking-widest uppercase text-[--hero-ink-muted-teal] font-mono">
          Next step
        </p>
        <p className="text-sm font-semibold text-[--hero-ink] mt-1.5" style={{ maxWidth: 220 }}>
          Keep your streak going — submit this week's report.
        </p>
        <button
          type="button"
          onClick={onSubmit}
          className="mt-3.5 inline-flex items-center gap-2 px-5 rounded-lg border-2 border-white/70 text-[--hero-ink] font-bold text-sm min-h-[44px] hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          Submit weekly report
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
