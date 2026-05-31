import React from 'react';
import { Activity, ListChecks, Award, Repeat, Flame, AlertCircle } from 'lucide-react';
import { MiniSparkline, MiniDonut, MiniBars, MiniBadge } from './MiniViz';

/**
 * PulseStrip — 6 chip grid for v2 Agent Dashboard home.
 *
 * Each chip is a 44px-min <button> with an aria-label that carries the
 * meaning. The mini-viz is decorative (aria-hidden via MiniViz primitives).
 * Standard chip opens the StandardDetail drawer; others setActiveTab to the
 * relevant existing tab.
 *
 * Tones map to existing token palettes via CSS vars on the icon-bubble bg.
 */

const TONE_FG = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger:  'var(--color-danger)',
  gold:    'var(--color-gold)',
  teal:    'var(--color-primary)',
};
const TONE_BG = {
  success: 'var(--color-success-tint)',
  warning: 'var(--color-warning-tint)',
  danger:  'var(--color-danger-tint)',
  gold:    'var(--color-gold-tint)',
  teal:    'var(--color-primary-tint)',
};

function PulseViz({ viz, color }) {
  if (!viz) return null;
  if (viz.type === 'spark') return <MiniSparkline color={color} values={viz.values} />;
  if (viz.type === 'donut') return <MiniDonut color={color} percent={viz.percent} />;
  if (viz.type === 'bars')  return <MiniBars color={color} values={viz.values} />;
  if (viz.type === 'badge') return <MiniBadge color={color} count={viz.count} />;
  return null;
}

function PulseChip({ Icon, label, status, tone, viz, onClick, ariaLabel, active }) {
  const fg = TONE_FG[tone] ?? TONE_FG.teal;
  const bg = TONE_BG[tone] ?? TONE_BG.teal;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active ? 'true' : undefined}
      className={`card text-left flex flex-col gap-3 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'border-primary/40' : ''}`}
      style={{ padding: '12px 14px' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center shrink-0"
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: bg, color: fg,
          }}
        >
          <Icon size={15} />
        </span>
        <PulseViz viz={viz} color={fg} />
      </div>
      <span className="text-[10px] font-bold tracking-widest uppercase text-ink-muted font-mono">
        {label}
      </span>
      <span className="text-sm font-bold text-ink leading-snug">{status}</span>
    </button>
  );
}

export default function PulseStrip({ pulses, activeKey, onChipClick }) {
  return (
    <div
      role="group"
      aria-label="Activity pulse"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5"
    >
      {pulses.map((p) => (
        <PulseChip
          key={p.key}
          Icon={ICON_BY_KIND[p.kind]}
          label={p.label}
          status={p.status}
          tone={p.tone}
          viz={p.viz}
          ariaLabel={p.ariaLabel}
          active={activeKey === p.key}
          onClick={() => onChipClick(p.key)}
        />
      ))}
    </div>
  );
}

const ICON_BY_KIND = {
  activity: Activity,
  standard: ListChecks,
  awards:   Award,
  persist:  Repeat,
  streak:   Flame,
  action:   AlertCircle,
};
