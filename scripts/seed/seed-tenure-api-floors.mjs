/**
 * Seed: write tenureApiFloors (Tatil head-of-sales slide 2026-05-19) into
 * tenants/tatillife_south/config/companyMinimums.
 *
 * PROVISIONAL: the slide proved unreliable on its career-level table; tenure
 * numbers below await head-of-sales confirmation. The doc is marked with
 * `tenureApiFloorsProvisional: true` to signal that the values were not
 * cross-confirmed against a board-signed source. Re-run with corrected
 * numbers (no code change) once confirmed.
 *
 * The block is written via merge: true so existing fields on the doc
 * (annualAPI / annualApps / persistency / updatedBy / updatedAt /
 * weeklyActivityFloors) are preserved.
 *
 * Idempotent: if the existing tenureApiFloors block already deep-equals the
 * brief seed table AND the provisional flag is set, the script logs and exits
 * 0 without writing. Safe to re-run.
 *
 * USAGE
 *   node scripts/seed/seed-tenure-api-floors.mjs              # dry-run
 *   node scripts/seed/seed-tenure-api-floors.mjs --execute    # real write
 *
 * REQUIREMENTS
 *   functions/service-account-key.json (per CLAUDE.md Admin SDK pattern for
 *   dev-machine scripts — the key is gitignored and never ships in the CF
 *   deploy bundle, which uses ambient credentials).
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

// Inlined from src/utils/tenureFloors.js to keep this script dependency-free
// at the CommonJS/ESM boundary. Source of truth lives in the utility module
// — keep these in sync when changing band values.
const TENURE_API_FLOORS = Object.freeze({
  band0_lt12:    150000,
  band12_to_24:  200000,
  band25_to_36:  250000,
  band37_to_48:  300000,
  band49_to_60:  400000,
  band_gt60:     500000,
});

function floorsEqual(a, b) {
  if (!a || !b) return false;
  const keys = Object.keys(TENURE_API_FLOORS);
  return keys.every((k) => Number(a[k]) === Number(b[k]));
}

const db = admin.firestore();

async function main() {
  console.log(`[seed] mode=${DRY_RUN ? 'DRY-RUN' : 'EXECUTE'}`);
  console.log(`[seed] target: tenants/${TENANT}/config/companyMinimums`);
  console.log(`[seed] tenureApiFloors: ${JSON.stringify(TENURE_API_FLOORS)}`);
  console.log(`[seed] provisional flag will be set to true`);

  const ref = db.doc(`tenants/${TENANT}/config/companyMinimums`);
  const snap = await ref.get();
  const existing = snap.exists ? snap.data() : null;

  if (existing) {
    console.log(`[seed] doc exists. existing keys: ${Object.keys(existing).sort().join(', ')}`);
    if (existing.tenureApiFloors) {
      console.log(`[seed] existing tenureApiFloors: ${JSON.stringify(existing.tenureApiFloors)}`);
      const provisionalMatches = existing.tenureApiFloorsProvisional === true;
      if (floorsEqual(existing.tenureApiFloors, TENURE_API_FLOORS) && provisionalMatches) {
        console.log(`[seed] existing block already matches seed table AND provisional flag is set — no-op.`);
        process.exit(0);
      }
      console.log(`[seed] existing block differs from seed table (or provisional flag missing) — will overwrite.`);
    } else {
      console.log(`[seed] no tenureApiFloors block yet — will add.`);
    }
  } else {
    console.log(`[seed] doc does not exist — will create with tenureApiFloors block only.`);
  }

  if (DRY_RUN) {
    console.log(`[seed] DRY-RUN: would merge tenureApiFloors + tenureApiFloorsProvisional + updatedBy/updatedAt.`);
    console.log(`[seed] Re-run with --execute to apply.`);
    process.exit(0);
  }

  const payload = {
    tenureApiFloors: TENURE_API_FLOORS,
    tenureApiFloorsProvisional: true,
    updatedBy: 'seed:tenure-api-floors-2026-05-20',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await ref.set(payload, { merge: true });

  const verifySnap = await ref.get();
  const verified = verifySnap.data();
  console.log(`[seed] wrote doc. verified tenureApiFloors:`);
  console.log(JSON.stringify(verified.tenureApiFloors, null, 2));
  console.log(`[seed] tenureApiFloorsProvisional=${verified.tenureApiFloorsProvisional}`);
  console.log(`[seed] updatedBy=${verified.updatedBy}`);
  console.log(`[seed] preserved keys: annualAPI=${verified.annualAPI} annualApps=${verified.annualApps} persistency=${verified.persistency} weeklyActivityFloors=${!!verified.weeklyActivityFloors}`);

  if (!floorsEqual(verified.tenureApiFloors, TENURE_API_FLOORS)) {
    console.error(`[seed] VERIFICATION FAILED — written block does not match seed table.`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
