/**
 * cleanup-tatillife-south.cjs — DRAFT Admin SDK cleanup script.
 * Dry-run by default. Requires --execute flag to actually delete.
 * MUST run census-tatillife-south.cjs first to enumerate target doc paths.
 *
 * Run: node scripts/cleanup-tatillife-south.cjs            (dry-run)
 * Run: node scripts/cleanup-tatillife-south.cjs --execute  (DESTRUCTIVE)
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or gcloud ADC for agencytrack-2a610.
 * Uses functions/node_modules/firebase-admin (CLAUDE.md policy).
 */
const admin = require('../functions/node_modules/firebase-admin');

const EXECUTE = process.argv.includes('--execute');
const TENANT = 'tatillife_south';

admin.initializeApp({ projectId: 'agencytrack-2a610' });
const db = admin.firestore();
const auth = admin.auth();

// Email patterns that clearly indicate test/smoke accounts.
// OPERATOR: review this list carefully before running --execute.
const TEST_PATTERNS = [
  /kelsean@gmail\.com$/i,
  /kyronmarchan@gmail\.com$/i,
  /kelsean\+/i,
  /kyron\+/i,
  /agencytrack\.test$/i,
  /\+test@/i,
  /\+smoke@/i,
];

function isTestEmail(email) {
  if (!email) return false;
  return TEST_PATTERNS.some((p) => p.test(email));
}

async function deleteOrDryRun(ref, label) {
  if (EXECUTE) {
    await ref.delete();
    console.log(`  DELETED: ${label}`);
  } else {
    console.log(`  DRY-RUN would delete: ${label}`);
  }
}

async function deleteAuthOrDryRun(uid, email) {
  if (EXECUTE) {
    await auth.deleteUser(uid);
    console.log(`  DELETED Auth: uid=${uid} email=${email}`);
  } else {
    console.log(`  DRY-RUN would delete Auth user: uid=${uid} email=${email}`);
  }
}

async function cleanup() {
  console.log(`\n=== CLEANUP: tenants/${TENANT} ===`);
  console.log(`Mode: ${EXECUTE ? '*** EXECUTE — DESTRUCTIVE ***' : 'DRY-RUN (safe)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  if (EXECUTE) {
    console.log('⚠️  EXECUTE mode active. Waiting 5 seconds — Ctrl+C to abort.\n');
    await new Promise((r) => setTimeout(r, 5000));
  }

  // ── IDENTIFY TEST USERS ──────────────────────────────────────────────────
  const usersSnap = await db.collection(`tenants/${TENANT}/users`).get();
  const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const testUsers = allUsers.filter((u) => isTestEmail(u.email));
  const testUids = new Set(testUsers.map((u) => u.id));

  console.log(`Found ${testUsers.length} test users to clean up:`);
  testUsers.forEach((u) => console.log(`  uid=${u.id}  email=${u.email}  role=${u.role}`));
  console.log();

  // ── SUBMISSIONS ──────────────────────────────────────────────────────────
  let subCount = 0;
  const subsSnap = await db.collection(`tenants/${TENANT}/submissions`).get();
  for (const doc of subsSnap.docs) {
    if (testUids.has(doc.data().agentId)) {
      await deleteOrDryRun(doc.ref, `tenants/${TENANT}/submissions/${doc.id}`);
      subCount++;
    }
  }
  console.log(`Submissions: ${subCount}\n`);

  // ── LEADERBOARD ──────────────────────────────────────────────────────────
  let lbCount = 0;
  const lbSnap = await db.collection(`tenants/${TENANT}/leaderboard`).get();
  for (const doc of lbSnap.docs) {
    const d = doc.data();
    if (testUids.has(d.agentId ?? doc.id)) {
      await deleteOrDryRun(doc.ref, `tenants/${TENANT}/leaderboard/${doc.id}`);
      lbCount++;
    }
  }
  console.log(`Leaderboard rows: ${lbCount}\n`);

  // ── NOTIFICATIONS ────────────────────────────────────────────────────────
  let notifCount = 0;
  const notifSnap = await db.collection(`tenants/${TENANT}/notifications`).get();
  for (const doc of notifSnap.docs) {
    const d = doc.data();
    if (testUids.has(d.recipientUid) || testUids.has(d.senderUid)) {
      await deleteOrDryRun(doc.ref, `tenants/${TENANT}/notifications/${doc.id}`);
      notifCount++;
    }
  }
  console.log(`Notifications: ${notifCount}\n`);

  // ── GOALS ────────────────────────────────────────────────────────────────
  let goalsCount = 0;
  const goalsSnap = await db.collection(`tenants/${TENANT}/goals`).get();
  for (const doc of goalsSnap.docs) {
    if (testUids.has(doc.data().agentId)) {
      await deleteOrDryRun(doc.ref, `tenants/${TENANT}/goals/${doc.id}`);
      goalsCount++;
    }
  }
  console.log(`Goals: ${goalsCount}\n`);

  // ── SETTLEMENTS ──────────────────────────────────────────────────────────
  let settleCount = 0;
  const settleSnap = await db.collection(`tenants/${TENANT}/settlements`).get();
  for (const doc of settleSnap.docs) {
    if (testUids.has(doc.data().agentId)) {
      await deleteOrDryRun(doc.ref, `tenants/${TENANT}/settlements/${doc.id}`);
      settleCount++;
    }
  }
  console.log(`Settlements: ${settleCount}\n`);

  // ── PERSISTENCY ──────────────────────────────────────────────────────────
  let persistCount = 0;
  const persistSnap = await db.collection(`tenants/${TENANT}/persistency`).get();
  for (const doc of persistSnap.docs) {
    if (testUids.has(doc.data().agentId)) {
      await deleteOrDryRun(doc.ref, `tenants/${TENANT}/persistency/${doc.id}`);
      persistCount++;
    }
  }
  console.log(`Persistency docs: ${persistCount}\n`);

  // ── USER DOCS ────────────────────────────────────────────────────────────
  for (const u of testUsers) {
    await deleteOrDryRun(
      db.doc(`tenants/${TENANT}/users/${u.id}`),
      `tenants/${TENANT}/users/${u.id} (${u.email})`
    );
  }
  console.log();

  // ── FIREBASE AUTH ────────────────────────────────────────────────────────
  console.log('Firebase Auth deletions:');
  for (const u of testUsers) {
    await deleteAuthOrDryRun(u.id, u.email);
  }

  console.log('\n=== CLEANUP SUMMARY ===');
  console.log(`Mode: ${EXECUTE ? 'EXECUTED' : 'DRY-RUN'}`);
  console.log(`Users:         ${testUsers.length}`);
  console.log(`Submissions:   ${subCount}`);
  console.log(`Leaderboard:   ${lbCount}`);
  console.log(`Notifications: ${notifCount}`);
  console.log(`Goals:         ${goalsCount}`);
  console.log(`Settlements:   ${settleCount}`);
  console.log(`Persistency:   ${persistCount}`);

  if (!EXECUTE) {
    console.log('\n⚠️  DRY-RUN complete — no data modified.');
    console.log('   Run with --execute to apply deletions.');
    console.log('   OPERATOR AUTHORIZATION REQUIRED before running --execute.');
  }
}

cleanup().catch((e) => {
  console.error('Cleanup failed:', e);
  process.exit(1);
});
