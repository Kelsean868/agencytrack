/**
 * Preview Test Data Sweep — PR-F Phase 4.
 *
 * DRY-RUN ONLY.  Enumerates every Firestore doc path and Auth UID that
 * would be deleted by wipe-test-data-sweep.mjs.  Never modifies anything.
 *
 * USAGE
 *   # Email-pattern mode — sweeps all *@agencytrack.test users
 *   node scripts/cleanup/preview-test-data-sweep.mjs --mode=email-pattern
 *
 *   # Batch mode — sweeps only docs stamped with a specific testDataBatchId
 *   node scripts/cleanup/preview-test-data-sweep.mjs --mode=batch --batch-id <uuid>
 *
 * MODES
 *   --mode=email-pattern
 *     Lists all Auth users whose email ends with @agencytrack.test, derives
 *     their UIDs, and enumerates associated Firestore docs.
 *     Use this after the manual runbook import path (users created via
 *     BulkImportUsersModal will not carry testDataBatchId).
 *
 *   --mode=batch --batch-id <uuid>
 *     Lists Firestore docs where testDataBatchId === <uuid> plus Auth users
 *     whose email ends with @agencytrack.test (Auth has no field filter).
 *     NOTE: batch mode is only complete for the smoke-test path where ALL
 *     docs (including users and goals) were written via Admin SDK.
 *
 * OUTPUT
 *   Stdout + verification/cleanup-preview-<timestamp>.log
 *
 * REQUIREMENTS
 *   functions/service-account-key.json
 *   CLEANUP_ALLOWED_TENANTS env var must include the target tenant
 *   (checked at runtime — exits 1 if unset or missing the tenant).
 */

import { createRequire }    from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { existsSync, mkdirSync, appendFileSync } from 'fs';

import { TENANT_ID, EMAIL_SUFFIX } from '../seed/test-roster.mjs';

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
const mode    = argValue(args, 'mode');
const batchId = argValue(args, 'batch-id');

if (!mode || !['email-pattern', 'batch'].includes(mode)) {
  console.error('ERROR: --mode=email-pattern or --mode=batch required.');
  process.exit(1);
}
if (mode === 'batch' && !batchId) {
  console.error('ERROR: --mode=batch requires --batch-id <uuid>.');
  process.exit(1);
}

// ── Guards ────────────────────────────────────────────────────────────────────

const allowedTenants = (process.env.CLEANUP_ALLOWED_TENANTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
if (!allowedTenants.includes(TENANT_ID)) {
  console.error(`ABORT: CLEANUP_ALLOWED_TENANTS is not set or does not include "${TENANT_ID}".`);
  console.error(`  Set: $env:CLEANUP_ALLOWED_TENANTS = "${TENANT_ID}"`);
  process.exit(1);
}

// ── Admin SDK init ────────────────────────────────────────────────────────────

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
const db   = admin.firestore();
const auth = admin.auth();

// ── Log setup ─────────────────────────────────────────────────────────────────

const ts      = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const logDir  = resolve(ROOT, 'verification');
mkdirSync(logDir, { recursive: true });
const logPath = resolve(logDir, `cleanup-preview-${ts}.log`);
function log(msg) { console.log(msg); appendFileSync(logPath, msg + '\n'); }

// ── Auth sweep ────────────────────────────────────────────────────────────────

async function listTestAuthUsers() {
  const testUsers = [];
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    for (const u of result.users) {
      if (u.email && u.email.toLowerCase().endsWith(EMAIL_SUFFIX)) {
        testUsers.push({ uid: u.uid, email: u.email });
      }
    }
    pageToken = result.pageToken;
  } while (pageToken);
  return testUsers;
}

// ── Email guard — abort if any candidate email is outside the safe pattern ────

function assertEmailsAreSafe(users) {
  for (const u of users) {
    if (!u.email.toLowerCase().endsWith(EMAIL_SUFFIX)) {
      console.error(`ABORT: candidate user "${u.email}" does not match *${EMAIL_SUFFIX}.`);
      console.error('       This is a hard safety guard. Aborting without any deletions.');
      process.exit(1);
    }
  }
}

// ── Firestore enumeration helpers ─────────────────────────────────────────────

async function enumByUids(uids) {
  const paths = [];
  for (const uid of uids) {
    // Submissions
    const subSnap = await db.collection(`tenants/${TENANT_ID}/submissions`)
      .where('agentId', '==', uid).select().get();
    subSnap.forEach((d) => paths.push(d.ref.path));

    // Persistency
    const perSnap = await db.collection(`tenants/${TENANT_ID}/persistency`)
      .where('agentId', '==', uid).select().get();
    perSnap.forEach((d) => paths.push(d.ref.path));

    // Daily activity subcollection
    const dailySnap = await db.collection(`tenants/${TENANT_ID}/users/${uid}/dailyActivity`).select().get();
    dailySnap.forEach((d) => paths.push(d.ref.path));

    // Goals
    const goalRef = db.doc(`tenants/${TENANT_ID}/goals/${uid}`);
    const goalSnap = await goalRef.get();
    if (goalSnap.exists) paths.push(goalRef.path);

    // Notifications
    const notifSnap = await db.collection(`tenants/${TENANT_ID}/notifications`)
      .where('userId', '==', uid).select().get();
    notifSnap.forEach((d) => paths.push(d.ref.path));

    // Settlements
    const settSnap = await db.collection(`tenants/${TENANT_ID}/settlements`)
      .where('agentId', '==', uid).select().get();
    settSnap.forEach((d) => paths.push(d.ref.path));

    // Leaderboard
    const lbRef = db.doc(`tenants/${TENANT_ID}/leaderboard/${uid}`);
    const lbSnap = await lbRef.get();
    if (lbSnap.exists) paths.push(lbRef.path);

    // User doc
    const userRef = db.doc(`tenants/${TENANT_ID}/users/${uid}`);
    const userSnap = await userRef.get();
    if (userSnap.exists) paths.push(userRef.path);

    // auditAdminCreations
    const auditSnap = await db.collection('auditAdminCreations')
      .where('createdUid', '==', uid).select().get();
    auditSnap.forEach((d) => paths.push(d.ref.path));
  }

  // Campaigns containing any of the test agent UIDs
  const campSnap = await db.collection(`tenants/${TENANT_ID}/campaigns`).get();
  for (const doc of campSnap.docs) {
    const agentIds = doc.data().scope?.agentIds ?? [];
    if (uids.some((uid) => agentIds.includes(uid))) {
      paths.push(doc.ref.path);
    }
  }

  return paths;
}

async function enumByBatchId(bid) {
  const paths = [];
  const colls = [
    `tenants/${TENANT_ID}/submissions`,
    `tenants/${TENANT_ID}/persistency`,
    `tenants/${TENANT_ID}/goals`,
    `tenants/${TENANT_ID}/notifications`,
    `tenants/${TENANT_ID}/settlements`,
    `tenants/${TENANT_ID}/leaderboard`,
    `tenants/${TENANT_ID}/campaigns`,
    `tenants/${TENANT_ID}/users`,
  ];
  for (const coll of colls) {
    const snap = await db.collection(coll)
      .where('testDataBatchId', '==', bid).select().get();
    snap.forEach((d) => paths.push(d.ref.path));
  }
  return paths;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log(`\nPreview Test Data Sweep — ${mode.toUpperCase()} mode`);
  log('='.repeat(60));
  log(`Tenant:   ${TENANT_ID}`);
  log(`Mode:     ${mode}`);
  if (batchId) log(`Batch ID: ${batchId}`);
  log('');

  // Auth sweep — always by email pattern
  log('Auth users (*@agencytrack.test):');
  const testUsers = await listTestAuthUsers();
  assertEmailsAreSafe(testUsers);

  if (testUsers.length === 0) {
    log('  (none found)');
  } else {
    testUsers.forEach((u) => log(`  UID=${u.uid}  email=${u.email}`));
  }
  log(`  Total: ${testUsers.length}`);

  // Firestore enumeration
  log('\nFirestore paths to delete:');
  const uids = testUsers.map((u) => u.uid);

  let paths;
  if (mode === 'batch') {
    paths = await enumByBatchId(batchId);
    log(`  (batch mode: docs where testDataBatchId="${batchId}")`);
    log('  NOTE: batch mode is smoke-only. Use --mode=email-pattern after');
    log('  the manual runbook import path (bulkImportUsers / goals modal).');
  } else {
    paths = uids.length > 0 ? await enumByUids(uids) : [];
  }

  if (paths.length === 0) {
    log('  (none found)');
  } else {
    paths.forEach((p) => log(`  ${p}`));
  }
  log(`  Total: ${paths.length}`);

  log(`\nSummary:`);
  log(`  Auth users:       ${testUsers.length}`);
  log(`  Firestore paths:  ${paths.length}`);
  log(`  Total candidates: ${testUsers.length + paths.length}`);
  log(`\n[DRY RUN — no deletions performed]`);
  log(`Log: ${logPath}`);
}

main().catch((err) => {
  console.error('Preview sweep failed:', err);
  process.exit(1);
});
