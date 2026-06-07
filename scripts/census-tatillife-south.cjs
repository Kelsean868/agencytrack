/**
 * census-tatillife-south.cjs
 * READ-ONLY census of tatillife_south tenant.
 * Enumerates test/smoke garbage: users, submissions, leaderboard, notifications.
 * Outputs exact doc paths + summary. DO NOT modify data — read only.
 *
 * Run: node scripts/census-tatillife-south.cjs
 * Requires service-account ambient auth OR GOOGLE_APPLICATION_CREDENTIALS.
 * Uses functions/node_modules/firebase-admin (CLAUDE.md policy).
 */
const admin = require('../functions/node_modules/firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const TENANT = 'tatillife_south';

// Email patterns that clearly indicate test/smoke accounts
const TEST_PATTERNS = [
  /kelsean/i,
  /agencytrack\.test$/i,
  /\+test/i,
  /\+smoke/i,
  /\+tenant/i,
  /test@/i,
  /smoke@/i,
  /kyronmarchan/i,   // personal Gmail — not a real agent email
];

function isTestEmail(email) {
  if (!email) return false;
  return TEST_PATTERNS.some((p) => p.test(email));
}

async function census() {
  console.log(`\n=== CENSUS: tenants/${TENANT} ===`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // ── USERS ──────────────────────────────────────────────────────────────────
  const usersSnap = await db.collection(`tenants/${TENANT}/users`).get();
  const allUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`USERS: ${allUsers.length} total`);

  const testUsers = allUsers.filter((u) => isTestEmail(u.email));
  const realUsers = allUsers.filter((u) => !isTestEmail(u.email));

  console.log(`  Real users (${realUsers.length}):`);
  realUsers.forEach((u) =>
    console.log(`    ${u.role?.padEnd(15)} ${u.email}  uid=${u.id}`)
  );

  console.log(`\n  Test/smoke users (${testUsers.length}) — CANDIDATES FOR CLEANUP:`);
  testUsers.forEach((u) =>
    console.log(`    tenants/${TENANT}/users/${u.id}  email=${u.email}  role=${u.role}`)
  );

  const testUids = new Set(testUsers.map((u) => u.id));

  // ── SUBMISSIONS ────────────────────────────────────────────────────────────
  const subsSnap = await db.collection(`tenants/${TENANT}/submissions`).get();
  const allSubs = subsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`\nSUBMISSIONS: ${allSubs.length} total`);

  const testSubs = allSubs.filter((s) => testUids.has(s.agentId));
  const realSubs = allSubs.filter((s) => !testUids.has(s.agentId));

  console.log(`  Real submissions: ${realSubs.length}`);
  console.log(`  Test/smoke submissions (${testSubs.length}) — CANDIDATES FOR CLEANUP:`);
  testSubs.slice(0, 30).forEach((s) =>
    console.log(
      `    tenants/${TENANT}/submissions/${s.id}  agentId=${s.agentId}  week=${s.weekStarting}`
    )
  );
  if (testSubs.length > 30) console.log(`    ... and ${testSubs.length - 30} more`);

  // ── LEADERBOARD ────────────────────────────────────────────────────────────
  const lbSnap = await db.collection(`tenants/${TENANT}/leaderboard`).get();
  const allLb = lbSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`\nLEADERBOARD: ${allLb.length} rows`);

  const testLb = allLb.filter((r) => testUids.has(r.agentId ?? r.id));
  console.log(`  Test/smoke rows (${testLb.length}) — CANDIDATES FOR CLEANUP:`);
  testLb.forEach((r) =>
    console.log(`    tenants/${TENANT}/leaderboard/${r.id}  agentId=${r.agentId ?? r.id}`)
  );

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  const notifSnap = await db.collection(`tenants/${TENANT}/notifications`).get();
  const allNotifs = notifSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  console.log(`\nNOTIFICATIONS: ${allNotifs.length} total`);

  const testNotifs = allNotifs.filter(
    (n) => testUids.has(n.recipientUid) || testUids.has(n.senderUid)
  );
  console.log(`  Test/smoke notifications (${testNotifs.length}) — CANDIDATES FOR CLEANUP:`);
  testNotifs.slice(0, 20).forEach((n) =>
    console.log(`    tenants/${TENANT}/notifications/${n.id}  type=${n.type}`)
  );
  if (testNotifs.length > 20) console.log(`    ... and ${testNotifs.length - 20} more`);

  // ── GOALS ──────────────────────────────────────────────────────────────────
  const goalsSnap = await db.collection(`tenants/${TENANT}/goals`).get();
  const allGoals = goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const testGoals = allGoals.filter((g) => testUids.has(g.agentId));
  console.log(`\nGOALS: ${allGoals.length} total, ${testGoals.length} test — CANDIDATES:`);
  testGoals.forEach((g) =>
    console.log(`    tenants/${TENANT}/goals/${g.id}  agentId=${g.agentId}  year=${g.year}`)
  );

  // ── SETTLEMENTS ────────────────────────────────────────────────────────────
  const settleSnap = await db.collection(`tenants/${TENANT}/settlements`).get();
  const allSettle = settleSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const testSettle = allSettle.filter((s) => testUids.has(s.agentId));
  console.log(`\nSETTLEMENTS: ${allSettle.length} total, ${testSettle.length} test — CANDIDATES:`);
  testSettle.forEach((s) =>
    console.log(`    tenants/${TENANT}/settlements/${s.id}  agentId=${s.agentId}`)
  );

  // ── PERSISTENCY ────────────────────────────────────────────────────────────
  const persistSnap = await db.collection(`tenants/${TENANT}/persistency`).get();
  const allPersist = persistSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const testPersist = allPersist.filter((p) => testUids.has(p.agentId));
  console.log(`\nPERSISTENCY: ${allPersist.length} total, ${testPersist.length} test — CANDIDATES:`);
  testPersist.forEach((p) =>
    console.log(
      `    tenants/${TENANT}/persistency/${p.id}  agentId=${p.agentId}  ${p.year}-${p.month}`
    )
  );

  // ── CONFIG ─────────────────────────────────────────────────────────────────
  const configRef = db.collection(`tenants/${TENANT}/config`);
  const compMinDoc = await configRef.doc('companyMinimums').get();
  console.log(`\nCONFIG/companyMinimums: ${compMinDoc.exists ? 'EXISTS' : 'MISSING (defaults active)'}`);
  if (compMinDoc.exists) {
    const d = compMinDoc.data();
    console.log(`  updatedBy=${d.updatedBy ?? 'none'}  updatedAt=${d.updatedAt?.toDate?.() ?? 'none'}`);
    if (d.weeklyActivityFloors) {
      console.log('  weeklyActivityFloors (stored overrides):');
      Object.entries(d.weeklyActivityFloors).forEach(([k, v]) =>
        console.log(`    ${k}: ${v}`)
      );
    }
    if (d.tenureApiFloors) {
      console.log('  tenureApiFloors (stored overrides):');
      Object.entries(d.tenureApiFloors).forEach(([k, v]) =>
        console.log(`    ${k}: ${v}`)
      );
    }
  }

  const settingsDoc = await configRef.doc('settings').get();
  console.log(`\nCONFIG/settings: ${settingsDoc.exists ? 'EXISTS' : 'MISSING'}`);
  if (settingsDoc.exists) {
    const d = settingsDoc.data();
    console.log(`  tenantName=${d.tenantName}  nudgeCooldownHours=${d.nudgeCooldownHours ?? 'not set (default 24h)'}  awardsRulesetVersion=${d.awardsRulesetVersion ?? 'not set (default 2026)'}`);
  }

  // ── BRANCHES ───────────────────────────────────────────────────────────────
  const branchSnap = await db.collection(`tenants/${TENANT}/branches`).get();
  console.log(`\nBRANCHES: ${branchSnap.size} total`);
  branchSnap.docs.forEach((d) =>
    console.log(`    tenants/${TENANT}/branches/${d.id}  name=${d.data().name}`)
  );

  // ── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n=== CLEANUP SUMMARY ===');
  console.log(`Test UIDs: ${[...testUids].join(', ')}`);
  console.log(`Users to delete:        ${testUsers.length}`);
  console.log(`Submissions to delete:  ${testSubs.length}`);
  console.log(`Leaderboard to delete:  ${testLb.length}`);
  console.log(`Notifications to delete: ${testNotifs.length}`);
  console.log(`Goals to delete:        ${testGoals.length}`);
  console.log(`Settlements to delete:  ${testSettle.length}`);
  console.log(`Persistency to delete:  ${testPersist.length}`);
  console.log('\nDO NOT EXECUTE cleanup without operator authorization.');
  console.log('Use cleanup-tatillife-south.cjs (--execute flag required).\n');
}

census().catch((e) => {
  console.error('Census failed:', e);
  process.exit(1);
});
