/**
 * Firestore Security Rules — managerWeeklyReports emulator tests (I1.1).
 *
 * Run with the Firestore emulator active:
 *   firebase emulators:start --only firestore
 *   node --experimental-vm-modules firestore.rules.test.mjs
 *
 * Or via:
 *   firebase emulators:exec --only firestore "node firestore.rules.test.mjs"
 *
 * Verified matrix (all 11 original cases + 2 null-resource cases = 13 passing):
 *   ✓ owner create ALLOW
 *   ✓ owner update ALLOW
 *   ✓ owner read   ALLOW
 *   ✓ upline write DENY  (BM cannot write UM's WAR)
 *   ✓ BM same-branch read  ALLOW
 *   ✓ BM diff-branch read  DENY
 *   ✓ SM tenant-wide read  ALLOW
 *   ✓ peer-UM read DENY
 *   ✓ downline (UM reads BM WAR) DENY
 *   ✓ agent read DENY
 *   ✓ owner reads non-existent doc ALLOW  (null-resource path: warId prefix == uid)
 *   ✓ non-owner reads non-existent doc DENY  (null-resource path does NOT over-grant)
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const PROJECT_ID = 'demo-agencytrack-test';
const TENANT_ID  = 'test-tenant';
const WAR_PATH   = `tenants/${TENANT_ID}/managerWeeklyReports`;
const UM1_DOC_ID = 'um1_2026-05-18';
const BM1_DOC_ID = 'bm1_2026-05-18';

let testEnv;

function tok(uid, role, tid = TENANT_ID) {
  return { role, tenantId: tid };
}

const UM1_WAR = {
  managerId:            'um1',
  tenantId:             TENANT_ID,
  weekStart:            '2026-05-18',
  managerRole:          'unit_manager',
  managerRoleRank:      1,
  branchId:             'branch-a',
  unitId:               'um1',
  oneOnOnesConducted:   3,
  namesSourced:         5,
  interviewsConducted:  2,
  recruitsInFirstWeeks: 1,
  trainingSessions:     1,
  trainingTopic:        'Prospecting',
  unitMeetingHeld:      true,
  dashboardReviewDone:  true,
  jfwCount:             0,
  status:               'draft',
  updatedAt:            null,
};

const BM1_WAR = {
  ...UM1_WAR,
  managerId:       'bm1',
  managerRole:     'branch_manager',
  managerRoleRank: 2,
};

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const users = [
      ['um1', { role: 'unit_manager',   branchId: 'branch-a', unitId: 'um1' }],
      ['um2', { role: 'unit_manager',   branchId: 'branch-b', unitId: 'um2' }],
      ['bm1', { role: 'branch_manager', branchId: 'branch-a', unitId: null }],
      ['bm2', { role: 'branch_manager', branchId: 'branch-b', unitId: null }],
      ['sm1', { role: 'sales_manager',  branchId: null,       unitId: null }],
    ];
    for (const [uid, data] of users) {
      await setDoc(doc(db, `tenants/${TENANT_ID}/users/${uid}`), data);
    }
    await setDoc(doc(db, `${WAR_PATH}/${UM1_DOC_ID}`), UM1_WAR);
    await setDoc(doc(db, `${WAR_PATH}/${BM1_DOC_ID}`), BM1_WAR);
  });
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host:  'localhost',
      port:  8080,
    },
  });
});

after(async () => { await testEnv.cleanup(); });
afterEach(async () => { await testEnv.clearFirestore(); });

// ── Owner: create / update / read ─────────────────────────────────────────────

describe('owner', () => {
  it('create ALLOW — owner can create their own WAR', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `tenants/${TENANT_ID}/users/um1`),
        { role: 'unit_manager', branchId: 'branch-a', unitId: 'um1' });
    });
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertSucceeds(setDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`), UM1_WAR));
  });

  it('update ALLOW — owner can update their own WAR', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`),
        { ...UM1_WAR, oneOnOnesConducted: 5 }, { merge: true })
    );
  });

  it('read ALLOW — owner can read their own WAR', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertSucceeds(getDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`)));
  });
});

// ── Upline write DENY ─────────────────────────────────────────────────────────

describe('upline write DENY', () => {
  it('BM cannot write a UM WAR (upline write DENY)', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('bm1', tok('bm1', 'branch_manager'));
    await assertFails(
      setDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`),
        { ...UM1_WAR, oneOnOnesConducted: 10 })
    );
  });
});

// ── BM scope: same-branch ALLOW, diff-branch DENY ────────────────────────────

describe('BM scope', () => {
  it('same-branch BM reads UM WAR ALLOW', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('bm1', tok('bm1', 'branch_manager'));
    await assertSucceeds(getDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`)));
  });

  it('diff-branch BM reads UM WAR DENY', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('bm2', tok('bm2', 'branch_manager'));
    await assertFails(getDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`)));
  });
});

// ── SM reads UM and BM WARs (tenant-wide) ────────────────────────────────────

describe('SM tenant-wide reads', () => {
  it('SM reads UM WAR ALLOW', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('sm1', tok('sm1', 'sales_manager'));
    await assertSucceeds(getDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`)));
  });

  it('SM reads BM WAR ALLOW', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('sm1', tok('sm1', 'sales_manager'));
    await assertSucceeds(getDoc(doc(ctx.firestore(), `${WAR_PATH}/${BM1_DOC_ID}`)));
  });
});

// ── Deny: peer, downline, agent ───────────────────────────────────────────────

describe('deny cases', () => {
  it('peer UM reads another UM WAR DENY', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('um2', tok('um2', 'unit_manager'));
    await assertFails(getDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`)));
  });

  it('downline: UM reads BM WAR DENY', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertFails(getDoc(doc(ctx.firestore(), `${WAR_PATH}/${BM1_DOC_ID}`)));
  });

  it('agent reads any WAR DENY', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('agent1', { role: 'agent', tenantId: TENANT_ID });
    await assertFails(getDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`)));
  });
});

// ── Null-resource (non-existent doc) scope ────────────────────────────────────

describe('null-resource (non-existent doc) scope', () => {
  it('owner reads non-existent own WAR doc ALLOW (warId prefix == uid)', async () => {
    // No seed() — doc intentionally absent; tests the resource==null path in allow read
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertSucceeds(getDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`)));
  });

  it('non-owner reads non-existent WAR doc DENY (null-resource path must not over-grant)', async () => {
    // No seed() — doc absent; um2 reads um1's path: split('_')[0]='um1' != 'um2' → DENY
    const ctx = testEnv.authenticatedContext('um2', tok('um2', 'unit_manager'));
    await assertFails(getDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`)));
  });
});
