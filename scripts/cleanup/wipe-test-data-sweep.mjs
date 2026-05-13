/**
 * Wipe Test Data Sweep — PR-F Phase 4.
 *
 * Cascade-deletes all test data in the target tenant. Requires --execute flag
 * and typed confirmation. All safety controls from brief "Decisions locked"
 * section are enforced. Returns non-zero on any guard violation.
 *
 * USAGE
 *   # Dry run (default — enumerate only, no deletion)
 *   node scripts/cleanup/wipe-test-data-sweep.mjs --mode=email-pattern
 *
 *   # Execute (destructive — deletes data)
 *   node scripts/cleanup/wipe-test-data-sweep.mjs --mode=email-pattern --execute
 *   node scripts/cleanup/wipe-test-data-sweep.mjs --mode=batch --batch-id <uuid> --execute
 *
 * MODES
 *   --mode=email-pattern
 *     Sweeps all Auth users whose email ends with @agencytrack.test and all
 *     associated Firestore docs. Use this after the manual runbook import path.
 *
 *   --mode=batch --batch-id <uuid>
 *     Sweeps Firestore docs where testDataBatchId === <uuid> plus Auth users
 *     matching *@agencytrack.test.
 *     NOTE: batch mode is smoke-only. Use --mode=email-pattern after the manual
 *     runbook import path (bulkImportUsers / goals modal writes do not carry
 *     testDataBatchId).
 *
 * SAFETY CONTROLS
 *   1. Dry-run default  — no --execute flag → enumerate only, no deletions.
 *   2. --execute flag   — required for any deletion.
 *   3. Typed confirmation — operator must type "DELETE <N> USERS AT <ISO>"
 *      verbatim within 60 seconds (anti-paste-from-history).
 *   4. Email-pattern hard guard — ANY candidate whose email does not match
 *      *@agencytrack.test aborts with the offending email logged.
 *   5. Tenant allow-list — CLEANUP_ALLOWED_TENANTS must include the target
 *      tenant; exits 1 if unset or missing.
 *   6. Full audit log  — every path deleted written to
 *      verification/cleanup-<timestamp>.log.
 *
 * CASCADE ORDER (--execute only)
 *   1. Revoke Auth refresh tokens (locks active sessions, does not delete yet).
 *   2. Delete Firestore docs, leaves first:
 *        submissions → persistency → daily entries → goals → notifications →
 *        settlements → leaderboard → campaign docs → user docs →
 *        auditAdminCreations
 *   3. Delete Auth users last (Firestore is clean before uid is removed).
 *
 * REQUIREMENTS
 *   functions/service-account-key.json
 *   CLEANUP_ALLOWED_TENANTS env var must include the target tenant
 */

import { createRequire }    from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import readline from 'readline';

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
const EXECUTE = args.includes('--execute');

if (!mode || !['email-pattern', 'batch'].includes(mode)) {
  console.error('ERROR: --mode=email-pattern or --mode=batch required.');
  process.exit(1);
}
if (mode === 'batch' && !batchId) {
  console.error('ERROR: --mode=batch requires --batch-id <uuid>.');
  process.exit(1);
}

// ── Guard 5: Tenant allow-list ────────────────────────────────────────────────

const allowedTenants = (process.env.CLEANUP_ALLOWED_TENANTS ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);
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
const logPath = resolve(logDir, `cleanup-${ts}.log`);
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

// ── Guard 4: Email hard guard ─────────────────────────────────────────────────

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
    // Submissions (leaf — no subcollections)
    const subSnap = await db.collection(`tenants/${TENANT_ID}/submissions`)
      .where('agentId', '==', uid).select().get();
    subSnap.forEach((d) => paths.push(d.ref.path));

    // Persistency (leaf)
    const perSnap = await db.collection(`tenants/${TENANT_ID}/persistency`)
      .where('agentId', '==', uid).select().get();
    perSnap.forEach((d) => paths.push(d.ref.path));

    // Daily activity subcollection — must precede user doc deletion
    const dailySnap = await db.collection(`tenants/${TENANT_ID}/users/${uid}/dailyActivity`).select().get();
    dailySnap.forEach((d) => paths.push(d.ref.path));

    // Goals
    const goalRef  = db.doc(`tenants/${TENANT_ID}/goals/${uid}`);
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
    const lbRef  = db.doc(`tenants/${TENANT_ID}/leaderboard/${uid}`);
    const lbSnap = await lbRef.get();
    if (lbSnap.exists) paths.push(lbRef.path);

    // User doc — after subcollections
    const userRef  = db.doc(`tenants/${TENANT_ID}/users/${uid}`);
    const userSnap = await userRef.get();
    if (userSnap.exists) paths.push(userRef.path);

    // auditAdminCreations (top-level)
    const auditSnap = await db.collection('auditAdminCreations')
      .where('createdUid', '==', uid).select().get();
    auditSnap.forEach((d) => paths.push(d.ref.path));
  }

  // Campaign docs that include any test agent UID in scope.agentIds
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

// ── Guard 3: Typed confirmation ───────────────────────────────────────────────

function promptConfirmation() {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const timer = setTimeout(() => {
      rl.close();
      reject(new Error('Confirmation timed out after 60 seconds.'));
    }, 60_000);
    rl.question('  > ', (answer) => {
      clearTimeout(timer);
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Firestore batch delete (500 ops per batch — Firestore limit) ──────────────

async function deleteFirestorePaths(paths) {
  const BATCH_SIZE = 500;
  let deleted = 0;
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = paths.slice(i, i + BATCH_SIZE);
    for (const p of chunk) {
      batch.delete(db.doc(p));
      log(`  DEL ${p}`);
    }
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log(`\nWipe Test Data Sweep — ${mode.toUpperCase()} mode${EXECUTE ? ' [EXECUTE]' : ' [DRY RUN]'}`);
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

  const uids = testUsers.map((u) => u.uid);

  // Firestore enumeration
  log('\nFirestore paths to delete:');
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

  log('\nSummary:');
  log(`  Auth users:       ${testUsers.length}`);
  log(`  Firestore paths:  ${paths.length}`);
  log(`  Total candidates: ${testUsers.length + paths.length}`);

  // ── Dry run exit ────────────────────────────────────────────────────────────

  if (!EXECUTE) {
    log('\n[DRY RUN — no deletions performed. Add --execute to delete.]');
    log(`Log: ${logPath}`);
    return;
  }

  if (testUsers.length === 0 && paths.length === 0) {
    log('\nNothing to delete — exiting cleanly.');
    log(`Log: ${logPath}`);
    return;
  }

  // ── Guard 3: Typed confirmation ─────────────────────────────────────────────

  // ISO timestamp truncated to seconds — long enough to be unique, short enough to type
  const confirmIso = new Date().toISOString().slice(0, 19) + 'Z';
  const expected   = `DELETE ${testUsers.length} USERS AT ${confirmIso}`;

  log('\nTyped confirmation required (60s timeout).');
  log('Type exactly:');
  log(`  ${expected}`);

  let answer;
  try {
    answer = await promptConfirmation();
  } catch (err) {
    log(`\nABORT: ${err.message}`);
    process.exit(1);
  }

  if (answer !== expected) {
    log('\nABORT: Confirmation phrase did not match.');
    log(`  Expected: ${expected}`);
    log(`  Got:      ${answer}`);
    process.exit(1);
  }

  log('\nConfirmation accepted. Beginning cascade deletion…');

  // ── Step 1: Revoke Auth refresh tokens ─────────────────────────────────────

  log('\n[1/3] Revoking Auth refresh tokens…');
  for (const u of testUsers) {
    await auth.revokeRefreshTokens(u.uid);
    log(`  REVOKE UID=${u.uid}  email=${u.email}`);
  }
  log(`  Revoked: ${testUsers.length}`);

  // ── Step 2: Delete Firestore docs (cascade order: leaves first) ────────────

  log('\n[2/3] Deleting Firestore docs…');
  const fsDeleted = paths.length > 0 ? await deleteFirestorePaths(paths) : 0;
  log(`  Deleted: ${fsDeleted} Firestore paths`);

  // ── Step 3: Delete Auth users ───────────────────────────────────────────────

  log('\n[3/3] Deleting Auth users…');
  const AUTH_BATCH = 1000; // Admin SDK deleteUsers limit
  let authDeleted  = 0;
  let authErrors   = 0;
  for (let i = 0; i < uids.length; i += AUTH_BATCH) {
    const chunk  = uids.slice(i, i + AUTH_BATCH);
    const result = await auth.deleteUsers(chunk);
    authDeleted += chunk.length - (result.errors?.length ?? 0);
    authErrors  += result.errors?.length ?? 0;
    for (const u of testUsers.slice(i, i + AUTH_BATCH)) {
      log(`  DEL AUTH UID=${u.uid}  email=${u.email}`);
    }
    if (result.errors && result.errors.length > 0) {
      for (const err of result.errors) {
        log(`  ERROR at index ${err.index}: ${err.error.message}`);
      }
    }
  }
  log(`  Deleted: ${authDeleted} Auth users${authErrors > 0 ? `  (${authErrors} errors — see log)` : ''}`);

  log('\n✓ Cleanup complete.');
  log(`  Auth users deleted:     ${authDeleted}`);
  log(`  Firestore docs deleted: ${fsDeleted}`);
  if (authErrors > 0) log(`  Auth delete errors:     ${authErrors} — review log above`);
  log(`  Log: ${logPath}`);

  if (authErrors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Wipe sweep failed:', err);
  process.exit(1);
});
