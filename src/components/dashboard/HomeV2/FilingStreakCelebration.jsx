import React, { useEffect, useState } from 'react';
import CelebrationTakeover from '../../ui/CelebrationTakeover';
import { useCountUp } from '../../../hooks/useCountUp';
import { computeSubmissionStreak } from '../../../utils/submissionStreak';
import {
  resolveStreakCelebration,
  FILING_WEEKLY_STREAK_MILESTONES,
} from '../../../lib/celebrations';
import {
  getFilingStreakCelebratedMax,
  setFilingStreakCelebratedMax,
} from '../../../lib/celebrationPrefs';

/**
 * FilingStreakCelebration — milestone takeover for the agent's weekly FILING
 * streak (consecutive weeks with a submitted weekly report, the value the home
 * PulseStrip already shows via computeSubmissionStreak.currentStreak).
 *
 * Fires on LOAD of the home surface that owns the streak display — the home is
 * a passive display with no save event of its own, so it mirrors the Goals
 * weekly-streak takeover (fire-on-load, persist the per-year marker so each
 * milestone fires ONCE, never re-firing on reload) rather than the Daily
 * save-triggered path. The shared resolveStreakCelebration resolver and the
 * shared CelebrationTakeover primitive keep this consistent with both.
 *
 * Rendered inside HomeV2 (not a new surface); returns null until a milestone
 * crosses, so it costs nothing on the common path.
 */
export default function FilingStreakCelebration({ allSubmissions, agentUid, year }) {
  const [celebration, setCelebration] = useState(null);

  useEffect(() => {
    if (!agentUid) return;
    try {
      const { currentStreak } = computeSubmissionStreak(allSubmissions ?? [], year);
      const celebratedMax = getFilingStreakCelebratedMax(agentUid, year);
      const { milestone } = resolveStreakCelebration({
        streak: currentStreak,
        celebratedMax,
        milestones: FILING_WEEKLY_STREAK_MILESTONES,
      });
      if (!milestone) return;
      // Persist BEFORE showing so a reload can never re-fire the same rung.
      setFilingStreakCelebratedMax(agentUid, year, milestone);
      setCelebration({ milestone, streak: currentStreak });
    } catch (err) {
      // A celebration marker must never break the home render.
      console.error('Filing-streak celebration evaluation failed:', err);
    }
  }, [allSubmissions, agentUid, year]);

  if (!celebration) return null;
  return (
    <FilingStreakTakeover
      milestone={celebration.milestone}
      streak={celebration.streak}
      onClose={() => setCelebration(null)}
    />
  );
}

/** Filing-streak milestone takeover. Owns its count-up hook so the shared
 *  CelebrationTakeover primitive stays presentational. */
function FilingStreakTakeover({ milestone, streak, onClose }) {
  const shownStreak = useCountUp(streak, { duration: 900, decimals: 0 });
  return (
    <CelebrationTakeover
      open
      onClose={onClose}
      medal="flame"
      accent="warning"
      eyebrow={`FILING STREAK · ${milestone} WEEKS`}
      title={<>{milestone} weeks.<br />Every report in.</>}
      body={`${milestone} straight weeks with your weekly report filed — showing up every week is the habit the whole number is built on.`}
      stats={[{ label: 'WEEK STREAK', value: String(shownStreak), highlight: true }]}
      primaryCta={{ label: 'Keep the streak alive', onClick: onClose }}
      confettiColors={['gold', 'warning', 'primary']}
      testId="filing-streak-celebration"
      labelId="filing-streak-celebration-title"
    />
  );
}
