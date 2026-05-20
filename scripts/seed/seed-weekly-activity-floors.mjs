/**
 * Seed: write weeklyActivityFloors (Tatil workshop 2026-05-19 Appendix A)
 * into tenants/tatillife_south/config/companyMinimums.
 *
 * The floors block is written via merge: true so existing fields on the doc
 * (annualAPI / annualApps / persistency / updatedBy / updatedAt) are preserved.
 * `updatedBy` is overwritten with a seed sentinel and `updatedAt` is bumped
 * so `usingDefaultMinimums(minimums)` flips false post-seed.
 *
 * Idempotent: if the existing weeklyActivityFloors block already deep-equals
 * the Appendix A defaults, the script logs and exits 0 without writing.
 * Safe to re-run.
 *
 * USAGE
 *   node scripts/seed/seed-weekly-activity-floors.mjs              # dry-run
 *   node scripts/seed/seed-weekly-activity-floors.mjs --execute    # real write
 *
 * REQUIREMENTS
 *   functions/service-account-key.json (per CLAUDE.md Admin SDK pattern).
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
const TENANT  = 'tatillife_south';

// Inlined from src/utils/weeklyActivityFloors.js to keep this script
// dependency-free at the CommonJS/ESM boundary. Source of truth lives in
// the utility module — keep these in sync when changing floors.
const APPENDIX_A_FLOORS = Object.freeze({
  callsMade:             60,
  contactsMade:          40,
  appointmentsScheduled: 20,
  interviewsKept:        15,
  factFindsCompleted:    10,
  closingInterviewsKept: 10,
  applicationsSubmitted: 1,
  clientsSold:           1,
  api:                   4800,
  referralsNewLeads:     100,
});

function floorsEqual(a, b) {
  if (!a || !b) return false;
  const keys = Object.keys(APPENDIX_A_FLOORS);
  return keys.every((k) => Number(a[k]) === Number(b[k]));
}

const db = admin.firestore();

async function main() {
  console.log(`[seed] mode=${DRY_RUN ? 'DRY-RUN' : 'EXECUTE'}`);
  console.log(`[seed] target: tenants/${TENANT}/config/companyMinimums`);
  console.log(`[seed] floors: ${JSON.stringify(APPENDIX_A_FLOORS)}`);

  const ref = db.doc(`tenants/${TENANT}/config/companyMinimums`);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : null;

  if (existing) {
    console.log(`[seed] doc exists. existing keys: ${Object.keys(existing).sort().join(', ')}`);
    if (existing.weeklyActivityFloors) {
      console.log(`[seed] existing weeklyActivityFloors: ${JSON.stringify(existing.weeklyActivityFloors)}`);
      if (floorsEqual(existing.weeklyActivityFloors, APPENDIX_A_FLOORS)) {
        console.log(`[seed] existing block already matches Appendix A — no-op.`);
        process.exit(0);
      }
      console.log(`[seed] existing block differs from Appendix A — will overwrite.`);
    } else {
      console.log(`[seed] no weeklyActivityFloors block yet — will add.`);
    }
  } else {
    console.log(`[seed] doc does not exist — will create with floors block + B5 defaults.`);
  }

  if (DRY_RUN) {
    console.log(`[seed] DRY-RUN: would merge weeklyActivityFloors + updatedBy/updatedAt.`);
    console.log(`[seed] Re-run with --execute to apply.`);
    process.exit(0);
  }

  const payload = {
    weeklyActivityFloors: APPENDIX_A_FLOORS,
    updatedBy: 'seed:weekly-activity-floors-2026-05-20',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await ref.set(payload, { merge: true });

  const verifySnap = await ref.get();
  const verified = verifySnap.data();
  console.log(`[seed] wrote doc. verified weeklyActivityFloors:`);
  console.log(JSON.stringify(verified.weeklyActivityFloors, null, 2));
  console.log(`[seed] updatedBy=${verified.updatedBy}`);
  console.log(`[seed] preserved keys: annualAPI=${verified.annualAPI} annualApps=${verified.annualApps} persistency=${verified.persistency}`);

  if (!floorsEqual(verified.weeklyActivityFloors, APPENDIX_A_FLOORS)) {
    console.error(`[seed] VERIFICATION FAILED — written block does not match Appendix A.`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
