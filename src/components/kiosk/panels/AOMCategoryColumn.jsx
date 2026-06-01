import React from 'react';
import Avatar from '../Avatar';
import { formatCurrency } from '../../../utils/formatters';

function formatValue(category, value) {
  if (category === 'api') return formatCurrency(value || 0);
  if (category === 'apps') return `${value || 0} app${value !== 1 ? 's' : ''}`;
  return `${value || 0} pts`;
}

export default function AOMCategoryColumn({ category, label, Icon, winner, index = 0 }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-6 animate-stagger-in"
      style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-center gap-3">
        <Icon size={32} className="text-primary" aria-hidden="true" />
        <h2 className="text-3xl font-display font-bold text-ink">{label}</h2>
      </div>

      {winner ? (
        <>
          {/* Track J Kiosk v2 — wrap the Avatar in a presentation-gold
              halo ring (animated, motion-reduce safe via Tailwind keyframe
              + the @media (prefers-reduced-motion) reset in the global CSS).
              Avatar component itself is unchanged. */}
          <div
            className="rounded-full motion-reduce:animate-none animate-kiosk-halo-gold"
            data-testid="aom-winner-halo"
          >
            <Avatar
              agent={{
                uid: winner.agentUid ?? '',
                name: winner.agentName ?? '',
                photoURL: winner.photoURL ?? null,
              }}
              size="aom"
            />
          </div>
          <div className="text-center">
            <p className="text-4xl font-display font-bold text-ink leading-tight">
              {winner.agentName}
            </p>
            <p className="text-2xl text-primary font-semibold mt-2">
              {formatValue(category, winner.achievementValue)}
            </p>
          </div>
        </>
      ) : (
        <>
          <div
            aria-hidden="true"
            style={{ width: 200, height: 200, borderRadius: '50%' }}
            className="bg-surface-raised flex items-center justify-center"
          >
            <span className="text-ink-muted text-5xl font-bold">?</span>
          </div>
          <p className="text-2xl text-ink-muted font-semibold">Pending</p>
        </>
      )}
    </div>
  );
}
