// historyDerivations.js — pure per-week derivations for the History surface
// (HistoryTab). Extracted from the component so they can be unit-tested and to
// satisfy react-refresh/only-export-components. No Firestore, no React.

import { extractFields } from './extractFields';

export function getSubmissionAPI(s) {
  return parseFloat(s.apiSold) || extractFields(s).apiSold || 0;
}

// Honest per-week award signal: a SUBMITTED week whose production API meets or
// exceeds the weekly activity-floor target passed to the tab. Same criterion as
// the anchor-strip "Award weeks" count — no cross-agent leaderboard data
// (weeklyChampions) or settlements (computeAgentAwards) are loaded here, so this
// is the only honest per-week award signal derivable from the loaded data.
export function isAwardWeek(s, weeklyTarget) {
  return s.status === 'submitted' && !s.unlockedBy && weeklyTarget > 0 && getSubmissionAPI(s) >= weeklyTarget;
}

// The set of weekStarting strings forming the LONGEST consecutive-submitted run
// in the given year. Derived from already-loaded submissions (read-light) — the
// shared computeSubmissionStreak returns lengths only, so we walk here to get the
// member weeks needed for the heatmap underline.
export function longestStreakWeeks(submissions, year) {
  const subs = (submissions ?? [])
    .filter(s => s.weekStarting?.startsWith(String(year)) && s.status === 'submitted')
    .map(s => s.weekStarting)
    .sort((a, b) => a.localeCompare(b));
  let best = [];
  let run = [];
  for (let i = 0; i < subs.length; i++) {
    if (i === 0) { run = [subs[0]]; }
    else {
      const prev = new Date(subs[i - 1] + 'T12:00:00Z');
      const curr = new Date(subs[i] + 'T12:00:00Z');
      const diff = Math.round((curr - prev) / 86400000);
      if (diff === 7) run.push(subs[i]);
      else run = [subs[i]];
    }
    if (run.length > best.length) best = [...run];
  }
  return best;
}
