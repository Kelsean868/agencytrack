/**
 * seed-staging.mjs — synthetic-tenant provisioner for the STAGING project.
 *
 * Seeds a fully SYNTHETIC tenant (`staging_test`) — 1 tenant_admin, 1 branch_
 * manager, 1 unit_manager, 2 agents — into agencytrack-staging. NO real Tatil
 * data ever touches this script: emails use the reserved `.test` TLD, the tenant
 * id is a hardcoded literal (`staging_test`, never env-driven), and all writes
 * are confined to `tenants/staging_test/…`.
 *
 * SAFETY GUARDS (abort before ANY write if violated):
 *   1. The staging service-account key's `project_id` MUST be `agencytrack-staging`
 *      and MUST NOT be `agencytrack-2a610` (checked BEFORE admin.initializeApp).
 *   2. The resolved Admin app project MUST be `agencytrack-staging`.
 *   Firebase service-account credentials are project-scoped, so a key bound to
 *   agencytrack-staging cannot authenticate against production by construction.
 *
 * This script has NO code path that targets production (agencytrack-2a610).
 *
 * USAGE
 *   node scripts/staging/seed-staging.mjs --dry-run   # print intent, no key needed
 *   node scripts/staging/seed-staging.mjs --apply     # execute (staging key required)
 *
 * PRE-FLIGHT for --apply
 *   1. Run scripts/staging/verify-isolation.mjs --live and confirm it PASSES.
 *   2. Place the staging service-account key at
 *      functions/service-account-key.staging.json  (gitignored — never commit).
 *   3. (Optional) Set STAGING_SEED_PASSWORD in .env.staging; else a documented
 *      default is used and the script warns.
 *
 * Schema notes: user docs carry tenantId + role + branchId; agent contractStartDate
 * is YYYY-MM-DD; config records currency TTD. No numeric value is stored as a string.
 * Submission/persistency/goal seeding (numeric-heavy) is intentionally NOT
 * re-implemented here — point the existing verified scripts/seed/*.mjs seeders at
 * staging instead (see docs/runbooks/staging-setup.md).
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { loadEnv } from '../lib/loadEnv.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

// ─────────────────────────────────────────────────────────────────────────────
// Constants — the target project + synthetic tenant are hardcoded literals.
// ─────────────────────────────────────────────────────────────────────────────
const STAGING_PROJECT = 'agencytrack-staging';
const PROD_PROJECT     = 'agencytrack-2a610';
const TENANT_ID        = 'staging_test';       // synthetic; NEVER env-driven
const BRANCH_ID        = 'staging_branch';
const SEED_ACTOR       = 'seed-staging';
const DEFAULT_PASSWORD = 'ChangeMe-Staging-2026!';

const KEY_PATH = process.env.STAGING_SA_KEY_PATH
  ? resolve(process.env.STAGING_SA_KEY_PATH)
  : resolve(REPO_ROOT, 'functions', 'service-account-key.staging.json');

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const isDryRun  = args.includes('--dry-run');
const isApply   = args.includes('--apply');
if (!isDryRun && !isApply) {
  console.error('Usage: node scripts/staging/seed-staging.mjs --dry-run | --apply');
  process.exit(1);
}
if (isDryRun && isApply) {
  console.error('--dry-run and --apply are mutually exclusive');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed password — from .env.staging, else documented default (with warning).
// ─────────────────────────────────────────────────────────────────────────────
const env = loadEnv(resolve(REPO_ROOT, '.env.staging'));
const SEED_PASSWORD = env.STAGING_SEED_PASSWORD || DEFAULT_PASSWORD;
if (!env.STAGING_SEED_PASSWORD) {
  console.warn(`[seed-staging] STAGING_SEED_PASSWORD not set — using documented default (${DEFAULT_PASSWORD}). Set it in .env.staging to override.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Synthetic role definitions. platform_admin is intentionally NOT seeded here —
// staging exercises tenant-scoped roles only.
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_DEFS = [
  {
    role: 'tenant_admin', key: 'tenant_admin', name: 'Staging Tenant Admin',
    email: 'staging-tenant-admin@agencytrack-staging.test',
    claims: () => ({ role: 'tenant_admin', tenantId: TENANT_ID, branchId: BRANCH_ID, ownedBranchIds: ['*'] }),
  },
  {
    role: 'branch_manager', key: 'branch_manager', name: 'Staging Branch Manager',
    email: 'staging-branch-manager@agencytrack-staging.test',
    claims: () => ({ role: 'branch_manager', tenantId: TENANT_ID, branchId: BRANCH_ID, ownedBranchIds: [BRANCH_ID] }),
  },
  {
    role: 'unit_manager', key: 'unit_manager', name: 'Staging Unit Manager',
    email: 'staging-unit-manager@agencytrack-staging.test',
    claims: () => ({ role: 'unit_manager', tenantId: TENANT_ID, branchId: BRANCH_ID }),
  },
  {
    role: 'agent', key: 'agent_1', name: 'Staging Agent One',
    email: 'staging-agent-1@agencytrack-staging.test',
    claims: () => ({ role: 'agent', tenantId: TENANT_ID, branchId: BRANCH_ID }),
  },
  {
    role: 'agent', key: 'agent_2', name: 'Staging Agent Two',
    email: 'staging-agent-2@agencytrack-staging.test',
    claims: () => ({ role: 'agent', tenantId: TENANT_ID, branchId: BRANCH_ID }),
  },
];

function abort(msg) {
  console.error('\n============================================================');
  console.error(`  SEED ABORTED — ${msg}`);
  console.error('============================================================');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run: print intent and exit (no key, no init, no network).
// ─────────────────────────────────────────────────────────────────────────────
if (isDryRun) {
  console.log(`\n[seed-staging] DRY-RUN  project=${STAGING_PROJECT}  tenant=${TENANT_ID}  branch=${BRANCH_ID}\n`);
  console.log('Intended operations (no writes):');
  for (const def of ROLE_DEFS) {
    console.log(`  Auth get-or-create  ${def.email}  role=${def.role}`);
    console.log(`  Claims              ${JSON.stringify(def.claims())}`);
    console.log(`  Firestore merge     tenants/${TENANT_ID}/users/<uid>  role=${def.role}`);
  }
  console.log(`  Firestore merge     tenants/${TENANT_ID}/branches/${BRANCH_ID}`);
  console.log(`  Firestore merge     tenants/${TENANT_ID}/config/settings  (currency: TTD)`);
  console.log('\n[dry-run complete — no key required, no writes performed]');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARD 1 — staging key present + project_id binding (BEFORE admin init).
// ─────────────────────────────────────────────────────────────────────────────
if (!existsSync(KEY_PATH)) {
  abort(`staging service-account key not found at:\n    ${KEY_PATH}\n  Download it from the agencytrack-staging Firebase Console (gitignored — never commit).`);
}
let keyJson;
try {
  keyJson = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
} catch (e) {
  abort(`could not parse staging key JSON at ${KEY_PATH}: ${e.message}`);
}
if (keyJson.project_id === PROD_PROJECT) {
  abort(`staging key's project_id is PRODUCTION (${PROD_PROJECT}). This is the prod key — refusing.`);
}
if (keyJson.project_id !== STAGING_PROJECT) {
  abort(`staging key's project_id is '${keyJson.project_id}', expected '${STAGING_PROJECT}'. Refusing.`);
}
console.log(`[seed-staging] GUARD 1 passed — key is bound to ${STAGING_PROJECT}.`);

// ─────────────────────────────────────────────────────────────────────────────
// Admin init with the staging key.
// ─────────────────────────────────────────────────────────────────────────────
const admin = require('../../functions/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(keyJson) });

// GUARD 2 — resolved app project must be staging.
const resolvedProject =
  admin.app().options.projectId || keyJson.project_id;
if (resolvedProject !== STAGING_PROJECT) {
  abort(`resolved Admin project is '${resolvedProject}', expected '${STAGING_PROJECT}'. Refusing.`);
}
console.log(`[seed-staging] GUARD 2 passed — Admin app project is ${resolvedProject}.`);

const db   = admin.firestore();
const auth = admin.auth();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function getOrCreateUser(email, password, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName });
    console.log(`  [auth] updated  ${email}  uid=${existing.uid}`);
    return existing.uid;
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({ email, password, displayName });
    console.log(`  [auth] created  ${email}  uid=${created.uid}`);
    return created.uid;
  }
}

function buildUserDoc(def, uid, umUid) {
  const doc = {
    uid,
    tenantId:  TENANT_ID,
    role:      def.role,
    name:      def.name,
    email:     def.email,
    branchId:  BRANCH_ID,
    active:    true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: SEED_ACTOR,
  };
  if (def.role === 'tenant_admin') {
    doc.ownedBranchIds = ['*'];
  } else if (def.role === 'branch_manager') {
    doc.ownedBranchIds = [BRANCH_ID];
  } else if (def.role === 'unit_manager') {
    doc.unitId = uid; // a unit_manager's own uid IS their unit identifier
  } else if (def.role === 'agent') {
    doc.unitId             = umUid;
    doc.agentNumber        = '';
    doc.contractStartDate  = '2024-01-01'; // YYYY-MM-DD
    doc.hasSeenWelcome     = true;
    doc.onboardingComplete = true;
  }
  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[seed-staging] APPLY  project=${STAGING_PROJECT}  tenant=${TENANT_ID}  branch=${BRANCH_ID}\n`);

  // Pass 1 — Auth + claims
  console.log('── Pass 1: Auth + claims ──');
  const uids = {};
  for (const def of ROLE_DEFS) {
    const uid = await getOrCreateUser(def.email, SEED_PASSWORD, def.name);
    await auth.setCustomUserClaims(uid, def.claims());
    console.log(`  [claims] set  ${def.key}  role=${def.role}`);
    uids[def.key] = uid;
  }
  const umUid = uids['unit_manager'];

  // Pass 2 — Firestore
  console.log('\n── Pass 2: Firestore ──');
  await db.doc(`tenants/${TENANT_ID}/branches/${BRANCH_ID}`)
    .set({ name: 'Staging Test Branch', managerId: uids['branch_manager'], isActive: true }, { merge: true });
  console.log(`  [fs] branches/${BRANCH_ID}`);

  for (const def of ROLE_DEFS) {
    const uid = uids[def.key];
    await db.doc(`tenants/${TENANT_ID}/users/${uid}`)
      .set(buildUserDoc(def, uid, umUid), { merge: true });
    console.log(`  [fs] users/${uid}  role=${def.role} (${def.key})`);
  }

  await db.doc(`tenants/${TENANT_ID}/config/settings`)
    .set({ companyName: 'Staging Test Tenant', currency: 'TTD', primaryColor: '#01696f' }, { merge: true });
  console.log(`  [fs] config/settings  (currency: TTD)`);

  console.log(`\n[seed-staging] DONE — 5 synthetic accounts provisioned in ${STAGING_PROJECT} / tenants/${TENANT_ID}`);
  console.log('Re-runnable: password sync + doc merge on every run.');
}

main().catch((err) => {
  console.error('[seed-staging] FATAL:', err.message ?? err);
  process.exit(1);
});
