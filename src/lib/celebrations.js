/**
 * celebrations.js — pure trigger logic for milestone celebration takeovers.
 *
 * No React, no Firestore, no localStorage. All decisions are pure functions of
 * already-loaded data so they are unit-testable in isolation and safe to run in
 * a fire-and-forget path (a save is always committed before these are consulted).
 *
 * Two surfaces consume this:
 *   • Daily Capture (DailyCaptureV2) — a daily-log streak crossing a milestone.
 *   • Goals tab (AgentDashboard)     — annual commitment hit / weekly-target
 *                                       streak crossing a milestone.
 *
 * Milestone sets are exported as named constants (design intent: dailycap-
 * celebrate + goals-v2-celebrate mockups).
 */

import { isAwardWeek } from '../utils/historyDerivations';

// ── Milestone sets ──────────────────────────────────────────────────────────

// Daily logging streak (consecutive logged days). The dailycap-celebrate mockup
// shows a 10-day sample; the set is the forward-compatible superset. NOTE: the
// surface's own streak (computeStreak) counts within the CURRENT logging week
// only (max ~5 working days), so today only the 5 milestone is reachable — the
// 10/20 rungs are defined for when a cross-week streak source lands (skip-logged
// in the 2.10 build notes). Fire logic below is the same regardless.
export const DAILY_STREAK_MILESTONES = Object.freeze([5, 10, 20]);

// Goals weekly-target streak (consecutive weeks clearing the weekly API target).
// goals-v2-celebrate shows an 8-week run; rungs bracket it.
export const GOALS_WEEKLY_STREAK_MILESTONES = Object.freeze([4, 8, 12]);

// ── Streak-milestone resolver (shared by daily + goals streak) ──────────────

/**
 * Decide whether a streak value crosses an un-celebrated milestone.
 *
 * `celebratedMax` is the highest milestone already celebrated for the ACTIVE
 * run (persisted per-uid). When the streak falls below it (a new run started),
 * the marker is implicitly clamped down so the run can re-celebrate — this is
 * what makes a weekly-resetting daily streak fire once PER run rather than once
 * ever, while still never re-firing the same milestone within one climb.
 *
 * @param {object}  p
 * @param {number}  p.streak         current streak value
 * @param {number}  [p.celebratedMax] highest milestone already celebrated (persisted)
 * @param {number[]}[p.milestones]    milestone rungs (ascending)
 * @returns {{ milestone: number|null, nextCelebratedMax: number }}
 *   milestone: the rung to celebrate now (highest newly-reached), or null.
 *   nextCelebratedMax: the marker value to persist after this evaluation.
 */
export function resolveStreakCelebration({
  streak,
  celebratedMax = 0,
  milestones = DAILY_STREAK_MILESTONES,
}) {
  const s = Number(streak) || 0;
  const reached = milestones.filter((m) => m <= s);
  const highestReached = reached.length ? Math.max(...reached) : 0;
  // Run-reset clamp: if the streak fell below what we'd celebrated, drop the
  // marker to the highest rung still reached (0 when none) so a fresh run fires.
  const effective = Math.min(Number(celebratedMax) || 0, highestReached);

  if (highestReached > effective) {
    return { milestone: highestReached, nextCelebratedMax: highestReached };
  }
  return { milestone: null, nextCelebratedMax: effective };
}

// ── Weekly award-streak (consecutive weeks clearing the weekly API target) ──

/**
 * Count the current run of consecutive most-recent AWARD weeks (submitted weeks
 * whose production API cleared `weeklyTarget`), 7-day-adjacent. Mirrors
 * computeSubmissionStreak's current-run walk but filtered to award weeks — the
 * honest "clearing your weekly target" signal the goals-v2 streak takeover needs.
 *
 * @param {Array<object>} submissions  agent submissions (already loaded)
 * @param {number|string} year         calendar year to scope to
 * @param {number}        weeklyTarget weekly API target (company floor)
 * @returns {number}
 */
export function currentAwardStreak(submissions, year, weeklyTarget) {
  if (!(Number(weeklyTarget) > 0)) return 0;
  const awards = (submissions ?? [])
    .filter((s) => s?.weekStarting?.startsWith(String(year)) && isAwardWeek(s, weeklyTarget))
    .sort((a, b) => b.weekStarting.localeCompare(a.weekStarting));
  if (awards.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < awards.length; i++) {
    const prev = new Date(awards[i - 1].weekStarting + 'T12:00:00Z');
    const curr = new Date(awards[i].weekStarting + 'T12:00:00Z');
    if (Math.round((prev - curr) / 86400000) === 7) streak++;
    else break;
  }
  return streak;
}

// ── Goals celebration resolver ──────────────────────────────────────────────

/**
 * Decide which Goals-surface celebration (if any) should fire, in priority
 * order: annual commitment hit → weekly-target streak. Quarter is intentionally
 * NOT resolved here — no per-quarter target exists in the goal hierarchy (only
 * an annual personal.api), so a "Q closed on goal" moment cannot be derived
 * honestly from loaded data. Skip-logged in the 2.10 build notes.
 *
 * @param {object} p
 * @param {object} p.hierarchy    goal hierarchy (personal.api = annual commitment)
 * @param {object} p.ytdTotals    { api, ... } year-to-date production
 * @param {Array}  p.submissions  agent submissions (for the streak)
 * @param {number|string} p.year  calendar year
 * @param {number} p.weeklyTarget weekly API target (company floor)
 * @param {object} p.celebrated   { annual:boolean, streakMax:number } persisted markers
 * @returns {{ type:'annual' }|{ type:'streak', milestone:number }|null}
 */
export function resolveGoalsCelebration({
  hierarchy,
  ytdTotals,
  submissions,
  year,
  weeklyTarget,
  celebrated = { annual: false, streakMax: 0 },
}) {
  // Priority 1 — annual commitment hit (the biggest moment of the year).
  const annualTarget = Number(hierarchy?.personal?.api) || 0;
  const ytdApi = Number(ytdTotals?.api) || 0;
  if (annualTarget > 0 && ytdApi >= annualTarget && !celebrated.annual) {
    return { type: 'annual' };
  }

  // Priority 2 — weekly-target streak crossing a milestone.
  const streak = currentAwardStreak(submissions, year, weeklyTarget);
  const { milestone } = resolveStreakCelebration({
    streak,
    celebratedMax: celebrated.streakMax ?? 0,
    milestones: GOALS_WEEKLY_STREAK_MILESTONES,
  });
  if (milestone) return { type: 'streak', milestone };

  return null;
}
