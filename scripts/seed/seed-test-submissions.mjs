/**
 * Seed Test Submissions — PR-F Phase 3.
 *
 * Writes 28 V2-format weekly submission docs (4 weeks × 7 agents) to
 * tenants/tatillife_south/submissions.  Doc shape is V2 (version: 2 with
 * newBusiness sub-object) so extractFields.js reads real production data
 * from the seeded docs.
 *
 * This script WRAPS synthetic-weekly-reports.mjs — it does NOT modify
 * or import from it (see docs/pr-f-discovery-notes.md § 1 for rationale).
 *
 * USAGE
 *   # Dry run (default — no writes)
 *   node scripts/seed/seed-test-submissions.mjs --batch-id <uuid>
 *
 *   # Write to Firestore
 *   node scripts/seed/seed-test-submissions.mjs --batch-id <uuid> --apply
 *
 * REQUIREMENTS
 *   functions/service-account-key.json
 *   All 7 test agents must already exist in Firestore (seeded via
 *   bulkImportUsers or the smoke script's Admin SDK path) so their
 *   UIDs can be resolved from their email addresses.
 *
 * DOC ID
 *   {agentUid}_{weekStarting}  e.g.  abc123_2026-05-04
 *
 * OUTPUT
 *   Every doc path written is logged to stdout and to
 *   verification/seed-<timestamp>.log
 */

import { createRequire }    from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { randomUUID }       from 'crypto';

import {
  TENANT_ID,
  AGENTS,
  COMMISSION_RATE_PCT,
} from './test-roster.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, '../..');

// ── CLI args ──────────────────────────────────────────────────────────────────

function argValue(args, flag) {
  const eqForm = args.find((a) => a.startsWith(`--${flag}=`));
  if (eqForm) return eqForm.slice(flag.length + 3);
  const idx = args.indexOf(`--${flag}`);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return null;
}

const args    = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const batchId = argValue(args, 'batch-id') ?? (() => { console.error('ERROR: --batch-id <uuid> required'); process.exit(1); })();

// ── Week date helpers ─────────────────────────────────────────────────────────

// Returns the most-recent N Sunday dates (YYYY-MM-DD) ending at or before today.
function getRecentSundays(n) {
  const today = new Date();
  const day   = today.getUTCDay(); // 0 = Sunday
  const lastSunday = new Date(today);
  lastSunday.setUTCDate(today.getUTCDate() - day);
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(lastSunday);
    d.setUTCDate(lastSunday.getUTCDate() - i * 7);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates; // newest first; seeder reverses for chronological order
}

const WEEK_DATES = getRecentSundays(4).reverse(); // oldest → newest

// ── Deterministic RNG (reproducible per batch) ────────────────────────────────

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0xc0ffee42);

function randInt(min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function round100(v)        { return Math.round(v / 100) * 100; }

// ── V2 report builder ─────────────────────────────────────────────────────────

function buildV2Report(agentUid, agentName, weekStarting, tenantId) {
  const roll = rng();
  let nbApps, nbApi;
  if (roll < 0.25) {
    nbApps = randInt(2, 4);
    nbApi  = round100(randInt(15000, 30000));
  } else if (roll < 0.85) {
    nbApps = randInt(1, 2);
    nbApi  = round100(randInt(5000, 15000));
  } else {
    nbApps = randInt(0, 1);
    nbApi  = nbApps ? round100(randInt(1000, 5000)) : 0;
  }

  const ffis  = randInt(1, 4);
  const cis   = Math.min(ffis, randInt(1, 3));
  const dials = randInt(40, 100);
  const rate  = COMMISSION_RATE_PCT / 100;

  const newBusiness = { apps: nbApps, api: nbApi };
  const pppIncreases = { apps: 0, apiIncrease: 0 };
  const lumpsums = { grossAmount: 0, apiCredit: 0, commission: 0 };
  const totalProductionCredit = nbApi;
  const totalCommission = round100(nbApi * rate);

  const submittedAt = new Date(weekStarting + 'T17:00:00.000Z').toISOString();

  return {
    // Identity
    agentId:   agentUid,
    userId:    agentUid,
    agentName,
    tenantId,
    weekStarting,
    status:    'submitted',
    version:   2,

    // V2 production sub-objects
    newBusiness,
    pppIncreases,
    lumpsums,
    totalProductionCredit,
    totalCommission,

    // V1 flat aliases kept for backwards compat with older dashboard reads
    applicationsSold: nbApps,
    apiSold:          nbApi,
    estimatedCommissions: totalCommission,

    // Prospecting activity
    referralCalls:       randInt(3, 15),
    coldCalls:           Math.max(0, dials - randInt(5, 20) - ffis - cis),
    followUpCalls:       randInt(2, 10),
    seminarTradeshowCalls: 0,
    serviceCalls:        0,
    qualifiedApproaches: randInt(ffis + 1, ffis + 4),
    ffisScheduled:       ffis + randInt(0, 1),
    ffiConducted:        ffis,
    solutionPresentations: Math.max(0, cis - 1),
    newCIBooked:         cis,
    oldCIBooked:         0,
    ciConducted:         cis,
    appointmentsSet:     ffis,

    // Names / leads
    prospectingLettersSent: randInt(0, 20),
    f2fAttempts: 0, f2fContacts: 0,
    referralsObtained: randInt(0, 3),
    namesFromColdCanvass: randInt(0, 5),
    namesFromSeminarsConducted: 0, namesFromSeminarsAttended: 0,
    namesFromTradeshowsConducted: 0, namesFromTradeshowsAttended: 0,
    namesFromOther: 0,

    // Service work
    hasServiceWork: false,
    serviceContacts: 0,
    premiumCollectionMeetings: 0,
    policiesReceived: 0, policiesDelivered: 0, policiesOutstanding: 0,
    withdrawalsLoans: 0, surrenders: 0, policyChanges: 0,
    annualReviews: 0, orphanReviews: 0, orphansAdopted: 0,
    reinstatementsSubmitted: 0, reinstatementAPI: 0,
    renewalPremiumsCollected: 0,

    // Hours / self-eval
    officeHours: randInt(8, 20),
    fieldHours:  randInt(15, 35),
    ratingPlanning:         randInt(3, 5),
    ratingTimeManagement:   randInt(3, 5),
    ratingSalesPerformance: randInt(3, 5),
    ratingProspecting:      randInt(3, 5),
    ratingOverall:          randInt(3, 5),
    notes: '',

    // Next-week goals
    targetAPI:      round100(nbApi * 1.1),
    targetAppsSold: Math.max(nbApps, 1),
    targetDials: 0, targetTelContacts: 0, targetF2FAttempts: 0,
    targetFFI: 0, targetCI: 0,
    goalNotes: '',

    // Metadata
    submittedAt,
    updatedAt: submittedAt,

    // PR-F test marker
    testDataBatchId: batchId,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nSeed Test Submissions — ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(60));
  console.log(`Tenant:   ${TENANT_ID}`);
  console.log(`Batch ID: ${batchId}`);
  console.log(`Weeks:    ${WEEK_DATES.join(', ')}`);
  console.log(`Agents:   ${AGENTS.length}`);
  console.log(`Expected: ${AGENTS.length * WEEK_DATES.length} docs`);

  if (DRY_RUN) {
    console.log('\n(Dry run — no writes. Add --apply to seed.)');
    process.exit(0);
  }

  // ── Init Admin SDK ──────────────────────────────────────────────────────────
  const KEY_PATH = resolve(ROOT, 'functions/service-account-key.json');
  if (!existsSync(KEY_PATH)) {
    console.error(`ERROR: service account key not found at ${KEY_PATH}`);
    process.exit(1);
  }

  const require = createRequire(import.meta.url);
  const admin   = require('../../functions/node_modules/firebase-admin');
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
  }
  const db = admin.firestore();

  // ── Resolve agent UIDs from Firestore ─────────────────────────────────────
  console.log('\nResolving agent UIDs…');
  const agentEmails = new Set(AGENTS.map((a) => a.email.toLowerCase()));
  const usersSnap = await db
    .collection(`tenants/${TENANT_ID}/users`)
    .where('role', '==', 'agent')
    .get();

  const uidByEmail = new Map();
  const nameByEmail = new Map();
  for (const doc of usersSnap.docs) {
    const d = doc.data();
    const email = (d.email ?? '').toLowerCase();
    if (agentEmails.has(email)) {
      uidByEmail.set(email, doc.id);
      nameByEmail.set(email, d.name ?? email);
    }
  }

  const missing = AGENTS.filter((a) => !uidByEmail.has(a.email.toLowerCase()));
  if (missing.length > 0) {
    console.error(`ERROR: ${missing.length} test agent(s) not found in Firestore:`);
    missing.forEach((a) => console.error(`  ${a.email}`));
    console.error('Create the test users first (BulkImportUsersModal or smoke seeder).');
    process.exit(1);
  }
  console.log(`  Resolved ${uidByEmail.size} agents.`);

  // ── Build reports ──────────────────────────────────────────────────────────
  const reports = [];
  for (const agent of AGENTS) {
    const uid  = uidByEmail.get(agent.email.toLowerCase());
    const name = nameByEmail.get(agent.email.toLowerCase());
    for (const weekStarting of WEEK_DATES) {
      reports.push({
        docId:  `${uid}_${weekStarting}`,
        report: buildV2Report(uid, name, weekStarting, TENANT_ID),
      });
    }
  }

  // ── Log setup ─────────────────────────────────────────────────────────────
  const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logDir  = resolve(ROOT, 'verification');
  mkdirSync(logDir, { recursive: true });
  const logPath = resolve(logDir, `seed-submissions-${ts}.log`);
  const log     = (msg) => { console.log(msg); appendFileSync(logPath, msg + '\n'); };

  log(`\nSeeding ${reports.length} submissions — batch ${batchId}`);

  // ── Firestore batch writes (max 400 per batch) ─────────────────────────────
  const BATCH_SIZE = 400;
  let written = 0;
  for (let i = 0; i < reports.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = reports.slice(i, i + BATCH_SIZE);
    for (const { docId, report } of chunk) {
      const ref = db.doc(`tenants/${TENANT_ID}/submissions/${docId}`);
      batch.set(ref, report);
      log(`  SET tenants/${TENANT_ID}/submissions/${docId}`);
    }
    await batch.commit();
    written += chunk.length;
  }

  log(`\n✓ ${written} submission docs written (batch ${batchId})`);
  log(`  Log: ${logPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
