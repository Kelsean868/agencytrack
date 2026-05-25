/**
 * Seed: write ONE current-week submission for the test agent
 * (kelsean@gmail.com, UID J0j4uBqzTPcfm1IlGCPyDzo27RP2) in tenant
 * tatillife_south, weekStarting Sunday 2026-05-17.
 *
 * Purpose: exercise the WeeklyStandardCard Actual + status mapping in
 * production with a representative MIX of Met / Close / Below values.
 * Doc ID convention matches submissionService.submissionDocId():
 *   {uid}_{weekStarting}
 *
 * Idempotent: deep-equals check on the values that drive the 10 floors —
 * if existing doc already has those exact values, no-op.
 *
 * USAGE
 *   node scripts/seed/seed-weekly-floors-test-submission.mjs            # dry-run
 *   node scripts/seed/seed-weekly-floors-test-submission.mjs --execute  # write
 *
 * REQUIREMENTS
 *   functions/service-account-key.json (per existing scripts/seed/ pattern).
 *
 * CLEAR TEST DATA — agentName tagged "[test seed 2026-05-20]". Safe to
 * delete by removing the single doc at the documented path.
 *
 * Designed mix (Met/Close/Below) over floors 60/40/20/15/10/10/1/1/4800/100:
 *   #1  callsMade            = 65   (Met)    — totalTelAttempts = 25+20+15+5
 *   #2  contactsMade         = 30   (Close)  — telContacts via qualifiedApproaches=30
 *   #3  appointmentsScheduled = 14   (Close)  — appointmentsSet=14
 *   #4  interviewsKept       = 12   (Met)    — ffiConducted(7) + ciConducted(5)
 *   #5  factFindsCompleted   = 7    (Close)  — ffiConducted=7
 *   #6  closingInterviewsKept = 5   (Below)  — ciConducted=5
 *   #7  applicationsSubmitted = 1   (Met)    — newBusiness.apps=1
 *   #8  clientsSold          = 0    (Below)  — livesSold=0
 *   #9  api (TTD)            = 5000 (Met)    — newBusiness.api=5000
 *   #10 referralsNewLeads    = 75   (Close)  — totalNewNames = 20+40+15
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';

const require  = createRequire(import.meta.url);
const ROOT     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KEY_PATH = path.resolve(ROOT, 'functions/service-account-key.json');

if (!existsSync(KEY_PATH)) {
  console.error(`ERROR: service account key not found at ${KEY_PATH}`);
  process.exit(1);
}

const admin = require('../../functions/node_modules/firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
}

const args    = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');

const TENANT        = 'tatillife_south';
const AGENT_UID     = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';
const WEEK_STARTING = '2026-05-17';
const DOC_ID        = `${AGENT_UID}_${WEEK_STARTING}`;

// Submission payload — flat V2 shape per submissionService.sanitize().
const PAYLOAD = {
  // Step 2 — Telephone Activity (drives #1: totalTelAttempts derived sum)
  referralCalls:          25,
  followUpCalls:          15,
  coldCalls:              20,
  seminarTradeshowCalls:  5,
  serviceCalls:           0,
  // Step 3 — Approaches & FFI (drives #2 via fallback, #3, #5)
  qualifiedApproaches:    30,
  appointmentsSet:        14,
  ffisScheduled:          8,
  ffiConducted:           7,
  solutionPresentations:  6,
  // Step 4 — CI & Sales (drives #6, #7, #8, #9)
  newCIBooked:            3,
  oldCIBooked:            2,
  ciConducted:            5,
  livesSold:              0,
  newBusiness:  { apps: 1, api: 5000 },
  pppIncreases: { apps: 0, apiIncrease: 0 },
  lumpsums:     { grossAmount: 0, apiCredit: 0, commission: 0 },
  totalProductionCredit:  5000,
  totalCommission:        0,
  version:                2,
  // Step 5 — New Names (drives #10: totalNewNames = 7-source sum = 75)
  referralsSought:        50,
  referralsObtained:      40,
  namesFromColdCanvass:   20,
  namesFromOther:         15,
  // (seminars + tradeshows = 0)
  namesFromSeminarsConducted:   0,
  namesFromSeminarsAttended:    0,
  namesFromTradeshowsConducted: 0,
  namesFromTradeshowsAttended:  0,
  oldNamesPool:           0,
  portfolioClientsIdentified: 0,
  // Other required-by-shape fields, set to reasonable zero/empty defaults
  prospectingLettersSent: 0,
  prospectingEmailsSent:  0,
  seminarsConducted:      0,
  seminarsAttended:       0,
  tradeshowsConducted:    0,
  tradeshowsAttended:     0,
  f2fAttempts:            0,
  f2fContacts:            0,
  policiesReceived:       0,
  policiesDelivered:      0,
  policiesOutstanding:    0,
  hasServiceWork:         false,
  serviceContacts:        0,
  premiumCollectionMeetings: 0,
  withdrawalsLoans:       0,
  surrenders:             0,
  policyChanges:          0,
  annualReviews:          0,
  orphanReviews:          0,
  orphansAdopted:         0,
  reinstatementsSubmitted: 0,
  reinstatementAPI:       0,
  renewalPremiumsCollected: 0,
  officeHours:            8,
  fieldHours:             12,
  ratingPlanning:         3,
  ratingTimeManagement:   3,
  ratingSalesPerformance: 3,
  ratingProspecting:      3,
  ratingOverall:          3,
  notes:                  '',
  targetDials:            0,
  targetTelContacts:      0,
  targetF2FAttempts:      0,
  targetFFI:              0,
  targetCI:               0,
  targetAppsSold:         0,
  targetAPI:              0,
  goalNotes:              '',
};

// The 12 keys that materially drive WeeklyStandardCard. Idempotence is checked
// against these only — clerical fields (notes, ratings, hours, targets) can
// drift without re-seeding.
const FLOOR_DRIVING_KEYS = [
  'referralCalls', 'followUpCalls', 'coldCalls', 'seminarTradeshowCalls',
  'qualifiedApproaches', 'appointmentsSet',
  'ffiConducted', 'ciConducted', 'livesSold',
  'referralsObtained', 'namesFromColdCanvass', 'namesFromOther',
];

function deepEqualOnDrivers(existing) {
  if (!existing) return false;
  // newBusiness.apps / newBusiness.api compared separately.
  for (const k of FLOOR_DRIVING_KEYS) {
    if (Number(existing[k]) !== Number(PAYLOAD[k])) return false;
  }
  const eNb = existing.newBusiness || {};
  if (Number(eNb.apps) !== Number(PAYLOAD.newBusiness.apps)) return false;
  if (Number(eNb.api)  !== Number(PAYLOAD.newBusiness.api))  return false;
  return true;
}

const db = admin.firestore();

async function main() {
  console.log(`[seed] mode=${DRY_RUN ? 'DRY-RUN' : 'EXECUTE'}`);
  console.log(`[seed] target: tenants/${TENANT}/submissions/${DOC_ID}`);
  console.log(`[seed] weekStarting=${WEEK_STARTING}, agent=${AGENT_UID}`);

  // Look up agent unitId + name for the doc.
  const userSnap = await db.doc(`tenants/${TENANT}/users/${AGENT_UID}`).get();
  if (!userSnap.exists) {
    console.error(`[seed] ERROR: agent user doc not found at tenants/${TENANT}/users/${AGENT_UID}`);
    process.exit(1);
  }
  const user = userSnap.data();
  const unitId = user.unitId ?? null;
  const agentName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || 'Test Agent';
  console.log(`[seed] resolved unitId=${unitId} agentName="${agentName}"`);

  const subRef = db.doc(`tenants/${TENANT}/submissions/${DOC_ID}`);
  const subSnap = await subRef.get();
  if (subSnap.exists) {
    const existing = subSnap.data();
    console.log(`[seed] existing submission found, status=${existing.status}`);
    if (deepEqualOnDrivers(existing)) {
      console.log(`[seed] floor-driving fields already match — no-op.`);
      process.exit(0);
    }
    console.log(`[seed] existing doc differs on floor-driving fields — will overwrite.`);
  } else {
    console.log(`[seed] no existing submission for this week — will create.`);
  }

  if (DRY_RUN) {
    console.log(`[seed] DRY-RUN: would write the following floor-driving values:`);
    for (const k of FLOOR_DRIVING_KEYS) console.log(`  ${k} = ${PAYLOAD[k]}`);
    console.log(`  newBusiness.apps = ${PAYLOAD.newBusiness.apps}`);
    console.log(`  newBusiness.api  = ${PAYLOAD.newBusiness.api}`);
    console.log(`[seed] Re-run with --execute to apply.`);
    process.exit(0);
  }

  const doc = {
    ...PAYLOAD,
    userId:      AGENT_UID,
    agentId:     AGENT_UID,
    agentName:   `${agentName} [test seed 2026-05-20]`,
    unitId,
    weekStarting: WEEK_STARTING,
    status:      'submitted',
    updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await subRef.set(doc);

  const verifySnap = await subRef.get();
  const verified = verifySnap.data();
  console.log(`[seed] wrote submission. verified floor drivers:`);
  for (const k of FLOOR_DRIVING_KEYS) console.log(`  ${k} = ${verified[k]}`);
  console.log(`  newBusiness.apps = ${verified.newBusiness?.apps}`);
  console.log(`  newBusiness.api  = ${verified.newBusiness?.api}`);
  if (!deepEqualOnDrivers(verified)) {
    console.error(`[seed] VERIFICATION FAILED — written drivers do not match payload.`);
    process.exit(1);
  }
  console.log(`[seed] OK.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
