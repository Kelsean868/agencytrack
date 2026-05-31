/**
 * submissionStreak.js — compute current + longest weekly-submission streaks
 * from an agent's submissions. Pure, no Firestore.
 *
 * Extracted from HistoryTab.jsx so the v2 dashboard Streak Pulse chip can
 * reuse the same logic without duplicating it.
 */

function getWeekStarting(s) {
  return s?.weekStarting ?? '';
}

/**
 * Returns { currentStreak, longestStreak, weeksSubmitted, atPersonalBest }.
 *
 * - currentStreak: count of consecutive submitted weeks ending at the most
 *   recent submitted week (gaps reset, current draft is ignored).
 * - longestStreak: longest run of submitted weeks anywhere in the given year.
 * - weeksSubmitted: count of submitted weeks in the year.
 * - atPersonalBest: true when currentStreak >= longestStreak && longestStreak >= 2.
 *
 * Only considers submissions in `year`. Weeks are compared by ISO date string
 * on weekStarting; a "consecutive" pair is exactly 7 days apart.
 */
export function computeSubmissionStreak(submissions, year) {
  const thisYearSubs = (submissions ?? []).filter(s =>
    getWeekStarting(s).startsWith(String(year))
  );
  const submitted = thisYearSubs.filter(s => s.status === 'submitted');

  // Longest streak — sort asc, walk
  const sortedAsc = [...thisYearSubs].sort((a, b) =>
    getWeekStarting(a).localeCompare(getWeekStarting(b))
  );
  const weekSet = new Set(submitted.map(s => s.weekStarting));
  let longest = 0;
  let curLen = 0;
  for (const s of sortedAsc) {
    if (weekSet.has(s.weekStarting)) {
      curLen++;
      longest = Math.max(longest, curLen);
    } else {
      curLen = 0;
    }
  }

  // Current streak — most-recent submitted backward
  const sortedDesc = [...submitted].sort((a, b) =>
    getWeekStarting(b).localeCompare(getWeekStarting(a))
  );
  let current = 0;
  if (sortedDesc.length > 0) {
    current = 1;
    for (let i = 1; i < sortedDesc.length; i++) {
      const prev = new Date(sortedDesc[i - 1].weekStarting + 'T12:00:00Z');
      const curr = new Date(sortedDesc[i].weekStarting + 'T12:00:00Z');
      const diffDays = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
      if (diffDays === 7) current++;
      else break;
    }
  }

  return {
    currentStreak: current,
    longestStreak: longest,
    weeksSubmitted: submitted.length,
    atPersonalBest: current >= longest && longest >= 2,
  };
}
