import React from 'react';
import { BADGES } from '../gamification/BadgeGrid';

export default function TeamMedalsPanel({ badgeCounts, loading }) {
  if (loading) {
    return (
      <div className="card">
        <div className="h-3 w-32 rounded bg-border/30 animate-pulse mb-4" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-border/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="team-medals-heading" className="card">
      <h3 id="team-medals-heading" className="text-sm font-semibold text-ink mb-0.5">
        Team Badges
      </h3>
      <p className="text-xs text-ink-muted mb-3">Earned across your team</p>

      {badgeCounts.length === 0 ? (
        <p className="text-sm text-ink-muted py-4 text-center">
          No team badges yet — encourage your team to hit their milestones
        </p>
      ) : (
        <div className="badge-grid">
          {badgeCounts.map(({ key, count }) => {
            const b = BADGES[key];
            if (!b) return null;
            const Icon = b.Icon;
            return (
              <div
                key={key}
                className="badge-item earned"
                aria-label={`${b.label} — earned by ${count} advisor${count !== 1 ? 's' : ''}`}
              >
                <div className={`badge-medal ${b.gradient} glow`}>
                  <Icon className="medal-ico" size={26} strokeWidth={2} aria-hidden="true" />
                </div>
                <div
                  className="tier-pips"
                  role="img"
                  aria-label={`Tier ${b.tier} of 5`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={`tier-pip ${n > b.tier ? 'dim' : ''}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <div className="badge-name">{b.label}</div>
                <div className="badge-sub">× {count} advisor{count !== 1 ? 's' : ''}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
