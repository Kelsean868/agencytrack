/**
 * buildActivityEvents.js — Design System v2 (B3 activity feed)
 *
 * Pure derivation: turns already-loaded submissions + earned-badge keys
 * into a typed event list for ActivityFeed. No Firestore reads, no
 * external state, no side effects.
 *
 * Event types currently produced:
 *   - "submission"  — one event per submitted weekly report
 *   - "badge"       — one event per earned badge whose trigger date is
 *                     deterministically derivable from a single
 *                     qualifying submission
 *
 * Event types deferred (per B3 audit / kickoff resolutions):
 *   - "rank"        — would require new Firestore reads (leaderboard).
 *                     Locked decision "no new Firestore reads in B3" wins.
 *   - "application" — submissions carry only the weekly applicationsSold
 *                     count, never per-application records. Synthesizing
 *                     would either duplicate the submission event or
 *                     misrepresent the data.
 *   - badge events for keys without a single triggering submission
 *     (streak / MDRT / persistency badges). These have no clean
 *     "earned-on" date in the current data model — emit when a
 *     userBadges collection lands in a future PR.
 *
 * Badge keys with deterministic triggers (per single submission):
 *   - big_week        → first sub with apiSold >= 20000
 *   - top_apps_week   → first sub with applicationsSold >= 5
 *   - century_dials   → first sub with totalTelAttempts >= 100
 *
 * Output cap: max 25 items, all within the last 7 days, sorted by
 * timestamp descending.
 */

import { extractFields } from './extractFields';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;
const MAX_ITEMS = 25;

// Badges B3 emits as activity events. Mapping is deterministic: each badge
// key resolves to a predicate over a single submission's extracted fields.
// Other earned badges (streak_*, mdrt_*, consistent, dial_king, etc.) have
// no single-submission trigger and are intentionally omitted.
const BADGE_TRIGGERS = {
  big_week: {
    label: 'Big Week',
    desc: 'Over $20,000 API in a single week',
    pillVariant: 'gold',
    rarity: 'Rare',
    predicate: (f) => f.apiSold >= 20000,
  },
  top_apps_week: {
    label: 'App Machine',
    desc: '5+ applications in a single week',
    pillVariant: 'gold',
    rarity: 'Uncommon',
    predicate: (f) => f.applicationsSold >= 5,
  },
  century_dials: {
    label: 'Dialler',
    desc: '100+ dials in a single week',
    pillVariant: 'gold',
    rarity: 'Uncommon',
    predicate: (f) => f.totalTelAttempts >= 100,
  },
};

// Build an ISO-ish timestamp from a YYYY-MM-DD weekStarting string.
// Anchors at noon UTC to avoid DST/timezone edge cases when the value is
// later parsed back into a Date.
function timestampFromWeek(weekStarting) {
  if (!weekStarting) return null;
  return `${weekStarting}T12:00:00Z`;
}

function buildSubmissionEvent(submission) {
  const f = extractFields(submission);
  const ws = submission.weekStarting;
  const segments = [
    `$${Math.round(f.apiSold).toLocaleString('en-US')} in API`,
    `${f.ffiConducted} FFI`,
    `${f.ciConducted} CI`,
    `${f.applicationsSold} application${f.applicationsSold === 1 ? '' : 's'}`,
  ];
  return {
    id: `submission-${submission.id ?? ws}`,
    type: 'submission',
    title: 'Weekly report submitted',
    sub: segments.join(' · '),
    weekStarting: ws,
    timestamp: timestampFromWeek(ws),
    icon: 'check',
    iconVariant: 'success',
    pill: { label: 'Submitted', variant: 'success' },
  };
}

function buildBadgeEvent(badgeKey, triggeringSubmission) {
  const meta = BADGE_TRIGGERS[badgeKey];
  const ws = triggeringSubmission.weekStarting;
  return {
    id: `badge-${badgeKey}-${ws}`,
    type: 'badge',
    badgeKey,
    title: `New badge earned: ${meta.label}`,
    sub: meta.desc,
    weekStarting: ws,
    timestamp: timestampFromWeek(ws),
    pill: { label: `Achievement · ${meta.rarity}`, variant: meta.pillVariant },
  };
}

/**
 * @param {Array} submissions      Submission docs as loaded by AgentDashboard.
 * @param {Set<string>=} earnedBadges Earned badge keys from BadgeGrid's computeEarnedBadges.
 * @param {Date=} currentDate      Defaults to new Date() for testing.
 * @returns {Array} events sorted by timestamp desc, capped at 25 within last 7 days.
 */
export function buildActivityEvents(submissions, earnedBadges, currentDate = new Date()) {
  const events = [];
  const subs = (submissions ?? []).filter((s) => s.status === 'submitted' && s.weekStarting);

  // 1. Submission events
  subs.forEach((s) => events.push(buildSubmissionEvent(s)));

  // 2. Badge events for the three weekly-criteria badges.
  // Earliest qualifying submission wins (treats earning the badge as a
  // one-time event tied to the first submission that triggered it).
  const earned = earnedBadges instanceof Set
    ? earnedBadges
    : new Set(earnedBadges ?? []);

  Object.entries(BADGE_TRIGGERS).forEach(([key, meta]) => {
    if (!earned.has(key)) return;
    const subsAsc = [...subs].sort((a, b) => (a.weekStarting ?? '').localeCompare(b.weekStarting ?? ''));
    const trigger = subsAsc.find((s) => meta.predicate(extractFields(s)));
    if (trigger) events.push(buildBadgeEvent(key, trigger));
  });

  // 3. Filter to last 7 days and sort desc
  const cutoff = currentDate.getTime() - WINDOW_DAYS * MS_PER_DAY;
  return events
    .filter((e) => {
      const ts = e.timestamp ? Date.parse(e.timestamp) : NaN;
      return Number.isFinite(ts) && ts >= cutoff;
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_ITEMS);
}
