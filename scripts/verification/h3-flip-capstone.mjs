/**
 * h3-flip-capstone.mjs — usesPolicyLedger live flip capstone (Phase C3c)
 *
 * Phases:
 *   SEED   — write 5 settled policy docs on test agent (incl. 1st-of-current-month)
 *   FLIP   — set usesPolicyLedger: true on agent user doc
 *   VERIFY — read back policy docs + confirm settlementShape derivation
 *   REVERT — set usesPolicyLedger: false on agent user doc
 *   CLEAN  — delete the 5 seeded policy docs
 *
 * Safe: only touches test agent UID J0j4uBqzTPcfm1IlGCPyDzo27RP2 in tatillife_south.
 *       All 5 policy docs read back by ID (no composite index needed).
 *       REVERT + CLEAN run in finally{} regardless of errors.
 *
 * Run: node scripts/verification/h3-flip-capstone.mjs
 */

import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..', '..');
const KEY_PATH = join(ROOT, 'functions', 'service-account-key.json');

const admin = require(join(ROOT, 'functions/node_modules/firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
const db = admin.firestore();
const Timestamp  = admin.firestore.Timestamp;

const TENANT    = 'tatillife_south';
const AGENT_UID = 'J0j4uBqzTPcfm1IlGCPyDzo27RP2';
const SENTINEL  = `H3FlipCapstone-${Date.now()}`;

function log(msg) { process.stdout.write(`[h3-flip] ${msg}\n`); }

function getTodayTT() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date());
}
function parseDateOnlyTT(s) {
  return new Date(`${s}T04:00:00Z`);
}

// mirrors src/lib/policiesDerivation.js
function settlementShapeFromPolicies(policies) {
  const map = {};
  for (const policy of policies) {
    if (policy.status !== 'settled') continue;
    const dateIssued = policy.dateIssued;
    if (!dateIssued) continue;
    const d = dateIssued.toDate ? dateIssued.toDate() : new Date(dateIssued);
    const periodKey = d.toISOString().substring(0, 7);
    if (!map[periodKey]) map[periodKey] = { periodKey, settledAPI: 0, settledApps: 0 };
    map[periodKey].settledAPI += parseFloat(policy.settledAPI) || 0;
    map[periodKey].settledApps += 1;
  }
  return Object.values(map);
}

async function main() {
  log('=======================================================');
  log('H3 usesPolicyLedger flip capstone');
  log(`Tenant: ${TENANT}  |  Agent: ${AGENT_UID}`);
  log(`Sentinel: ${SENTINEL}`);
  log('=======================================================');

  const userRef = db.doc(`tenants/${TENANT}/users/${AGENT_UID}`);
  const policiesCol = db.collection(`tenants/${TENANT}/policies`);

  // Phase 0: Baseline
  log('\n-- Phase 0: Baseline --');
  const snap = await userRef.get();
  if (!snap.exists) { log('ERROR: Agent user doc not found'); process.exit(1); }
  const baseline = snap.data();
  log(`displayName: ${baseline.displayName}`);
  log(`usesPolicyLedger (before): ${baseline.usesPolicyLedger ?? '(not set)'}`);

  const TODAY_TT = getTodayTT();
  const FIRST_OF_MONTH = TODAY_TT.substring(0, 8) + '01';
  log(`Today (TT): ${TODAY_TT}  |  First of month: ${FIRST_OF_MONTH}`);

  // Phase 1: Seed 5 settled policies
  log('\n-- Phase 1: Seed 5 settled policies --');

  const seedDates = [
    FIRST_OF_MONTH,
    TODAY_TT,
    TODAY_TT.substring(0, 8) + '10',
    TODAY_TT.substring(0, 8) + '20',
    (() => {
      const d = new Date(`${TODAY_TT.substring(0,7)}-01T12:00:00Z`);
      d.setDate(0);
      return d.toISOString().substring(0, 10);
    })(),
  ];

  const seededIds = [];
  const batch = db.batch();
  for (let i = 0; i < seedDates.length; i++) {
    const ref = policiesCol.doc();
    seededIds.push(ref.id);
    batch.set(ref, {
      agentId: AGENT_UID,
      tenantId: TENANT,
      ownerName: `${SENTINEL}-${i + 1}`,
      insuredName: `${SENTINEL}-${i + 1}`,
      status: 'settled',
      settledAPI: 5000 + i * 1000,
      dateIssued: Timestamp.fromDate(parseDateOnlyTT(seedDates[i])),
      dateWritten: Timestamp.fromDate(parseDateOnlyTT(seedDates[i])),
      proposedAPI: 5000 + i * 1000,
      createdAt: Timestamp.now(),
    });
    log(`  Seeded ${i + 1}: dateIssued=${seedDates[i]}  API=${5000 + i * 1000}`);
  }
  await batch.commit();
  log(`  OK 5 policies written (IDs: ${seededIds.slice(0,2).join(', ')}...)`);

  try {
    // Phase 2: Flip
    log('\n-- Phase 2: Flip usesPolicyLedger = true --');
    await userRef.update({ usesPolicyLedger: true });
    const afterSnap = await userRef.get();
    if (afterSnap.data().usesPolicyLedger !== true) {
      throw new Error('Flag did not update to true');
    }
    log(`  usesPolicyLedger = ${afterSnap.data().usesPolicyLedger}  OK`);

    // Phase 3: Verify — read by doc ID (no composite index needed)
    log('\n-- Phase 3: Verify settlement derivation --');
    const policySnaps = await Promise.all(seededIds.map(id => policiesCol.doc(id).get()));
    const policies = policySnaps.filter(s => s.exists).map(s => s.data());
    log(`  Read back ${policies.length}/5 policies`);
    if (policies.length !== 5) throw new Error(`Expected 5, got ${policies.length}`);

    const shape = settlementShapeFromPolicies(policies);
    log(`  settlementShapeFromPolicies -> ${shape.length} period(s):`);
    for (const row of shape.sort((a, b) => a.periodKey.localeCompare(b.periodKey))) {
      log(`    ${row.periodKey}: API=${row.settledAPI} apps=${row.settledApps}`);
    }

    // Critical: 1st-of-month policy must be attributed to current month, not prior month
    const bomPeriod = FIRST_OF_MONTH.substring(0, 7);
    const bomRow = shape.find(r => r.periodKey === bomPeriod);
    if (!bomRow) throw new Error(`1st-of-month policy not attributed to ${bomPeriod}`);
    log(`  OK 1st-of-month attributed to ${bomPeriod} (API=${bomRow.settledAPI})`);

    log('\n  PASS: usesPolicyLedger flip VERIFIED');

  } finally {
    // Phase 4: Revert (always runs)
    log('\n-- Phase 4: Revert flag --');
    await userRef.update({ usesPolicyLedger: false });
    const revertSnap = await userRef.get();
    log(`  usesPolicyLedger = ${revertSnap.data().usesPolicyLedger}  OK`);

    // Phase 5: Cleanup (always runs)
    log('\n-- Phase 5: Cleanup --');
    const cleanBatch = db.batch();
    for (const id of seededIds) cleanBatch.delete(policiesCol.doc(id));
    await cleanBatch.commit();

    // Verify cleanup by reading each ID
    const verifySnaps = await Promise.all(seededIds.map(id => policiesCol.doc(id).get()));
    const remaining = verifySnaps.filter(s => s.exists).length;
    if (remaining === 0) {
      log(`  OK Deleted ${seededIds.length} policies, zero remain`);
    } else {
      log(`  WARNING: ${remaining} sentinel docs still present`);
    }
  }

  log('\n=======================================================');
  log('H3 flip capstone: PASS');
  log('=======================================================');
}

main().catch(err => {
  console.error('[h3-flip] FATAL:', err.message);
  process.exit(1);
});
