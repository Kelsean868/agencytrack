import React from 'react';
import { ChevronRight } from 'lucide-react';
import { FOCUS, SKELETON } from '../money/moneyParts';

/**
 * PURE view of the "Your badges and trophies" card on Career (R2-5, ruling R-c).
 * The badge grid moved to the Trophy room; Career keeps this pointer with the engine's own
 * count. The count is `trophyRoom(entry)` over the SAME engine doc the Trophy
 * room reads (`leaderboard/{uid}` via useMyLeaderboardEntry) — never the client
 * `computeEarnedBadges`. Awards need the policy ledger, which Career does not
 * hold (no new read), so this count is badges + levels only and says so; the
 * Trophy room adds the awards.
 */

/** `room` = trophyRoom(entry) or null while loading / on error. */
export default function CareerTrophiesCardView({ room, loading = false, error = false, onRetry, onOpen }) {
  let figure;
  if (error) {
    figure = (
      <div role="alert" className="flex flex-wrap items-center gap-3">
        <p className="text-[13px] text-ink">Your trophy count did not load.</p>
        {onRetry ? (
          <button type="button" onClick={onRetry} className={`${FOCUS} inline-flex min-h-[44px] items-center rounded-lg border border-border px-4 text-[14px] font-semibold text-ink`}>Retry</button>
        ) : null}
      </div>
    );
  } else if (loading || !room) {
    figure = <div aria-busy="true" className={`h-10 w-48 ${SKELETON}`} />;
  } else {
    const total = room.badges.length + room.levels.length;
    const earned = room.badges.filter((b) => b.earned).length + room.levels.filter((l) => l.earned).length;
    figure = (
      <div>
        <p className="font-display text-[22px] font-bold leading-tight tabular-nums text-ink" data-testid="career-trophy-count">
          {earned} of {total} earned
        </p>
        <p className="text-[12px] text-ink-muted">Badges and levels from your weekly reports. Awards are in the Trophy room.</p>
      </div>
    );
  }
  return (
    <section aria-labelledby="career-portal-achievements-heading" className="card" data-testid="career-trophies-card">
      <h3 id="career-portal-achievements-heading" className="mb-3 text-sm font-semibold text-ink">
        Your badges and trophies
      </h3>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {figure}
        <button
          type="button"
          onClick={onOpen}
          className={`${FOCUS} inline-flex min-h-[44px] items-center gap-1 rounded-lg px-1 text-[13px] font-bold text-primary`}
        >
          Open the Trophy room
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
