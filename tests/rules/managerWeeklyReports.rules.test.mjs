/**
 * Emulator rules tests — managerWeeklyReports (WAR) collection.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/managerWeeklyReports.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * WHY THIS FILE EXISTS (night-queue 2026-06-20, Item 2 / firestore-read-exposure-audit):
 * managerWeeklyReports had ZERO rules-test coverage despite a read-before-write
 * hot path (managerWarService.js:62,:81 — getDoc(WAR) then setDoc on a fresh week).
 * Its `allow get` uses the #701 null-resource guard (firestore.rules:1075):
 *     resource == null ? warId.split('_')[0] == request.auth.uid : ...
 * These tests LOCK that guard so a future refactor can't silently reintroduce the
 * #701 deny-on-non-existent bug (which is invisible to getDoc-mocked unit tests).
 *
 * Test matrix (24 cases) — mirrors managerMonthlyRollups (sister collection) and
 * adds the brief-required unsigned + cross-tenant get cases:
 *   CREATE  1 UM-own ALLOW · 2 BM-own ALLOW · 3 agent DENY · 4 forge-managerId DENY
 *           5 wrong-rank DENY · 6 missing-key DENY · 7 bad-status DENY
 *           8 jfwCount!=0-on-create DENY
 *   UPDATE  9 owner ALLOW · 10 peer DENY
 *   GET     11 owner-exists ALLOW
 *           12 owner-NON-EXISTENT (warId prefix == uid, null-resource) ALLOW   ← #701 guard
 *           13 non-owner-NON-EXISTENT (prefix != uid) DENY  ← existence-oracle guard
 *           14 unsigned + any DENY
 *           15 cross-tenant DENY
 *           16 BM same-branch (upline) ALLOW · 17 BM other-branch DENY
 *           18 SM tenant-wide ALLOW · 19 UM reads BM (rank) DENY · 20 peer UM DENY
 *   LIST    21 BM own-branch ALLOW · 22 SM tenant-wide ALLOW · 23 UM DENY (rank<2)
 *           24 BM cross-branch list DENY
 *   REVIEW (Tier-2 2.1 upline reviewer arm)
 *           25 BM approve same-branch UM submitted ALLOW · 26 BM re-review ALLOW
 *           27 peer-rank UM DENY · 28 cross-branch BM DENY · 29 owner self-review DENY
 *           30 reviewer touches non-review field DENY · 31 review a DRAFT DENY
 *           32 forged reviewedBy DENY · 33 owner full-setDoc resubmit clears review ALLOW
 *           34 SM reviews BM tenant-wide ALLOW · 35 oversize reviewNote DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  getDoc, setDoc, updateDoc, doc, collection, getDocs, query, where,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'mwr-rules-test-tenant';
const OTHER_TENANT = 'other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const UM1_ID  = 'um1';  const BRANCH_A = 'branch-a';
const UM2_ID  = 'um2';  const BRANCH_B = 'branch-b';
const BM1_ID  = 'bm1';  // branch-a
const BM2_ID  = 'bm2';  // branch-b
const SM1_ID  = 'sm1';
const AGENT_ID = 'agent1';
const X_ID     = 'x1';  // cross-tenant

const WEEK = '2026-05-17'; // a Sunday; warId = {managerId}_{WEEK}
const WEEK2 = '2026-05-24'; // Sunday; review-arm fixtures (submitted)
const WEEK3 = '2026-05-31'; // Sunday; already-reviewed fixture

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function warRef(db, uid, week, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/managerWeeklyReports/${uid}_${week}`);
}

// Mirrors validWarWrite() in firestore.rules (hasAll keys + types; jfwCount==0 on create).
function validPayload(uid, role, rank, branchId, unitId = null) {
  return {
    managerId:            uid,
    tenantId:             TENANT_ID,
    weekStart:            WEEK,
    managerRole:          role,
    managerRoleRank:      rank,
    branchId:             branchId,
    unitId:               unitId,
    oneOnOnesConducted:   2,
    namesSourced:         3,
    interviewsConducted:  1,
    recruitsInFirstWeeks: 0,
    trainingSessions:     1,
    trainingTopic:        'Closing',
    unitMeetingHeld:      true,
    dashboardReviewDone:  true,
    jfwCount:             0,
    status:               'draft',
    updatedAt:            new Date(),
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const userDoc = (uid, role, branchId, unitId) => ({ uid, role, tenantId: TENANT_ID, branchId, unitId });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM1_ID}`),   userDoc(UM1_ID,  'unit_manager',   BRANCH_A, UM1_ID));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM2_ID}`),   userDoc(UM2_ID,  'unit_manager',   BRANCH_B, UM2_ID));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM1_ID}`),   userDoc(BM1_ID,  'branch_manager', BRANCH_A, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM2_ID}`),   userDoc(BM2_ID,  'branch_manager', BRANCH_B, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${SM1_ID}`),   userDoc(SM1_ID,  'sales_manager',  null,     null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_ID}`), userDoc(AGENT_ID,'agent',          BRANCH_A, UM1_ID));

    // Pre-seed UM1's WAR (exists) for update/read tests; BM1's WAR for downline-read test.
    await setDoc(warRef(db, UM1_ID, WEEK), validPayload(UM1_ID, 'unit_manager',   1, BRANCH_A, UM1_ID));
    await setDoc(warRef(db, BM1_ID, WEEK), validPayload(BM1_ID, 'branch_manager', 2, BRANCH_A, null));

    // Tier-2 2.1 review-arm fixtures: SUBMITTED WARs (review requires status=='submitted').
    await setDoc(warRef(db, UM1_ID, WEEK2), { ...validPayload(UM1_ID, 'unit_manager',   1, BRANCH_A, UM1_ID), weekStart: WEEK2, status: 'submitted' });
    await setDoc(warRef(db, BM1_ID, WEEK2), { ...validPayload(BM1_ID, 'branch_manager', 2, BRANCH_A, null),   weekStart: WEEK2, status: 'submitted' });
    // Already-reviewed WAR for the owner-resubmit-clears-review case.
    await setDoc(warRef(db, UM1_ID, WEEK3), {
      ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), weekStart: WEEK3, status: 'submitted',
      reviewStatus: 'changes_requested', reviewNote: 'tighten 1:1 cadence', reviewedBy: BM1_ID, reviewedByName: 'BM One', reviewedAt: new Date(),
    });
  });
}

let passed = 0;
let failed = 0;
async function t(label, fn) {
  try { await fn(); console.log(`  ✓ ${label}`); passed++; }
  catch (err) { console.error(`  ✗ ${label}`); console.error(`    ${err.message ?? err}`); failed++; }
}

async function main() {
  console.log('Manager Weekly Reports (WAR) — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });
  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  // ── CREATE ──────────────────────────────────────────────────────────────────
  console.log('\nallow create:');
  await t('1. UM owner creates own WAR → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertSucceeds(setDoc(warRef(db, UM1_ID, '2026-05-10'), { ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), weekStart: '2026-05-10' }));
  });
  await t('2. BM owner creates own WAR (unitId null) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(setDoc(warRef(db, BM1_ID, '2026-05-10'), { ...validPayload(BM1_ID, 'branch_manager', 2, BRANCH_A, null), weekStart: '2026-05-10' }));
  });
  await t('3. Agent attempts create → DENY', async () => {
    const db = testEnv.authenticatedContext(AGENT_ID, authToken('agent')).firestore();
    await assertFails(setDoc(warRef(db, AGENT_ID, WEEK), { ...validPayload(AGENT_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), managerRole: 'agent' }));
  });
  await t('4. UM forges managerId (targets UM2 doc) → DENY', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertFails(setDoc(warRef(db, UM2_ID, '2026-05-10'), { ...validPayload(UM2_ID, 'unit_manager', 1, BRANCH_B, UM2_ID), weekStart: '2026-05-10' }));
  });
  await t('5. UM sends wrong managerRoleRank (2 for UM) → DENY', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertFails(setDoc(warRef(db, UM1_ID, '2026-05-03'), { ...validPayload(UM1_ID, 'unit_manager', 2, BRANCH_A, UM1_ID), weekStart: '2026-05-03' }));
  });
  await t('6. UM omits required key (trainingTopic) → DENY', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    const { trainingTopic: _t, ...noTopic } = { ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), weekStart: '2026-04-26' };
    await assertFails(setDoc(warRef(db, UM1_ID, '2026-04-26'), noTopic));
  });
  await t('7. UM sends bad status value → DENY', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertFails(setDoc(warRef(db, UM1_ID, '2026-04-19'), { ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), weekStart: '2026-04-19', status: 'approved' }));
  });
  await t('8. UM sends jfwCount != 0 on create → DENY', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertFails(setDoc(warRef(db, UM1_ID, '2026-04-12'), { ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), weekStart: '2026-04-12', jfwCount: 3 }));
  });

  // ── UPDATE ──────────────────────────────────────────────────────────────────
  console.log('\nallow update:');
  await t('9. Owner updates own WAR → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertSucceeds(setDoc(warRef(db, UM1_ID, WEEK), { ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), namesSourced: 9 }));
  });
  await t('10. Peer UM updates another UM WAR → DENY', async () => {
    const db = testEnv.authenticatedContext(UM2_ID, authToken('unit_manager')).firestore();
    await assertFails(setDoc(warRef(db, UM1_ID, WEEK), validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID)));
  });

  // ── GET (the null-resource focus) ─────────────────────────────────────────────
  console.log('\nallow get (null-resource guard is the #701 protection):');
  await t('11. Owner reads own WAR (exists) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(warRef(db, UM1_ID, WEEK)));
  });
  await t('12. Owner reads own NON-EXISTENT WAR (warId prefix == uid, null-resource) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(warRef(db, UM1_ID, '2099-01-04'))); // doc absent → resource == null → prefix check
  });
  await t('13. Non-owner reads another manager\'s NON-EXISTENT WAR → DENY (existence-oracle guard)', async () => {
    const db = testEnv.authenticatedContext(UM2_ID, authToken('unit_manager')).firestore();
    await assertFails(getDoc(warRef(db, UM1_ID, '2099-01-04'))); // resource == null, prefix 'um1' != caller 'um2'
  });
  await t('14. Unsigned reads any WAR → DENY', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(warRef(db, UM1_ID, WEEK)));
  });
  await t('15. Cross-tenant manager reads WAR in this tenant → DENY', async () => {
    const db = testEnv.authenticatedContext(X_ID, authToken('branch_manager', OTHER_TENANT)).firestore();
    await assertFails(getDoc(warRef(db, UM1_ID, WEEK)));
  });
  await t('16. BM same-branch reads UM WAR → ALLOW (upline)', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(getDoc(warRef(db, UM1_ID, WEEK)));
  });
  await t('17. BM other-branch reads UM WAR → DENY', async () => {
    const db = testEnv.authenticatedContext(BM2_ID, authToken('branch_manager')).firestore();
    await assertFails(getDoc(warRef(db, UM1_ID, WEEK)));
  });
  await t('18. SM reads any WAR (tenant-wide upline) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(SM1_ID, authToken('sales_manager')).firestore();
    await assertSucceeds(getDoc(warRef(db, UM1_ID, WEEK)));
  });
  await t('19. UM reads BM WAR (downline/rank mismatch) → DENY', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertFails(getDoc(warRef(db, BM1_ID, WEEK)));
  });
  await t('20. Peer UM reads another UM WAR (exists) → DENY', async () => {
    const db = testEnv.authenticatedContext(UM2_ID, authToken('unit_manager')).firestore();
    await assertFails(getDoc(warRef(db, UM1_ID, WEEK)));
  });

  // ── LIST ────────────────────────────────────────────────────────────────────
  console.log('\nallow list:');
  await t('21. BM own-branch list → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(getDocs(query(
      collection(db, `tenants/${TENANT_ID}/managerWeeklyReports`),
      where('branchId', '==', BRANCH_A))));
  });
  await t('22. SM tenant-wide list → ALLOW', async () => {
    const db = testEnv.authenticatedContext(SM1_ID, authToken('sales_manager')).firestore();
    await assertSucceeds(getDocs(query(
      collection(db, `tenants/${TENANT_ID}/managerWeeklyReports`),
      where('weekStart', '==', WEEK))));
  });
  await t('23. UM list → DENY (rank < 2)', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertFails(getDocs(query(
      collection(db, `tenants/${TENANT_ID}/managerWeeklyReports`),
      where('weekStart', '==', WEEK))));
  });
  await t('24. BM lists a different branch → DENY (cross-branch)', async () => {
    const db = testEnv.authenticatedContext(BM2_ID, authToken('branch_manager')).firestore();
    await assertFails(getDocs(query(
      collection(db, `tenants/${TENANT_ID}/managerWeeklyReports`),
      where('branchId', '==', BRANCH_A))));
  });

  // ── REVIEW (Tier-2 2.1 upline reviewer arm) ────────────────────────────────
  console.log('');
  console.log('review arm:');
  const review = (over = {}) => ({
    reviewStatus: 'approved', reviewNote: 'good week', reviewedBy: BM1_ID,
    reviewedByName: 'BM One', reviewedAt: new Date(), ...over,
  });
  await t('25. BM approves same-branch UM submitted WAR → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(warRef(db, UM1_ID, WEEK2), review()));
  });
  await t('26. BM re-reviews (changes_requested + note) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertSucceeds(updateDoc(warRef(db, UM1_ID, WEEK2), review({ reviewStatus: 'changes_requested', reviewNote: 'log the joint work' })));
  });
  await t('27. Peer-rank UM attempts review → DENY', async () => {
    const db = testEnv.authenticatedContext(UM2_ID, authToken('unit_manager')).firestore();
    await assertFails(updateDoc(warRef(db, UM1_ID, WEEK2), review({ reviewedBy: UM2_ID, reviewedByName: 'UM Two', reviewNote: 'peer note' })));
  });
  await t('28. Cross-branch BM attempts review → DENY', async () => {
    const db = testEnv.authenticatedContext(BM2_ID, authToken('branch_manager')).firestore();
    await assertFails(updateDoc(warRef(db, UM1_ID, WEEK2), review({ reviewedBy: BM2_ID, reviewedByName: 'BM Two', reviewNote: 'xbranch note' })));
  });
  await t('29. Owner self-review → DENY (validWarWrite bans review keys; upline arm needs higher rank)', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertFails(updateDoc(warRef(db, UM1_ID, WEEK2), review({ reviewedBy: UM1_ID, reviewedByName: 'UM One', reviewNote: 'self note' })));
  });
  await t('30. Reviewer also bumps a non-review field → DENY (hasOnly)', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertFails(updateDoc(warRef(db, UM1_ID, WEEK2), { ...review({ reviewNote: 'sneaky' }), oneOnOnesConducted: 99 }));
  });
  await t('31. Review a DRAFT WAR → DENY (status gate)', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertFails(updateDoc(warRef(db, UM1_ID, WEEK), review({ reviewNote: 'draft review attempt' })));
  });
  await t('32. Forged reviewedBy (!= auth.uid) → DENY', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertFails(updateDoc(warRef(db, UM1_ID, WEEK2), review({ reviewedBy: SM1_ID, reviewNote: 'forged identity' })));
  });
  await t('33. Owner full-setDoc resubmit clears review state → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM1_ID, authToken('unit_manager')).firestore();
    await assertSucceeds(setDoc(warRef(db, UM1_ID, WEEK3), { ...validPayload(UM1_ID, 'unit_manager', 1, BRANCH_A, UM1_ID), weekStart: WEEK3, status: 'submitted', oneOnOnesConducted: 4 }));
  });
  await t('34. SM reviews BM WAR tenant-wide → ALLOW', async () => {
    const db = testEnv.authenticatedContext(SM1_ID, authToken('sales_manager')).firestore();
    await assertSucceeds(updateDoc(warRef(db, BM1_ID, WEEK2), review({ reviewedBy: SM1_ID, reviewedByName: 'SM One', reviewNote: 'solid branch week' })));
  });
  await t('35. Oversize reviewNote (>2000 chars) → DENY', async () => {
    const db = testEnv.authenticatedContext(BM1_ID, authToken('branch_manager')).firestore();
    await assertFails(updateDoc(warRef(db, UM1_ID, WEEK2), review({ reviewNote: 'x'.repeat(2001) })));
  });

  await testEnv.cleanup();
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed (35 expected)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
