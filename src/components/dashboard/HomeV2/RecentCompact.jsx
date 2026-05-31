import React from 'react';
import { Check } from 'lucide-react';
import { BADGES } from '../../gamification/BadgeGrid';

/**
 * RecentCompact — left column of the v2 home Recent panel.
 *
 * Renders the top 4 events from `activityEvents` in the compact list shape
 * used by the v2 mockup. Reuses the same event shape produced by
 * buildActivityEvents (submission/badge), and the same .activity-icon /
 * .badge-medal CSS classes as the legacy ActivityFeed so styling stays
 * consistent.
 *
 * Wraps itself in a .card so it sits on the home directly (no parent
 * grid wrapper required).
 */
export default function RecentCompact({ events, onViewAll }) {
  const top = (events ?? []).slice(0, 4);
  const isEmpty = top.length === 0;

  return (
    <section className="card flex flex-col gap-3.5" aria-labelledby="recent-compact-heading">
      <div className="flex items-baseline justify-between">
        <h3 id="recent-compact-heading" className="text-xs font-bold tracking-widest uppercase text-ink-muted font-mono">
          Recent
        </h3>
        {onViewAll && !isEmpty && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            View all
          </button>
        )}
      </div>
      {isEmpty ? (
        <p className="text-sm text-ink-muted italic">
          No activity in the last 7 days — submit a report to get started.
        </p>
      ) : (
        <ol className="activity-list" aria-label="Recent activity events">
          {top.map((event) => (
            <li key={event.id} className="activity-item">
              <IconFor event={event} />
              <div className="activity-body">
                <p className="activity-title">{event.title}</p>
                <p className="activity-sub">{event.sub}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function IconFor({ event }) {
  if (event.type === 'badge') {
    const badge = BADGES[event.badgeKey];
    if (badge) {
      const BadgeIcon = badge.Icon;
      return (
        <div
          className="activity-icon"
          style={{ background: 'transparent', padding: 0, overflow: 'visible' }}
        >
          <div
            className={`badge-medal ${badge.gradient} glow`}
            style={{ '--medal-size': '32px', margin: 0 }}
          >
            <BadgeIcon className="medal-ico" size={14} strokeWidth={2.2} aria-hidden="true" />
          </div>
        </div>
      );
    }
  }
  return (
    <div className={`activity-icon ai-${event.iconVariant ?? 'success'}`}>
      <Check size={14} strokeWidth={2.4} aria-hidden="true" />
    </div>
  );
}
