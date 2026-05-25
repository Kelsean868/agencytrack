import React from 'react';
import { Pencil } from 'lucide-react';

/**
 * Floating Action Button for daily activity entry (Track E).
 *
 * Visible on all agent portal screens.
 * State dot (amber): today not yet logged — reminder nudge.
 * No dot: today already logged.
 *
 * Positioning: above bottom nav (bottom-20 = 80px) + safe-area-inset.
 * Skip-day visibility deferred: depends on per-agent work schedule
 * (not yet built). Currently always visible when showDailyCTA is true.
 */
export default function DailyFAB({ onClick, todayLogged }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 w-14 h-14 flex items-center justify-center rounded-full bg-primary dark:bg-primary-dark text-white shadow-lg hover:bg-primary/90 dark:hover:bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/60 focus:ring-offset-2"
      aria-label="Log today's activity"
      data-testid="daily-fab"
    >
      <Pencil size={22} aria-hidden="true" />
      {!todayLogged && (
        <span
          className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-warning border-2 border-bg"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
