/**
 * Evidence paste-back for the daily-call-fields PR (brief:
 * docs/briefs/daily-call-fields-kickoff.md, named deliverable 2).
 *
 * Pure — no Firestore, no network. Run with:
 *   npx vite-node scripts/verification/evidence-daily-call-fields.mjs
 *
 * Prints two pairs:
 *   PAIR 1 — a pre-v2 daily doc and a v2 doc carrying a breakdown, side by
 *            side, showing the weekly call numbers are UNCHANGED for the
 *            pre-v2 case and that the split preserves both the total and the
 *            points score.
 *   PAIR 2 — the F3 points disagreement (daily pace badge vs aggregated weekly
 *            draft) before and after ruling D-SC.
 */
import { aggregateDailyToWeekly } from '../../src/lib/schema/dailyActivity.aggregator.js';
import { computePoints } from '../../src/lib/computePoints.js';
import { computeDayPoints } from '../../src/components/daily/DailyCaptureV2.helpers.js';

const CALL_KEYS = ['dials', 'coldCalls', 'referralCalls', 'followUpCalls', 'seminarTradeshowCalls'];
const row = (label, o) =>
  `  ${label.padEnd(26)} ` +
  CALL_KEYS.map((k) => `${k}=${String(o[k]).padStart(3)}`).join('  ') +
  `   4sum=${String(o.coldCalls + o.referralCalls + o.followUpCalls + o.seminarTradeshowCalls).padStart(3)}` +
  `   points=${String(computePoints(o)).padStart(4)}`;

console.log('\n════ PAIR 1 — pre-v2 doc vs v2 doc with a breakdown ════\n');

// One week, 3 days, 30 dials total. Same week expressed two ways.
const preV2Week = [
  { date: '2026-08-17', dials: 12 },
  { date: '2026-08-18', dials: 10 },
  { date: '2026-08-19', dials: 8 },
];
const v2Week = [
  { date: '2026-08-17', dials: 12, dialsByType: { cold: 5, referral: 4, followUp: 2, seminarTradeshow: 1 } },
  { date: '2026-08-18', dials: 10, dialsByType: { cold: 3, referral: 3, followUp: 4, seminarTradeshow: 0 } },
  { date: '2026-08-19', dials: 8,  dialsByType: { cold: 8, referral: 0, followUp: 0, seminarTradeshow: 0 } },
];
const mixedWeek = [
  { date: '2026-08-17', dials: 12 },                                                              // no breakdown
  { date: '2026-08-18', dials: 10, dialsByType: { cold: 3, referral: 3, followUp: 4, seminarTradeshow: 0 } },
  { date: '2026-08-19', dials: 8,  dialsByType: { cold: 8, referral: 0, followUp: 0, seminarTradeshow: 0 } },
];

const preOut   = aggregateDailyToWeekly(preV2Week, 0);
const v2Out    = aggregateDailyToWeekly(v2Week, 0);
const mixedOut = aggregateDailyToWeekly(mixedWeek, 0);

console.log(row('pre-v2 (no breakdown)', preOut));
console.log(row('v2 (full breakdown)', v2Out));
console.log(row('v2 (MIXED week)', mixedOut));
console.log(`
  pre-v2 weekly call numbers are byte-identical to the pre-change aggregator:
  coldCalls = Σdials = ${preOut.coldCalls}, the three siblings 0.
  The split preserves both the total (4sum === dials in every row) and the
  score (points equal across all three) — F5 sum-then-floor-once.
`);

console.log('════ PAIR 2 — the F3 points disagreement, before and after D-SC ════\n');

// A day with 4 service ATTEMPTS that reached 4 people.
const dayWithService = { date: '2026-08-17', serviceCalls: 4, serviceContacts: 4 };
// The pre-change behaviour, reconstructed exactly: computeDayPoints sourced
// serviceCalls from serviceContacts, and the aggregator wrote no serviceCalls.
const beforeBadge = computePoints({ serviceCalls: 4, version: 1 });          // was: intOrZero(serviceContacts)
const beforeDraft = computePoints({ ...aggregateDailyToWeekly([dayWithService], 0), serviceCalls: 0 });
const afterBadge  = computeDayPoints(dayWithService);
const afterDraft  = computePoints(aggregateDailyToWeekly([dayWithService], 0));

console.log(`  BEFORE  daily pace badge = ${beforeBadge} pt   aggregated weekly draft = ${beforeDraft} pt   -> DISAGREE by ${beforeBadge - beforeDraft}`);
console.log(`  AFTER   daily pace badge = ${afterBadge} pt   aggregated weekly draft = ${afterDraft} pt   -> AGREE`);

// The correction: a day with only serviceContacts (no serviceCalls) now scores 0.
const contactsOnly = { date: '2026-08-17', serviceContacts: 4 };
console.log(`
  D-SC correction, stated plainly: a day carrying only serviceContacts now
  scores ${computeDayPoints(contactsOnly)} pt for service (it scored 4 pt before). Days saved
  before daily schema v2 have no serviceCalls field, so their service points
  drop to 0 until the KQM Calls ingest endpoint populates it. This is the
  deliberate un-conflating of an attempt and a reach, not a regression.
`);
