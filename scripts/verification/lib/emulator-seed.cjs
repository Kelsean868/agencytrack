/**
 * Emulator smoke-agent seed (Admin SDK, emulator-only).
 *
 * Creates a dedicated smoke agent in the AUTH emulator with custom claims and a
 * matching Firestore user doc, on an ISOLATED test branch/tenant. Used by the
 * emulator-backed smoke harness so every smoke runs a real log-in → write →
 * reload → assert cycle against the emulator — ZERO writes to any production
 * tenant.
 *
 * Requires the auth + firestore emulators to be running (firebase.json), and
 * firebase-admin (installed under functions/node_modules per CLAUDE.md).
 *
 * Env (set by the harness before requiring this module, or via CLI):
 *   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:9090
 *   GCLOUD_PROJECT=demo-agencytrack
 *
 * Exports: seedSmokeAgent() -> { uid, email, password, tenantId, branchId }
 * Also runnable directly: `node scripts/verification/lib/emulator-seed.cjs`
 */
'use strict';

const path = require('path');
// firebase-admin lives in functions/node_modules (canonical install path).
const admin = require(path.join(__dirname, '..', '..', '..', 'functions', 'node_modules', 'firebase-admin'));

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-agencytrack';

// Isolated smoke identity — NOT a production tenant. tatillife_south is never touched.
const SMOKE = Object.freeze({
  email: 'smoke-agent@agencytrack.test',
  password: 'smoke-pass-emulator',
  tenantId: 'demo_tenant',
  branchId: 'demo_branch_isolated',
  unitId: 'demo_unit_isolated',
  name: 'Smoke Agent',
});

function ensureEmulatorEnv() {
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:9090';
  }
  // Hard guard: refuse to run unless both emulator hosts resolve to localhost.
  const isLocal = (h) => /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(h || '');
  if (!isLocal(process.env.FIREBASE_AUTH_EMULATOR_HOST) || !isLocal(process.env.FIRESTORE_EMULATOR_HOST)) {
    throw new Error(
      `Refusing to seed: emulator hosts must be localhost. ` +
        `auth=${process.env.FIREBASE_AUTH_EMULATOR_HOST} firestore=${process.env.FIRESTORE_EMULATOR_HOST}`
    );
  }
  // Demo project id guard — demo-* projects can never reach live Firebase.
  if (!/^demo-/.test(PROJECT_ID)) {
    throw new Error(`Refusing to seed: GCLOUD_PROJECT must be a demo-* project (got "${PROJECT_ID}").`);
  }
}

async function seedSmokeAgent() {
  ensureEmulatorEnv();

  if (!admin.apps.length) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  const auth = admin.auth();
  const db = admin.firestore();

  // Create-or-reset the auth user (idempotent across re-runs).
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(SMOKE.email);
    await auth.updateUser(userRecord.uid, { password: SMOKE.password, emailVerified: true });
  } catch (e) {
    if (e && e.code === 'auth/user-not-found') {
      userRecord = await auth.createUser({
        email: SMOKE.email,
        password: SMOKE.password,
        emailVerified: true,
        displayName: SMOKE.name,
      });
    } else {
      throw e;
    }
  }
  const uid = userRecord.uid;

  // Custom claims the app + rules read (role / tenantId / branchId).
  await auth.setCustomUserClaims(uid, {
    role: 'agent',
    tenantId: SMOKE.tenantId,
    branchId: SMOKE.branchId,
  });

  // Firestore user doc (load-bearing fallback for AuthContext + UM/BM scoping).
  await db
    .doc(`tenants/${SMOKE.tenantId}/users/${uid}`)
    .set(
      {
        uid,
        name: SMOKE.name,
        email: SMOKE.email,
        role: 'agent',
        tenantId: SMOKE.tenantId,
        branchId: SMOKE.branchId,
        unitId: SMOKE.unitId,
        onboardingComplete: true,
        contractStartDate: '',
        isTestAccount: true,
      },
      { merge: true }
    );

  return { uid, ...SMOKE };
}

module.exports = { seedSmokeAgent, SMOKE };

// Direct-run support.
if (require.main === module) {
  seedSmokeAgent()
    .then((r) => {
       
      console.log(JSON.stringify({ ok: true, uid: r.uid, tenantId: r.tenantId, branchId: r.branchId }, null, 2));
      process.exit(0);
    })
    .catch((e) => {
       
      console.error('SEED FAILED:', e && e.message ? e.message : e);
      process.exit(1);
    });
}
