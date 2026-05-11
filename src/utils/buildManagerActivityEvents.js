/**
 * buildManagerActivityEvents.js — M2 manager-scoped variant of buildActivityEvents.
 *
 * Turns team submissions into a typed event list for ActivityFeed.
 * No Firestore reads, no side effects — pure derivation.
 *
 * V1 event types: submission events only. Badge events deferred until a
 * userBadges collection with earn-timestamps exists (see M2 PR description).
 */
import { extractFields, extractTotalProductionCredit } from './extractFields';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 14;
const MAX_ITEMS = 25;

function timestampFromWeek(weekStarting) {
  if (!weekStarting) return null;
  return `${weekStarting}T12:00:00Z`;
}

/**
 * @param {Array}  ytdSubs     Submitted submission docs filtered to in-scope agents.
 * @param {Object} userMap     agentId → display name string.
 * @param {Date=}  currentDate Defaults to new Date() for testing.
 * @returns {Array} events sorted by timestamp desc, capped at 25 within last 14 days.
 */
export function buildManagerActivityEvents(ytdSubs = [], userMap = {}, currentDate = new Date()) {
  const subs = ytdSubs.filter((s) => s.status === 'submitted' && s.weekStarting);
  const cutoff = currentDate.getTime() - WINDOW_DAYS * MS_PER_DAY;

  const events = [];
  subs.forEach((sub) => {
    const ts = Date.parse(timestampFromWeek(sub.weekStarting));
    if (!Number.isFinite(ts) || ts < cutoff) return;

    const f = extractFields(sub);
    const api = extractTotalProductionCredit(sub);
    const agentId = sub.agentId ?? sub.userId ?? '';
    const agentName = userMap[agentId] ?? 'Unknown Agent';

    events.push({
      id: `mgr-submission-${sub.id ?? sub.weekStarting}-${agentId}`,
      type: 'submission',
      title: `${agentName} submitted their report`,
      sub: `$${Math.round(api).toLocaleString('en-US')} API · ${f.applicationsSold} apps · ${f.ffiConducted} FFI`,
      weekStarting: sub.weekStarting,
      timestamp: timestampFromWeek(sub.weekStarting),
      iconVariant: 'success',
      pill: { label: 'Submitted', variant: 'success' },
    });
  });

  return events
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_ITEMS);
}
