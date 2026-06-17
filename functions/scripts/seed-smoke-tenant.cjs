'use strict';

/**
 * seed-smoke-tenant.cjs — idempotent provisioner for the tatillife_smoke tenant.
 *
 * Creates 6 A11Y role accounts (Auth + Firestore) in a tenant that is
 * structurally isolated from tatillife_south — no leaderboard bleed, no
 * production roll-up contamination.
 *
 * USAGE
 *   node functions/scripts/seed-smoke-tenant.cjs --dry-run   # print intent, no writes
 *   node functions/scripts/seed-smoke-tenant.cjs --apply     # execute
 *
 * Reads credentials from .env.local (repo root) — passwords NEVER logged.
 * Re-runnable safely: get-or-create Auth, merge-write Firestore docs.
 *
 * EMULATOR (Phase 3 validation)
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *   node functions/scripts/seed-smoke-tenant.cjs --apply
 *   (key file not required when emulator env vars are set)
 *
 * OPERATOR RUN — production (HUMAN action after PR merge)
 *   1. Add A11Y_TENANT_ID=tatillife_smoke to .env.local (if not present)
 *   2. Ensure functions/service-account-key.json is present
 *   3. node functions/scripts/seed-smoke-tenant.cjs --apply
 */

const path  = require('path');
const fs    = require('fs');
const admin = require('firebase-admin');

const { loadEnv } = require('../../scripts/lib/loadEnv.cjs');
const env = loadEnv(path.resolve(__dirname, '../../.env.local'));

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const TENANT_ID  = env.A11Y_TENANT_ID ?? 'tatillife_smoke';
const BRANCH_ID  = 'smoke_branch';
const SEED_ACTOR = 'seed-smoke-tenant';

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
const cliArgs  = process.argv.slice(2);
const isDryRun = cliArgs.includes('--dry-run');
const isApply  = cliArgs.includes('--apply');

if (!isDryRun && !isApply) {
  console.error('Usage: node seed-smoke-tenant.cjs --dry-run | --apply');
  process.exit(1);
}
if (isDryRun && isApply) {
  console.error('--dry-run and --apply are mutually exclusive');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Role definitions
// Order matters: unit_manager resolved before agent (agent references UM uid).
// platform_admin is claim-only — no Firestore doc.
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_DEFS = [
  {
    role:        'platform_admin',
    emailKey:    'A11Y_PLATFORM_ADMIN_EMAIL',
    passwordKey: 'A11Y_PLATFORM_ADMIN_PASSWORD',
    name:        'Smoke Platform Admin',
    claimsOnly:  true,
    buildClaims: () => ({ role: 'platform_admin', tenantId: null }),
  },
  {
    role:        'tenant_admin',
    emailKey:    'A11Y_TENANT_ADMIN_EMAIL',
    passwordKey: 'A11Y_TENANT_ADMIN_PASSWORD',
    name:        'Smoke Tenant Admin',
    buildClaims: () => ({
      role: 'tenant_admin', tenantId: TENANT_ID, branchId: BRANCH_ID, ownedBranchIds: ['*'],
    }),
  },
  {
    role:        'sales_manager',
    emailKey:    'A11Y_SALES_MANAGER_EMAIL',
    passwordKey: 'A11Y_SALES_MANAGER_PASSWORD',
    name:        'Smoke Sales Manager',
    buildClaims: () => ({
      role: 'sales_manager', tenantId: TENANT_ID, branchId: BRANCH_ID, ownedBranchIds: ['*'],
    }),
  },
  {
    role:        'branch_manager',
    emailKey:    'A11Y_BRANCH_MANAGER_EMAIL',
    passwordKey: 'A11Y_BRANCH_MANAGER_PASSWORD',
    name:        'Smoke Branch Manager',
    buildClaims: () => ({
      role: 'branch_manager', tenantId: TENANT_ID, branchId: BRANCH_ID, ownedBranchIds: [BRANCH_ID],
    }),
  },
  {
    role:        'unit_manager',
    emailKey:    'A11Y_UNIT_MANAGER_EMAIL',
    passwordKey: 'A11Y_UNIT_MANAGER_PASSWORD',
    name:        'Smoke Unit Manager',
    buildClaims: () => ({ role: 'unit_manager', tenantId: TENANT_ID, branchId: BRANCH_ID }),
  },
  {
    role:        'agent',
    emailKey:    'A11Y_AGENT_EMAIL',
    passwordKey: 'A11Y_AGENT_PASSWORD',
    name:        'Smoke Agent',
    buildClaims: () => ({ role: 'agent', tenantId: TENANT_ID, branchId: BRANCH_ID }),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Validate env keys — platform_admin is optional (warn + skip if absent),
// all other 5 tenant-scoped roles are required.
// ─────────────────────────────────────────────────────────────────────────────
const missing = [];
for (const def of ROLE_DEFS) {
  if (def.role === 'platform_admin') continue; // optional — checked below
  if (!env[def.emailKey])    missing.push(def.emailKey);
  if (!env[def.passwordKey]) missing.push(def.passwordKey);
}
if (missing.length) {
  console.error('[seed] Missing required env keys in .env.local:', missing.join(', '));
  process.exit(1);
}
const paSkipped = !env.A11Y_PLATFORM_ADMIN_EMAIL || !env.A11Y_PLATFORM_ADMIN_PASSWORD;
if (paSkipped) {
  console.warn('[seed] A11Y_PLATFORM_ADMIN_EMAIL / _PASSWORD not set — platform_admin will be skipped');
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin SDK init — emulator-aware
// When FIREBASE_AUTH_EMULATOR_HOST or FIRESTORE_EMULATOR_HOST are set the
// Admin SDK routes to the local emulators; the key file is not required.
// ─────────────────────────────────────────────────────────────────────────────
const isEmulator = !!(process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST);

if (isEmulator) {
  console.log('[seed] Emulator mode — skipping key file');
  admin.initializeApp({ projectId: 'agencytrack-2a610' });
} else {
  const keyPath = path.join(__dirname, '..', 'service-account-key.json');
  if (!fs.existsSync(keyPath)) {
    console.error('[seed] Missing service-account-key.json at', keyPath);
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
}

if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('[seed] Firestore emulator:', process.env.FIRESTORE_EMULATOR_HOST);
}
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.log('[seed] Auth emulator:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

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
    tenantId:     TENANT_ID,
    role:         def.role,
    name:         def.name,
    email:        env[def.emailKey],
    branchId:     BRANCH_ID,
    active:       true,
    provisioning: true,
    createdAt:    admin.firestore.FieldValue.serverTimestamp(),
    createdBy:    SEED_ACTOR,
  };

  if (def.role === 'tenant_admin' || def.role === 'sales_manager') {
    doc.ownedBranchIds = ['*'];
  } else if (def.role === 'branch_manager') {
    doc.ownedBranchIds = [BRANCH_ID];
  } else if (def.role === 'unit_manager') {
    // unit_manager's own uid IS their unit identifier (mirrors buildDocFields)
    doc.unitId = uid;
  } else if (def.role === 'agent') {
    doc.unitId             = umUid;
    doc.agentNumber        = '';
    doc.contractStartDate  = '2024-01-01';
    // Override buildDocFields defaults so smoke lands on dashboard, not wizard
    doc.hasSeenWelcome     = true;
    doc.onboardingComplete = true;
  }

  return doc;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[seed-smoke-tenant]  tenant=${TENANT_ID}  branch=${BRANCH_ID}  mode=${isDryRun ? 'DRY-RUN' : 'APPLY'}\n`);

  // ── Dry-run: print intent and exit ──────────────────────────────────────────
  if (isDryRun) {
    console.log('Intended operations (no writes):');
    for (const def of ROLE_DEFS) {
      if (def.role === 'platform_admin' && paSkipped) {
      console.log(`  Auth SKIP           platform_admin (A11Y_PLATFORM_ADMIN_EMAIL not set)`);
      console.log('');
      continue;
    }
    console.log(`  Auth get-or-create  ${env[def.emailKey]}  role=${def.role}`);
      console.log(`  Claims              ${JSON.stringify(def.buildClaims())}`);
      if (def.claimsOnly) {
        console.log('  Firestore           SKIP (platform_admin is claim-only)');
      } else {
        console.log(`  Firestore merge     tenants/${TENANT_ID}/users/<uid>  role=${def.role}`);
      }
      console.log('');
    }
    console.log(`  Firestore merge     tenants/${TENANT_ID}/branches/${BRANCH_ID}`);
    console.log(`  Firestore merge     tenants/${TENANT_ID}/config/settings`);
    console.log('\n[dry-run complete — no writes performed]');
    return;
  }

  // ── Pass 1: Auth + claims ────────────────────────────────────────────────────
  console.log('── Pass 1: Auth + claims ──');
  const uids = {};
  for (const def of ROLE_DEFS) {
    if (def.role === 'platform_admin' && paSkipped) {
      console.log('  [auth] SKIP platform_admin (credentials not set)');
      continue;
    }
    const email    = env[def.emailKey];
    const password = env[def.passwordKey]; // read but never logged
    const uid = await getOrCreateUser(email, password, def.name);
    await auth.setCustomUserClaims(uid, def.buildClaims());
    console.log(`  [claims] set  role=${def.role}`);
    uids[def.role] = uid;
  }

  const umUid = uids['unit_manager'];

  // ── Pass 2: Firestore ────────────────────────────────────────────────────────
  console.log('\n── Pass 2: Firestore ──');

  // Branch doc — uses isActive (matches branchService.js query field)
  await db
    .doc(`tenants/${TENANT_ID}/branches/${BRANCH_ID}`)
    .set({ name: 'Smoke Test Branch', managerId: uids['branch_manager'], isActive: true }, { merge: true });
  console.log(`  [fs] branches/${BRANCH_ID}`);

  // User docs (platform_admin skipped — claim-only)
  for (const def of ROLE_DEFS) {
    if (def.claimsOnly) {
      console.log(`  [fs] SKIP ${def.role} (claim-only)`);
      continue;
    }
    const uid     = uids[def.role];
    const docData = buildUserDoc(def, uid, umUid);
    await db
      .doc(`tenants/${TENANT_ID}/users/${uid}`)
      .set(docData, { merge: true });
    console.log(`  [fs] users/${uid}  role=${def.role}`);
  }

  // Optional tenant label (absent config/settings does not break the app)
  await db
    .doc(`tenants/${TENANT_ID}/config/settings`)
    .set({ companyName: 'Smoke Test Tenant', primaryColor: '#01696f' }, { merge: true });
  console.log(`  [fs] config/settings`);

  console.log(`\n[seed-smoke-tenant] DONE — 6 accounts provisioned in ${TENANT_ID}`);
  console.log('Re-runnable: password sync + doc reset on every run.');
}

main().catch((err) => {
  console.error('[seed-smoke-tenant] FATAL:', err.message ?? err);
  process.exit(1);
});
