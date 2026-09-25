/**
 * Firestore Security Rules — managerWeeklyReports emulator tests (I1.1 + I1.3a + I1.3b)
 * + submissions allow list regression tests (hotfix — SHAKEDOWN-002B regression).
 *
 * Run with the Firestore emulator active:
 *   firebase emulators:start --only firestore
 *   node --experimental-vm-modules firestore.rules.test.mjs
 *
 * Or via:
 *   firebase emulators:exec --only firestore "node firestore.rules.test.mjs"
 *
 * Verified matrix (14 original + 5 list cases = 19 passing) + 4 submissions list cases:
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
 *   ✓ owner create with jfwCount==0 ALLOW  (covered by case 1 above; explicit below)
 *   ✓ owner update CHANGING jfwCount DENY  (CF is the only writer — I1.3a)
 *   [I1.3b list cases]
 *   ✓ BM lists own-branch WARs ALLOW
 *   ✓ BM lists another-branch WARs DENY  (scope boundary — mandatory)
 *   ✓ SM lists tenant-wide WARs ALLOW
 *   ✓ UM list DENY  (rank < 2)
 *   ✓ agent list DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, setDoc, getDoc, getDocs, deleteDoc, query, collection, where } from 'firebase/firestore';
// Rotted harness (fixed): this file calls describe/it/before/after/afterEach
// as bare globals, but neither plain `node` nor `node --test` injects them —
// Node's test runner globals always require this explicit import (verified:
// a probe file using describe()/it() with zero imports throws
// "describe is not defined" under `node --test` too). Every sibling file in
// tests/rules/ instead uses a self-contained custom runner (no describe/it),
// which is why only this file was broken. Run with `node --test
// firestore.rules.test.mjs` (or via firebase emulators:exec, see header).
import { describe, it, before, after, afterEach } from 'node:test';

// Rotted config (fixed): hardcoded port 8080 (Firebase's own default) never
// matched this repo's firebase.json, which pins the Firestore emulator to
// 9090. Read FIRESTORE_EMULATOR_HOST like every sibling file in tests/rules/.
const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

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
      host:  EMU_HOST,
      port:  EMU_PORT,
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

// ── jfwCount field lock (I1.3a) ──────────────────────────────────────────────
// The validWarWrite() rule enforces d.jfwCount == resource.data.jfwCount on update.
// The CF (Admin SDK) is the only path that changes jfwCount; client writes DENY.

describe('jfwCount field lock', () => {
  it('owner update CHANGING jfwCount DENY (CF is the only writer)', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    // UM1_WAR stored jfwCount: 0; try to update to jfwCount: 2 → DENY
    await assertFails(
      setDoc(doc(ctx.firestore(), `${WAR_PATH}/${UM1_DOC_ID}`),
        { ...UM1_WAR, jfwCount: 2 }, { merge: true })
    );
  });
});

// ── List queries (I1.3b upline browse) ───────────────────────────────────────

describe('list (I1.3b)', () => {
  it('BM lists own-branch WARs ALLOW', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('bm1', tok('bm1', 'branch_manager'));
    const q = query(
      collection(ctx.firestore(), WAR_PATH),
      where('branchId', '==', 'branch-a'),
      where('weekStart', '==', '2026-05-18'),
    );
    await assertSucceeds(getDocs(q));
  });

  it('BM lists another-branch WARs DENY (scope boundary — mandatory)', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('bm2', tok('bm2', 'branch_manager'));
    // bm2 is branch-b; branch-a docs must be denied
    const q = query(
      collection(ctx.firestore(), WAR_PATH),
      where('branchId', '==', 'branch-a'),
      where('weekStart', '==', '2026-05-18'),
    );
    await assertFails(getDocs(q));
  });

  it('SM lists tenant-wide WARs ALLOW', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('sm1', tok('sm1', 'sales_manager'));
    const q = query(
      collection(ctx.firestore(), WAR_PATH),
      where('weekStart', '==', '2026-05-18'),
    );
    await assertSucceeds(getDocs(q));
  });

  it('UM list DENY (rank < 2)', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    const q = query(
      collection(ctx.firestore(), WAR_PATH),
      where('branchId', '==', 'branch-a'),
      where('weekStart', '==', '2026-05-18'),
    );
    await assertFails(getDocs(q));
  });

  it('agent list DENY', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('agent1', { role: 'agent', tenantId: TENANT_ID });
    const q = query(
      collection(ctx.firestore(), WAR_PATH),
      where('weekStart', '==', '2026-05-18'),
    );
    await assertFails(getDocs(q));
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

// ── config/managerActivityStandards — inherited wildcard (I1.3c-i) ────────────
//
// The doc lives at tenants/{tid}/config/managerActivityStandards.
// It is governed by the existing match /config/{docId} wildcard rule:
//   read:  isSignedIn() && getTenantId() == tenantId  (all tenant members)
//   write: platform_admin | tenant_admin only
// No rule was edited — these tests verify inherited behaviour.

const STD_PATH  = `tenants/${TENANT_ID}/config/managerActivityStandards`;
const STD_PAYLOAD = {
  unit_manager:   { jfwCount: 2, oneOnOnesConducted: 5 },
  branch_manager: { jfwCount: 3 },
  sales_manager:  {},
  updatedBy: 'admin1',
  updatedAt: null,
};

describe('config/managerActivityStandards — inherited wildcard (I1.3c-i)', () => {
  it('tenant_admin write ALLOW', async () => {
    const ctx = testEnv.authenticatedContext('admin1', { role: 'tenant_admin', tenantId: TENANT_ID });
    await assertSucceeds(setDoc(doc(ctx.firestore(), STD_PATH), STD_PAYLOAD));
  });

  it('unit_manager write DENY (not platform_admin or tenant_admin)', async () => {
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertFails(setDoc(doc(ctx.firestore(), STD_PATH), STD_PAYLOAD));
  });

  it('agent write DENY', async () => {
    const ctx = testEnv.authenticatedContext('agent1', { role: 'agent', tenantId: TENANT_ID });
    await assertFails(setDoc(doc(ctx.firestore(), STD_PATH), STD_PAYLOAD));
  });

  it('branch_manager read ALLOW (all tenant members can read)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), STD_PATH), STD_PAYLOAD);
    });
    const ctx = testEnv.authenticatedContext('bm1', tok('bm1', 'branch_manager'));
    await assertSucceeds(getDoc(doc(ctx.firestore(), STD_PATH)));
  });

  it('unit_manager read ALLOW (all tenant members can read)', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), STD_PATH), STD_PAYLOAD);
    });
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertSucceeds(getDoc(doc(ctx.firestore(), STD_PATH)));
  });

  it('cross-tenant write DENY (tenant_admin of different tenant)', async () => {
    const ctx = testEnv.authenticatedContext('admin-other', { role: 'tenant_admin', tenantId: 'other-tenant' });
    await assertFails(setDoc(doc(ctx.firestore(), STD_PATH), STD_PAYLOAD));
  });
});

// ── managerActivityStandardOverrides — I1.3c-ii ───────────────────────────────
//
// Rule: get(M's user doc) is the authoritative source for M's role+branchId.
// The payload's branchId field (if any) is ignored — prevents forgery.
//
// Matrix:
//   ✓ owner read ALLOW
//   ✓ upline (BM same-branch) read ALLOW
//   ✓ peer UM read DENY
//   ✓ cross-tenant read DENY
//   ✓ BM same-branch create ALLOW
//   ✓ BM cross-branch create DENY
//   ✓ SM→BM create ALLOW
//   ✓ UM self-write DENY (uplineInScope requires strictly-greater rank)
//   ✓ UM→peer UM create DENY
//   ✓ UM→BM create DENY  (downline-up)
//   ✓ KEY FORGERY DENY — BM2 forges branchId in payload for UM1 → rule reads get(M) → DENY

const OVR_PATH = `tenants/${TENANT_ID}/managerActivityStandardOverrides`;

function ovrPayload(managerId, extra = {}) {
  return { managerId, tenantId: TENANT_ID, jfwCount: 5, updatedBy: 'bm1', updatedAt: null, ...extra };
}

async function seedOverride(managerId = 'um1') {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `${OVR_PATH}/${managerId}`), ovrPayload(managerId));
  });
}

describe('managerActivityStandardOverrides — read', () => {
  it('owner read ALLOW (request.auth.uid == managerId)', async () => {
    await seed();
    await seedOverride('um1');
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertSucceeds(getDoc(doc(ctx.firestore(), `${OVR_PATH}/um1`)));
  });

  it('upline BM same-branch read ALLOW', async () => {
    await seed();
    await seedOverride('um1');
    const ctx = testEnv.authenticatedContext('bm1', tok('bm1', 'branch_manager'));
    await assertSucceeds(getDoc(doc(ctx.firestore(), `${OVR_PATH}/um1`)));
  });

  it('peer UM read DENY', async () => {
    await seed();
    await seedOverride('um1');
    const ctx = testEnv.authenticatedContext('um2', tok('um2', 'unit_manager'));
    await assertFails(getDoc(doc(ctx.firestore(), `${OVR_PATH}/um1`)));
  });

  it('cross-tenant read DENY', async () => {
    await seed();
    await seedOverride('um1');
    const ctx = testEnv.authenticatedContext('bm1', { role: 'branch_manager', tenantId: 'other-tenant' });
    await assertFails(getDoc(doc(ctx.firestore(), `${OVR_PATH}/um1`)));
  });
});

describe('managerActivityStandardOverrides — write', () => {
  it('BM same-branch creates override for UM ALLOW', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('bm1', tok('bm1', 'branch_manager'));
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), `${OVR_PATH}/um1`), ovrPayload('um1'))
    );
  });

  it('BM cross-branch creates override for UM DENY', async () => {
    await seed();
    // bm2 is branch-b; um1 is branch-a → not in scope
    const ctx = testEnv.authenticatedContext('bm2', tok('bm2', 'branch_manager'));
    await assertFails(
      setDoc(doc(ctx.firestore(), `${OVR_PATH}/um1`), ovrPayload('um1'))
    );
  });

  it('SM creates override for BM ALLOW (rank 3 >= 3)', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('sm1', tok('sm1', 'sales_manager'));
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), `${OVR_PATH}/bm1`), ovrPayload('bm1', { updatedBy: 'sm1' }))
    );
  });

  it('UM self-write DENY (uplineInScope requires strictly-greater rank)', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertFails(
      setDoc(doc(ctx.firestore(), `${OVR_PATH}/um1`), ovrPayload('um1', { updatedBy: 'um1' }))
    );
  });

  it('UM creates override for peer UM DENY', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('um2', tok('um2', 'unit_manager'));
    await assertFails(
      setDoc(doc(ctx.firestore(), `${OVR_PATH}/um1`), ovrPayload('um1'))
    );
  });

  it('UM creates override for upline BM DENY (downline-up)', async () => {
    await seed();
    // UM rank 1 cannot be upline of BM rank 2
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertFails(
      setDoc(doc(ctx.firestore(), `${OVR_PATH}/bm1`), ovrPayload('bm1', { managerId: 'bm1', updatedBy: 'um1' }))
    );
  });

  it('KEY FORGERY DENY — BM2 forges branchId in payload for UM1 → rule reads get(M) → DENY', async () => {
    await seed();
    // bm2 is branch-b; um1 is branch-a. Payload includes forged branchId:'branch-b'.
    // The rule reads subjectBranchId() from get(users/um1).data.branchId = 'branch-a',
    // not from request.resource.data. callerBranchId = 'branch-b' != 'branch-a' → DENY.
    const ctx = testEnv.authenticatedContext('bm2', tok('bm2', 'branch_manager'));
    const forgeryPayload = {
      managerId: 'um1',
      tenantId:  TENANT_ID,
      branchId:  'branch-b', // forged — rule ignores this
      jfwCount:  5,
      updatedBy: 'bm2',
      updatedAt: null,
    };
    await assertFails(
      setDoc(doc(ctx.firestore(), `${OVR_PATH}/um1`), forgeryPayload)
    );
  });
});

describe('managerActivityStandardOverrides — delete', () => {
  it('upline BM deletes own-branch UM override ALLOW', async () => {
    await seed();
    await seedOverride('um1');
    const ctx = testEnv.authenticatedContext('bm1', tok('bm1', 'branch_manager'));
    await assertSucceeds(deleteDoc(doc(ctx.firestore(), `${OVR_PATH}/um1`)));
  });
});

describe('managerActivityStandardOverrides — list (Run5 override-count arm)', () => {
  it('tenant_admin in-tenant list ALLOW (override-count indicator)', async () => {
    await seed();
    await seedOverride('um1');
    const ctx = testEnv.authenticatedContext('ta1', { role: 'tenant_admin', tenantId: TENANT_ID });
    await assertSucceeds(getDocs(query(collection(ctx.firestore(), OVR_PATH))));
  });

  it('platform_admin list ALLOW (cross-tenant by design)', async () => {
    await seed();
    await seedOverride('um1');
    // PA authenticated in a DIFFERENT tenant context still reads TENANT_ID's collection.
    const ctx = testEnv.authenticatedContext('pa1', { role: 'platform_admin', tenantId: 'other-tenant' });
    await assertSucceeds(getDocs(query(collection(ctx.firestore(), OVR_PATH))));
  });

  it('branch_manager list DENY', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('bm1', tok('bm1', 'branch_manager'));
    await assertFails(getDocs(query(collection(ctx.firestore(), OVR_PATH))));
  });

  it('unit_manager list DENY', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    await assertFails(getDocs(query(collection(ctx.firestore(), OVR_PATH))));
  });

  it('agent list DENY', async () => {
    await seed();
    const ctx = testEnv.authenticatedContext('agent1', { role: 'agent', tenantId: TENANT_ID });
    await assertFails(getDocs(query(collection(ctx.firestore(), OVR_PATH))));
  });

  it('cross-tenant tenant_admin list DENY', async () => {
    await seed();
    // TA of a different tenant may not list TENANT_ID's overrides.
    const ctx = testEnv.authenticatedContext('ta2', { role: 'tenant_admin', tenantId: 'other-tenant' });
    await assertFails(getDocs(query(collection(ctx.firestore(), OVR_PATH))));
  });
});

// ── submissions allow list — SHAKEDOWN-002B regression (hotfix) ───────────────
//
// SHAKEDOWN-002B split `allow read` into `allow get` + `allow list` but dropped
// `canAccessOwn` from the list arm. These 4 cases verify the restored clause and
// guard the UM unit-scope constraint from regressing.
//
// Matrix:
//   ✓ agent self-list ALLOW   (canAccessOwn satisfied via where agentId==uid)
//   ✓ agent cross-list DENY   (canAccessOwn false, canManage false)
//   ✓ UM own-unit list ALLOW  (canManage + unitId==uid)
//   ✓ UM cross/unconstrained DENY (canManage but unitId clause not satisfied)

const SUB_PATH = `tenants/${TENANT_ID}/submissions`;

async function seedSubmissions() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // agent1 owns this submission, in unit um1
    await setDoc(doc(db, `${SUB_PATH}/agent1_2026-05-18`), {
      agentId:  'agent1',
      unitId:   'um1',
      tenantId: TENANT_ID,
      status:   'submitted',
    });
    // agent2 owns this submission, also in unit um1
    await setDoc(doc(db, `${SUB_PATH}/agent2_2026-05-18`), {
      agentId:  'agent2',
      unitId:   'um1',
      tenantId: TENANT_ID,
      status:   'submitted',
    });
    // agent3's submission is in unit um2
    await setDoc(doc(db, `${SUB_PATH}/agent3_2026-05-18`), {
      agentId:  'agent3',
      unitId:   'um2',
      tenantId: TENANT_ID,
      status:   'submitted',
    });
    // user docs so canManage lookups resolve
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/um1`),
      { role: 'unit_manager', branchId: 'branch-a', unitId: 'um1' });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/um2`),
      { role: 'unit_manager', branchId: 'branch-b', unitId: 'um2' });
  });
}

describe('submissions allow list (hotfix — SHAKEDOWN-002B regression)', () => {
  it('agent self-list ALLOW — where agentId==ownUid satisfies canAccessOwn', async () => {
    await seedSubmissions();
    const ctx = testEnv.authenticatedContext('agent1', { role: 'agent', tenantId: TENANT_ID });
    const q = query(collection(ctx.firestore(), SUB_PATH), where('agentId', '==', 'agent1'));
    await assertSucceeds(getDocs(q));
  });

  it('agent cross-list DENY — where agentId==otherUid: canAccessOwn false, not a manager', async () => {
    await seedSubmissions();
    const ctx = testEnv.authenticatedContext('agent1', { role: 'agent', tenantId: TENANT_ID });
    const q = query(collection(ctx.firestore(), SUB_PATH), where('agentId', '==', 'agent2'));
    await assertFails(getDocs(q));
  });

  it('UM own-unit list ALLOW — where unitId==umUid satisfies the UM clause', async () => {
    await seedSubmissions();
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    const q = query(collection(ctx.firestore(), SUB_PATH), where('unitId', '==', 'um1'));
    await assertSucceeds(getDocs(q));
  });

  it('UM cross-unit list DENY — where unitId==otherUmUid: UM clause fails (unitId != request.auth.uid)', async () => {
    await seedSubmissions();
    const ctx = testEnv.authenticatedContext('um1', tok('um1', 'unit_manager'));
    const q = query(collection(ctx.firestore(), SUB_PATH), where('unitId', '==', 'um2'));
    await assertFails(getDocs(q));
  });
});
