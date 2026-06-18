/**
 * migrate-floors-contactsMade-to-telContacts.mjs
 *
 * EXPAND migration: copy weeklyActivityFloors.contactsMade → telContacts
 * in each tenant's config/companyMinimums doc.
 *
 * - Targeted subfield write only (ref.update with dotted key) — all other
 *   floor keys are untouched.
 * - contactsMade is PRESERVED — this is an EXPAND, not a rename.
 * - Remove contactsMade separately after #685 is merged and verified
 *   (see FOLLOW_UPS.md § contactsMade removal contract).
 * - Idempotent: no-op if telContacts already present with the same value.
 *
 * USAGE
 *   node scripts/seed/migrate-floors-contactsMade-to-telContacts.mjs         # dry-run
 *   node scripts/seed/migrate-floors-contactsMade-to-telContacts.mjs --apply # real write
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
const DRY_RUN = !args.includes('--apply');

const DEFAULT_CONTACTS_MADE = 40; // Appendix A floor — fallback if contactsMade absent
const TENANTS = ['tatillife_south', 'tatillife_smoke'];
const db = admin.firestore();

async function migrateTenant(tenantId) {
  const ref  = db.doc(`tenants/${tenantId}/config/companyMinimums`);
  const snap = await ref.get();

  if (!snap.exists) {
    console.log(`  [${tenantId}] companyMinimums doc does not exist — skipping.`);
    return;
  }

  const floors = snap.data()?.weeklyActivityFloors;
  if (!floors) {
    console.log(`  [${tenantId}] no weeklyActivityFloors block — skipping.`);
    return;
  }

  const sourceValue = typeof floors.contactsMade === 'number'
    ? floors.contactsMade
    : DEFAULT_CONTACTS_MADE;
  const existingTel = floors.telContacts;

  console.log(`  [${tenantId}] contactsMade=${sourceValue}  telContacts(existing)=${existingTel ?? '(absent)'}`);

  if (existingTel === sourceValue) {
    console.log(`  [${tenantId}] telContacts already present and equal — no-op.`);
    return;
  }

  console.log(`  [${tenantId}] will set weeklyActivityFloors.telContacts = ${sourceValue} (contactsMade preserved)`);

  if (DRY_RUN) {
    console.log(`  [${tenantId}] DRY-RUN: no write. Re-run with --apply to migrate.`);
    return;
  }

  // Targeted dotted-key update — only sets this one subfield, all other floor keys intact.
  await ref.update({ 'weeklyActivityFloors.telContacts': sourceValue });

  // Verify
  const verified = (await ref.get()).data();
  const verTel   = verified.weeklyActivityFloors?.telContacts;
  const verMade  = verified.weeklyActivityFloors?.contactsMade;

  if (verTel !== sourceValue) {
    console.error(`  [${tenantId}] VERIFICATION FAILED — telContacts=${verTel} expected=${sourceValue}`);
    process.exit(1);
  }
  console.log(`  [${tenantId}] OK — telContacts=${verTel}  contactsMade still preserved=${verMade}`);
}

async function main() {
  console.log(`\n=== migrate-floors-contactsMade-to-telContacts mode=${DRY_RUN ? 'DRY-RUN' : 'APPLY'} ===`);
  for (const tenant of TENANTS) {
    await migrateTenant(tenant);
  }
  console.log('\n=== done ===\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
