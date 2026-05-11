import { Check, ChevronRight } from 'lucide-react';
import { BADGES } from '../gamification/BadgeGrid';

/**
 * ActivityFeed — Design System v2 (B3)
 *
 * Renders the agent's last-7-days event list (max 25). Pure presentation;
 * derives nothing — buildActivityEvents owns shaping. Semantic <ol> for
 * screen readers; per-item <time dateTime> + aria-labelled pills.
 *
 * Visual structure lifted from mocks/concept-4-complete.html lines 1085-1132,
 * refactored to JSX with --color-* tokens via the .activity-* classes in
 * src/index.css. Mini-medal for badge events reuses B1 .badge-medal at 36px.
 */
export default function ActivityFeed({
  events,
  onViewAll,
  heading = 'Recent Activity',
  subHeading = 'Your last 7 days',
  emptyMessage = 'No activity in the last 7 days — submit a report to get started',
}) {
  const isEmpty = !events || events.length === 0;

  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="card"
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div>
          <h3
            id="recent-activity-heading"
            className="text-sm font-semibold text-ink"
          >
            {heading}
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">{subHeading}</p>
        </div>
        {onViewAll && !isEmpty && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1 py-0.5"
          >
            View all
            <ChevronRight size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      {isEmpty ? (
        <p className="text-sm text-ink-muted py-6 text-center">
          {emptyMessage}
        </p>
      ) : (
        <ol
          className="activity-list"
          aria-label="Recent activity events"
        >
          {events.map((event) => (
            <ActivityItem key={event.id} event={event} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityItem({ event }) {
  return (
    <li className="activity-item">
      <ActivityIcon event={event} />
      <div className="activity-body">
        <p className="activity-title">{event.title}</p>
        <p className="activity-sub">{event.sub}</p>
        <div className="activity-meta">
          <span className="sr-only">Status: </span>
          <span
            className={`activity-pill activity-pill-${event.pill.variant}`}
          >
            {event.pill.label}
          </span>
          <time
            className="activity-time"
            dateTime={event.timestamp}
          >
            {formatRelativeTime(event.timestamp)}
          </time>
        </div>
      </div>
    </li>
  );
}

function ActivityIcon({ event }) {
  if (event.type === 'badge') {
    const badge = BADGES[event.badgeKey];
    if (badge) {
      const BadgeIcon = badge.Icon;
      return (
        <div
          className="activity-icon"
          style={{
            background: 'transparent',
            padding: 0,
            overflow: 'visible',
          }}
        >
          <div
            className={`badge-medal ${badge.gradient} glow`}
            style={{ '--medal-size': '36px', margin: 0 }}
          >
            <BadgeIcon
              className="medal-ico"
              size={16}
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </div>
        </div>
      );
    }
  }

  // Default — submission events use the success check.
  return (
    <div className={`activity-icon ai-${event.iconVariant ?? 'success'}`}>
      <Check size={16} strokeWidth={2.4} aria-hidden="true" />
    </div>
  );
}

// "Today, 9:42 AM" / "Yesterday, 4:18 PM" / "May 4, 11:02 AM" — matches
// the mock's relative-time formatting. Falls back to ISO timestamp for
// invalid input so the <time> element still announces meaningfully.
function formatRelativeTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000
  );
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (dayDiff === 0) return `Today, ${time}`;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  const md = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${md}, ${time}`;
}
