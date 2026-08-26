/**
 * Daily activity entry schema (E6 + Daily Capture v2 1a).
 *
 * One doc per agent per day. Path:
 *   tenants/{tenantId}/users/{userId}/dailyActivity/{YYYY-MM-DD}
 *
 * Field names mirror the weekly wizard's INITIAL_DATA so aggregation is a
 * direct Σ-by-same-key map (see dailyActivity.aggregator.js / sundayDailyToWeekly.js).
 * Simplifications versus the wizard:
 *
 *   - newNamesAdded is a single rollup; wizard splits names across 7 sources.
 *     Aggregator maps it to namesFromOther so the agent can re-allocate.
 *   - oldNamesWorked maps to wizard's oldNamesPool.
 *   - dials is the authoritative daily call total. v2 adds an OPTIONAL
 *     dialsByType breakdown; the aggregator maps it onto the weekly 4-call-type
 *     fields, and falls back to coldCalls = dials when no breakdown is present.
 *   - serviceCalls (attempt) is distinct from serviceContacts (reach). Only
 *     serviceCalls scores; see src/lib/schema/callRecord.js for why the two
 *     must never be the same number.
 *   - telContacts is a distinct count of phone contacts reached (Phase 1b
 *     switches extractFields from qualifiedApproaches fallback to this field).
 *   - officeHours / fieldHours aggregate into wizard Step 9. hoursWorked is a
 *     separate reflection field (journal-only, not aggregated).
 *
 * Reflection fields (hoursWorked / wins / blockers / notes) are journal-only
 * — the aggregator does NOT propagate them to the weekly draft.
 */

import { WEEKLY_REPORT_VERSION } from './weeklyReport.js';

// v2 (26 Aug 2026): adds `dialsByType` (additive call-type split — `dials`
// stays the authoritative total), `serviceCalls` (the attempt; distinct from
// `serviceContacts`, the reach) and `referralsObtained`. No migration: a v1
// doc carries none of them and aggregates to byte-identical weekly numbers.
export const DAILY_ACTIVITY_VERSION = 2;

export function createEmptyDailyEntry(date, agentId, agentName) {
  return {
    version: DAILY_ACTIVITY_VERSION,
    weeklyReportVersion: WEEKLY_REPORT_VERSION,
    date,
    weekStarting: getSundayOf(date),
    agentId,
    agentName,

    // Prospecting & outreach (Step 1 / 3 / 4 weekly targets)
    prospectingLettersSent: 0,
    seminarsConducted: 0,
    dials: 0,                 // authoritative daily call total
    // v2 additive call-type split. Written by the KQM Calls ingest endpoint,
    // never by the Daily Capture UI (an agent typing at day's end cannot know
    // the split; the calling app can). INVARIANT, property-tested: whenever any
    // bucket is non-zero, cold + referral + followUp + seminarTradeshow ===
    // dials. All-zero → the aggregator falls back to coldCalls = dials.
    dialsByType: { cold: 0, referral: 0, followUp: 0, seminarTradeshow: 0 },
    referralsObtained: 0,     // referrals produced by the day's activity (3pt weekly)
    telContacts: 0,           // distinct phone contacts reached
    f2fAttempts: 0,
    qualifiedApproaches: 0,   // legacy proxy kept; telContacts is the v2 field

    // Social (Step 4 weekly targets — live platform shape, not CD mock)
    socialPostsTotal: 0,
    socialEngagementTotal: 0,
    socialInboxEnquiries: 0,
    namesFromSocial: 0,
    socialPlatformBreakdown: { facebook: 0, instagram: 0, whatsapp: 0, linkedin: 0 },

    // Appointments & interviews (Steps 1–3)
    appointmentsSet: 0,
    ffisScheduled: 0,
    ffiConducted: 0,
    solutionPresentations: 0,
    newCIBooked: 0,
    oldCIBooked: 0,
    ciConducted: 0,

    // Production (Steps 5–7)
    newBusiness:  { apps: 0, api: 0 },
    pppIncreases: { apps: 0, apiIncrease: 0 },
    lumpsums:     { grossAmount: 0 },
    livesSold: 0,

    // Delivery & service (Step 8)
    policiesDelivered: 0,
    serviceContacts: 0,       // servicing REACHED (a contact)
    serviceCalls: 0,          // servicing ATTEMPTED (a call) — the 1pt scoring field

    // Names (Step 5)
    newNamesAdded: 0,
    oldNamesWorked: 0,

    // Hours — production tracking (Step 9); hoursWorked is reflection-only below
    officeHours: 0,
    fieldHours: 0,

    // Reflection fields — journal-only, NOT aggregated to weekly draft
    hoursWorked: null,
    wins: '',
    blockers: '',
    notes: '',

    isCatchUp: false,
    catchUpStartDate: null,
    catchUpEndDate: null,

    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Coerce a raw daily entry (from Firestore or UI state) to the v2 schema shape.
 * All numeric fields: parseFloat → NaN → 0. Nested objects handled field-by-field.
 * Non-numeric fields (strings, booleans, timestamps) are passed through as-is.
 * Returns a plain object safe to spread into saveDailyEntry.
 */
export function normalizeDailyEntry(raw = {}) {
  const p = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const pi = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
  return {
    // Prospecting & outreach
    prospectingLettersSent:  pi(raw.prospectingLettersSent),
    seminarsConducted:       pi(raw.seminarsConducted),
    dials:                   pi(raw.dials),
    dialsByType: {
      cold:             pi(raw.dialsByType?.cold),
      referral:         pi(raw.dialsByType?.referral),
      followUp:         pi(raw.dialsByType?.followUp),
      seminarTradeshow: pi(raw.dialsByType?.seminarTradeshow),
    },
    referralsObtained:       pi(raw.referralsObtained),
    telContacts:             pi(raw.telContacts),
    f2fAttempts:             pi(raw.f2fAttempts),
    qualifiedApproaches:     pi(raw.qualifiedApproaches),
    // Social
    socialPostsTotal:        pi(raw.socialPostsTotal),
    socialEngagementTotal:   pi(raw.socialEngagementTotal),
    socialInboxEnquiries:    pi(raw.socialInboxEnquiries),
    namesFromSocial:         pi(raw.namesFromSocial),
    socialPlatformBreakdown: {
      facebook:  pi(raw.socialPlatformBreakdown?.facebook),
      instagram: pi(raw.socialPlatformBreakdown?.instagram),
      whatsapp:  pi(raw.socialPlatformBreakdown?.whatsapp),
      linkedin:  pi(raw.socialPlatformBreakdown?.linkedin),
    },
    // Appointments & interviews
    appointmentsSet:         pi(raw.appointmentsSet),
    ffisScheduled:           pi(raw.ffisScheduled),
    ffiConducted:            pi(raw.ffiConducted),
    solutionPresentations:   pi(raw.solutionPresentations),
    newCIBooked:             pi(raw.newCIBooked),
    oldCIBooked:             pi(raw.oldCIBooked),
    ciConducted:             pi(raw.ciConducted),
    // Production
    newBusiness: {
      apps: pi(raw.newBusiness?.apps),
      api:  p(raw.newBusiness?.api),
    },
    pppIncreases: {
      apps:        pi(raw.pppIncreases?.apps),
      apiIncrease: p(raw.pppIncreases?.apiIncrease),
    },
    lumpsums: {
      grossAmount: p(raw.lumpsums?.grossAmount),
    },
    livesSold:          pi(raw.livesSold),
    // Delivery & service
    policiesDelivered:  pi(raw.policiesDelivered),
    serviceContacts:    pi(raw.serviceContacts),
    serviceCalls:       pi(raw.serviceCalls),
    // Names
    newNamesAdded:      pi(raw.newNamesAdded),
    oldNamesWorked:     pi(raw.oldNamesWorked),
    // Hours (production tracking)
    officeHours:        p(raw.officeHours),
    fieldHours:         p(raw.fieldHours),
  };
}

/**
 * Returns the Sunday that starts the week containing `dateStr`.
 * Sunday → same Sunday. Mon-Sat → previous Sunday.
 *
 * Date math is done in UTC against a noon anchor to avoid DST edges.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string} 'YYYY-MM-DD' (Sunday)
 */
export function getSundayOf(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - day);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * The 7 'YYYY-MM-DD' dates Sun→Sat for the week containing `dateStr`.
 *
 * Lifted here from `src/components/planner/planner.helpers.js` (which now
 * re-exports it, so existing consumers are unchanged) because `src/lib/`
 * consumers — `src/lib/activityLedger.js` among them — must not import from
 * `src/components/`. Co-located with `getSundayOf`, its only dependency.
 *
 * There is no excluded day: an agent who works a Saturday gets credit for it.
 *
 * Same UTC-noon anchor discipline as `getSundayOf` — immune to DST edges.
 *
 * @param {string} dateStr - 'YYYY-MM-DD' (any day of the target week)
 * @returns {string[]} 7 dates, Sunday first
 */
export function buildWeekDates(dateStr) {
  const sunday = getSundayOf(dateStr);
  const base = new Date(sunday + 'T12:00:00Z');
  return Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
}
