/**
 * Emulator rules tests — nudges collection (Compliance v2 Slice 2).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/nudges.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Model: /tenants/{tid}/nudges/{audienceUid}_{type}_{weekStart}
 *   CF-only writes (Admin SDK bypass) → NO client create/update.
 *   delete: the creating manager only (resource.data.createdBy == uid).
 *   get: audience reads own (ID prefix) OR upline manager (UM same-unit,
 *        BM same-branch, SM/TA/PA tenant-wide) — both arms derive audienceUid
 *        from the doc ID, so an absent nudge still authorizes an upline GET
 *        (clean not-found for the cooldown chip). NO list arm.
 *   auditNudges: client read/write fully denied (Admin-only).
 *   Plus two legacy-notifications sanity cases proving the existing block
 *   (userId schema, SEC-3 read) did NOT drift.
 *
 * Test matrix (22 cases):
 *   CREATE / UPDATE (CF-only)
 *    1. Manager client create on nudges                    → DENY
 *    2. Agent client create on nudges                      → DENY
 *    3. Client update on an existing nudge                 → DENY
 *   GET
 *    4. Audience reads own nudge (exists)                  → ALLOW
 *    5. Audience pre-read on absent own nudge (prefix)     → ALLOW
 *    6. UM same-unit reads agent nudge (exists)            → ALLOW
 *    7. UM same-unit reads ABSENT agent nudge (not-found)  → ALLOW
 *    8. UM other-unit reads agent nudge                    → DENY
 *    9. BM same-branch reads agent nudge                   → ALLOW
 *   10. BM other-branch reads agent nudge                  → DENY
 *   11. SM reads any agent nudge (tenant-wide)             → ALLOW
 *   12. Foreign agent reads another agent's nudge          → DENY
 *   13. Cross-tenant manager reads nudge                   → DENY
 *   14. Unauthenticated get                                → DENY
 *   LIST
 *   15. Manager list query on nudges                       → DENY (no list arm)
 *   AUDITNUDGES
 *   16. tenant_admin reads auditNudges                     → DENY
 *   17. Client create on auditNudges                       → DENY
 *   LEGACY notifications no-drift
 *   18. Recipient reads own userId-keyed notification      → ALLOW
 *   19. Foreign user reads another's notification          → DENY
 *   DELETE (last — consumes the seeded nudge)
 *   20. Non-creator manager deletes nudge                  → DENY
 *   21. Audience (agent) deletes nudge                     → DENY
 *   22. Creator manager deletes own nudge                  → ALLOW
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  getDoc, setDoc, deleteDoc, doc, collection, getDocs, query, where,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'nudge-rules-test-tenant';
const OTHER_TENANT = 'nudge-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const TYPE = 'compliance.filing.nudge';
const WEEK  = '2026-06-07';   // a Sunday
const GHOST = '2099-01-04';   // never-seeded week

// Users + scoping
const AGENT_A = 'agentA';  const BRANCH_A = 'branch-a';  const UNIT_1 = 'unit-1';
const AGENT_B = 'agentB';  const BRANCH_B = 'branch-b';  const UNIT_2 = 'unit-2';
const UM_SAME  = 'umSame';   // unit-1 (agentA's unit) — also the nudge CREATOR
const UM_OTHER = 'umOther';  // unit-2
const BM_SAME  = 'bmSame';   // branch-a
const BM_OTHER = 'bmOther';  // branch-b
const SM1      = 'sm1';
const TA1      = 'ta1';

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function nudgeRef(db, audienceUid, week, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/nudges/${audienceUid}_${TYPE}_${week}`);
}

function nudgePayload(audienceUid, createdBy) {
  return {
    type: TYPE,
    audienceUid,
    payload: { weekStart: WEEK, lens: 'filing', managerName: 'Uma UM' },
    createdBy,
    createdAt: new Date(),
    readAt: null,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const userDoc = (uid, role, branchId, unitId) => ({ uid, role, tenantId: TENANT_ID, branchId, unitId });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_A}`),  userDoc(AGENT_A,  'agent',          BRANCH_A, UNIT_1));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_B}`),  userDoc(AGENT_B,  'agent',          BRANCH_B, UNIT_2));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM_SAME}`),  userDoc(UM_SAME,  'unit_manager',   BRANCH_A, UNIT_1));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM_OTHER}`), userDoc(UM_OTHER, 'unit_manager',   BRANCH_A, UNIT_2));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM_SAME}`),  userDoc(BM_SAME,  'branch_manager', BRANCH_A, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM_OTHER}`), userDoc(BM_OTHER, 'branch_manager', BRANCH_B, null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${SM1}`),      userDoc(SM1,      'sales_manager',  null,     null));
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${TA1}`),      userDoc(TA1,      'tenant_admin',   null,     null));

    // The nudge under test — created by UM_SAME (the in-scope unit manager).
    await setDoc(nudgeRef(db, AGENT_A, WEEK), nudgePayload(AGENT_A, UM_SAME));

    // A legacy userId-keyed notification for the no-drift sanity cases.
    await setDoc(doc(db, `tenants/${TENANT_ID}/notifications/legacy1`), {
      userId: AGENT_A, tenantId: TENANT_ID, type: 'generic',
      title: 'hi', body: 'b', link: null, read: false, createdAt: new Date(),
    });

    // An auditNudges doc for the admin-only read deny case.
    await setDoc(doc(db, `tenants/${TENANT_ID}/auditNudges/audit1`), {
      actorUid: UM_SAME, actorRole: 'unit_manager', audienceUid: AGENT_A,
      type: TYPE, weekStart: WEEK, at: new Date(),
    });
  });
}

let passed = 0;
let failed = 0;

async function t(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message ?? err}`);
    failed++;
  }
}

async function main() {
  console.log('nudges — Firestore emulator rules tests (Compliance v2 Slice 2)');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const agentA = () => testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
  const agentB = () => testEnv.authenticatedContext(AGENT_B, authToken('agent')).firestore();
  const umSame = () => testEnv.authenticatedContext(UM_SAME, authToken('unit_manager')).firestore();

  // ── CREATE / UPDATE (CF-only) ─────────────────────────────────────────────────

  await t('1. Manager client create on nudges → DENY', async () => {
    await assertFails(setDoc(nudgeRef(umSame(), AGENT_A, '2026-06-14'), nudgePayload(AGENT_A, UM_SAME)));
  });

  await t('2. Agent client create on nudges → DENY', async () => {
    await assertFails(setDoc(nudgeRef(agentA(), AGENT_A, '2026-06-21'), nudgePayload(AGENT_A, AGENT_A)));
  });

  await t('3. Client update on an existing nudge → DENY', async () => {
    // Existing doc → write is an update → CF-only rule denies.
    await assertFails(setDoc(nudgeRef(umSame(), AGENT_A, WEEK), nudgePayload(AGENT_A, UM_SAME)));
  });

  // ── GET ───────────────────────────────────────────────────────────────────────

  await t('4. Audience reads own nudge (exists) → ALLOW', async () => {
    await assertSucceeds(getDoc(nudgeRef(agentA(), AGENT_A, WEEK)));
  });

  await t('5. Audience pre-read on absent own nudge (prefix) → ALLOW', async () => {
    await assertSucceeds(getDoc(nudgeRef(agentA(), AGENT_A, GHOST)));
  });

  await t('6. UM same-unit reads agent nudge (exists) → ALLOW', async () => {
    await assertSucceeds(getDoc(nudgeRef(umSame(), AGENT_A, WEEK)));
  });

  await t('7. UM same-unit reads ABSENT agent nudge (clean not-found) → ALLOW', async () => {
    await assertSucceeds(getDoc(nudgeRef(umSame(), AGENT_A, GHOST)));
  });

  await t('8. UM other-unit reads agent nudge → DENY', async () => {
    const db = testEnv.authenticatedContext(UM_OTHER, authToken('unit_manager')).firestore();
    await assertFails(getDoc(nudgeRef(db, AGENT_A, WEEK)));
  });

  await t('9. BM same-branch reads agent nudge → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_SAME, authToken('branch_manager')).firestore();
    await assertSucceeds(getDoc(nudgeRef(db, AGENT_A, WEEK)));
  });

  await t('10. BM other-branch reads agent nudge → DENY', async () => {
    const db = testEnv.authenticatedContext(BM_OTHER, authToken('branch_manager')).firestore();
    await assertFails(getDoc(nudgeRef(db, AGENT_A, WEEK)));
  });

  await t('11. SM reads any agent nudge (tenant-wide) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(SM1, authToken('sales_manager')).firestore();
    await assertSucceeds(getDoc(nudgeRef(db, AGENT_A, WEEK)));
  });

  await t('12. Foreign agent reads another agent nudge → DENY', async () => {
    await assertFails(getDoc(nudgeRef(agentB(), AGENT_A, WEEK)));
  });

  await t('13. Cross-tenant manager reads nudge → DENY', async () => {
    const db = testEnv.authenticatedContext(SM1, authToken('sales_manager', OTHER_TENANT)).firestore();
    await assertFails(getDoc(nudgeRef(db, AGENT_A, WEEK)));
  });

  await t('14. Unauthenticated get → DENY', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(nudgeRef(db, AGENT_A, WEEK)));
  });

  // ── LIST ────────────────────────────────────────────────────────────────────

  await t('15. Manager list query on nudges → DENY (no list arm)', async () => {
    const q = query(
      collection(umSame(), `tenants/${TENANT_ID}/nudges`),
      where('audienceUid', '==', AGENT_A),
    );
    await assertFails(getDocs(q));
  });

  // ── AUDITNUDGES ───────────────────────────────────────────────────────────────

  await t('16. tenant_admin reads auditNudges → DENY', async () => {
    const db = testEnv.authenticatedContext(TA1, authToken('tenant_admin')).firestore();
    await assertFails(getDoc(doc(db, `tenants/${TENANT_ID}/auditNudges/audit1`)));
  });

  await t('17. Client create on auditNudges → DENY', async () => {
    const db = testEnv.authenticatedContext(TA1, authToken('tenant_admin')).firestore();
    await assertFails(setDoc(doc(db, `tenants/${TENANT_ID}/auditNudges/audit2`), { actorUid: TA1 }));
  });

  // ── LEGACY notifications no-drift ──────────────────────────────────────────────

  await t('18. Recipient reads own userId-keyed notification → ALLOW', async () => {
    await assertSucceeds(getDoc(doc(agentA(), `tenants/${TENANT_ID}/notifications/legacy1`)));
  });

  await t('19. Foreign user reads another notification → DENY', async () => {
    await assertFails(getDoc(doc(agentB(), `tenants/${TENANT_ID}/notifications/legacy1`)));
  });

  // ── DELETE (last — consumes the seeded nudge) ──────────────────────────────────

  await t('20. Non-creator manager deletes nudge → DENY', async () => {
    const db = testEnv.authenticatedContext(BM_SAME, authToken('branch_manager')).firestore();
    await assertFails(deleteDoc(nudgeRef(db, AGENT_A, WEEK)));
  });

  await t('21. Audience (agent) deletes nudge → DENY', async () => {
    await assertFails(deleteDoc(nudgeRef(agentA(), AGENT_A, WEEK)));
  });

  await t('22. Creator manager deletes own nudge → ALLOW', async () => {
    await assertSucceeds(deleteDoc(nudgeRef(umSame(), AGENT_A, WEEK)));
  });

  // ── Teardown ────────────────────────────────────────────────────────────────

  await testEnv.cleanup();

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed (22 expected)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
