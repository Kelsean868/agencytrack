/**
 * Emulator rules tests — financing escalations (Track K · K10b).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/financingEscalations.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Collection: /tenants/{tid}/financingEscalations/{escalationId}
 *   ID = {agentId}_{reason}_{YYYY_MM}. States: 'open' → 'acknowledged'.
 *
 * Security model (K10b rules block):
 *   create — unit_manager ONLY, on an OWN-unit agent (agentUnitId == caller uid),
 *            self-stamped raiser, status 'open', reason in enum, full key set.
 *   get/list — SM/TA/PA tenant-wide, OR a BM whose branchId (read from the caller's
 *            user doc via callerBranchId) == the doc's denormalized branchId.
 *            unit_manager has NO read arm; agent excluded entirely.
 *   update — the ACK, by a reader, field-restricted to hasOnly(status,
 *            acknowledgedByUid, acknowledgedAt), new status 'acknowledged'.
 *   delete — nobody.
 *
 * callerBranchId reads tenants/{tid}/users/{uid}.branchId, so the BM/UM caller
 * user docs are seeded with rules disabled.
 *
 * K10c hardening: the create arm now get()-binds the RAISED agent's real user doc
 *   (raisedAgent().unitId == auth.uid AND request.branchId == raisedAgent().branchId).
 *   The harness therefore ALSO seeds the raised agent user docs (AGENT_A own-unit,
 *   AGENT_B other-unit, AGENT_NB missing-branchId) that the get() reads.
 *
 * Test matrix (24 cases — labels 1–19 + 13b + K10c 20–23; ack DENY cases run before
 * the successful ack so each isolates its own violation, not the status=='open'
 * precondition):
 *    1. UM own-unit create                                   → ALLOW
 *    2. UM other-unit create (agentUnitId != uid)            → DENY
 *    3. Agent create                                         → DENY
 *    4. Agent read                                           → DENY
 *    5. BM same-branch list                                  → ALLOW
 *    6. BM other-branch list                                 → DENY
 *    7. UM list (no read arm)                                → DENY
 *    8. SM read                                              → ALLOW
 *    9. TA read                                              → ALLOW
 *   10. BM other-branch ack                                  → DENY
 *   11. Ack forged acknowledgedByUid                         → DENY
 *   12. Ack touching an extra field                          → DENY
 *   13. BM same-branch ack                                   → ALLOW
 *  13b. Re-ack an already-acknowledged doc                   → DENY
 *   14. Delete                                               → DENY
 *   15. Cross-tenant read                                    → DENY
 *   16. Create with status != 'open'                         → DENY
 *   17. Create with reason outside enum                      → DENY
 *   18. Create missing a required key (branchId)             → DENY
 *   19. Create with a non-string branchId                    → DENY
 *   20. K10c correct-binding create (real unit + real branch)→ ALLOW
 *   21. K10c forged agentId (agent in another unit)          → DENY
 *   22. K10c wrong branchId (not agent's real branch)        → DENY
 *   23. K10c agent doc missing branchId (fail closed)        → DENY
 *
 * hasOnly gotcha (PR #365): the ack deny-test (#12) MUST change status to a value
 * that DIFFERS from the seed ('open' → 'acknowledged') so the touched extra field
 * appears in diff().affectedKeys() and the rule actually evaluates hasOnly.
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, getDocs, setDoc, updateDoc, deleteDoc, doc, collection, query, where } from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'fin-esc-test-tenant';
const OTHER_TENANT = 'fin-esc-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// Actors. UM uid == the unitId of its own agents (coachingNotes convention).
const UM_A      = 'umA';          // unit A, branch A
const UM_B      = 'umB';          // unit B, branch B
const BM_A_UID  = 'bmA';          // branch A
const BM_B_UID  = 'bmB';          // branch B
const AGENT_A   = 'agentA';       // unitId == UM_A, branchId == 'branchA'
const AGENT_B   = 'agentB';       // unitId == UM_B, branchId == 'branchB' (other unit)
const AGENT_NB  = 'agentNoBranch';// unitId == UM_A, but NO branchId (fail-closed case)
const BRANCH_A  = 'branchA';
const BRANCH_B  = 'branchB';
const REASON    = 'draw_decision';
const MONTH     = '2026_07';
const ESC_ID    = `${AGENT_A}_${REASON}_${MONTH}`;

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function escRef(db, id = ESC_ID, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/financingEscalations/${id}`);
}

function escCol(db, tenantId = TENANT_ID) {
  return collection(db, `tenants/${tenantId}/financingEscalations`);
}

// A full, rules-valid create payload raised by UM_A on AGENT_A (own-unit).
function createPayload(overrides = {}) {
  return {
    tenantId:     TENANT_ID,
    agentId:      AGENT_A,
    agentName:    'Agent A',
    agentUnitId:  UM_A,        // == raising UM uid (own-unit)
    branchId:     BRANCH_A,
    raisedByUid:  UM_A,
    raisedByName: 'Unit Mgr A',
    raisedByRole: 'unit_manager',
    reason:       REASON,
    note:         'Needs a draw decision.',
    status:       'open',
    createdAt:    new Date(),
    ...overrides,
  };
}

async function seed(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Caller user docs — callerBranchId() reads .branchId off these.
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM_A_UID}`), { role: 'branch_manager', branchId: BRANCH_A, tenantId: TENANT_ID });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${BM_B_UID}`), { role: 'branch_manager', branchId: BRANCH_B, tenantId: TENANT_ID });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${UM_A}`),     { role: 'unit_manager',  branchId: BRANCH_A, tenantId: TENANT_ID });
    // K10c: the create arm now get()s the RAISED agent's real user doc to bind
    //   unitId (== raising UM uid) and branchId (== denormalized branchId). Seed
    //   the agent user docs the get() reads:
    //   • AGENT_A — real unit UM_A, real branch branchA (the coherent, own-unit case).
    //   • AGENT_B — real unit UM_B, real branch branchB (used for the forged-agentId
    //     DENY: UM_A raising on AGENT_B while stamping agentUnitId=UM_A).
    //   • AGENT_NB — unit UM_A but NO branchId field (fail-closed DENY case).
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_A}`),  { role: 'agent', unitId: UM_A, branchId: BRANCH_A, tenantId: TENANT_ID });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_B}`),  { role: 'agent', unitId: UM_B, branchId: BRANCH_B, tenantId: TENANT_ID });
    await setDoc(doc(db, `tenants/${TENANT_ID}/users/${AGENT_NB}`), { role: 'agent', unitId: UM_A, tenantId: TENANT_ID });
    // A seeded OPEN escalation for read/ack cases.
    await setDoc(escRef(db), createPayload());
  });
}

let passed = 0, failed = 0;
async function t(label, fn) {
  try { await fn(); console.log(`  ✓ ${label}`); passed++; }
  catch (err) { console.error(`  ✗ ${label}`); console.error(`    ${err.message ?? err}`); failed++; }
}

async function main() {
  console.log('financing escalations — Firestore emulator rules tests (Track K · K10b)');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seed(testEnv);

  const umA = () => testEnv.authenticatedContext(UM_A,     authToken('unit_manager')).firestore();
  const umB = () => testEnv.authenticatedContext(UM_B,     authToken('unit_manager')).firestore();
  const bmA = () => testEnv.authenticatedContext(BM_A_UID, authToken('branch_manager')).firestore();
  const bmB = () => testEnv.authenticatedContext(BM_B_UID, authToken('branch_manager')).firestore();
  const sm  = () => testEnv.authenticatedContext('sm1',    authToken('sales_manager')).firestore();
  const ta  = () => testEnv.authenticatedContext('ta1',    authToken('tenant_admin')).firestore();
  const agent = () => testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();

  // ── CREATE ──────────────────────────────────────────────────────────────────
  await t('1. UM own-unit create → ALLOW', async () => {
    // Fresh ID (different reason) so it hits the create arm (resource == null).
    await assertSucceeds(setDoc(escRef(umA(), `${AGENT_A}_confirm_request_${MONTH}`),
      createPayload({ reason: 'confirm_request' })));
  });

  await t('2. UM other-unit create (agentUnitId != uid) → DENY', async () => {
    // UM_B raising on AGENT_A whose agentUnitId is UM_A → agentUnitId != auth.uid.
    await assertFails(setDoc(escRef(umB(), `${AGENT_A}_notify_5_3_${MONTH}`),
      createPayload({ reason: 'notify_5_3', raisedByUid: UM_B })));
  });

  await t('3. Agent create → DENY', async () => {
    await assertFails(setDoc(escRef(agent(), `${AGENT_A}_termination_risk_${MONTH}`),
      createPayload({ reason: 'termination_risk', raisedByUid: AGENT_A, raisedByRole: 'agent' })));
  });

  // ── READ ────────────────────────────────────────────────────────────────────
  await t('4. Agent read → DENY', async () => {
    await assertFails(getDoc(escRef(agent())));
  });

  await t('5. BM same-branch list → ALLOW', async () => {
    await assertSucceeds(getDocs(query(escCol(bmA()), where('branchId', '==', BRANCH_A))));
  });

  await t('6. BM other-branch list → DENY', async () => {
    // BM_B's branch is B; querying branch-A docs violates resource.data.branchId == callerBranchId.
    await assertFails(getDocs(query(escCol(bmB()), where('branchId', '==', BRANCH_A))));
  });

  await t('7. UM list (no read arm) → DENY', async () => {
    await assertFails(getDocs(query(escCol(umA()), where('branchId', '==', BRANCH_A))));
  });

  await t('8. SM read → ALLOW', async () => {
    await assertSucceeds(getDoc(escRef(sm())));
  });

  await t('9. TA read → ALLOW', async () => {
    await assertSucceeds(getDoc(escRef(ta())));
  });

  // ── UPDATE (ack) ──────────────────────────────────────────────────────────────
  // The DENY cases run FIRST, while ESC_ID is still 'open', so each isolates its own
  // violation (branch / forged-uid / extra-field) rather than the status precondition.
  await t('10. BM other-branch ack → DENY', async () => {
    await assertFails(updateDoc(escRef(bmB()), {
      status: 'acknowledged', acknowledgedByUid: BM_B_UID, acknowledgedAt: new Date(),
    }));
  });

  await t('11. Ack with a forged acknowledgedByUid → DENY (pinned to caller)', async () => {
    await assertFails(updateDoc(escRef(bmA()), {
      status: 'acknowledged', acknowledgedByUid: 'someOtherUid', acknowledgedAt: new Date(),
    }));
  });

  await t('12. Ack touching an extra field → DENY (status DIFFERS so hasOnly evaluates)', async () => {
    await assertFails(updateDoc(escRef(bmA()), {
      status: 'acknowledged', acknowledgedByUid: BM_A_UID, acknowledgedAt: new Date(),
      note: 'tampered', // extra key in the diff → hasOnly fails
    }));
  });

  // The successful ack flips ESC_ID open→acknowledged (must run after the DENY cases).
  await t('13. BM same-branch ack → ALLOW', async () => {
    await assertSucceeds(updateDoc(escRef(bmA()), {
      status: 'acknowledged', acknowledgedByUid: BM_A_UID, acknowledgedAt: new Date(),
    }));
  });

  // Re-acking an already-acknowledged doc is blocked by the status=='open' precondition
  // — no silent overwrite of who/when acknowledged.
  await t('13b. Re-ack an already-acknowledged doc → DENY (status != open)', async () => {
    await assertFails(updateDoc(escRef(bmA()), {
      status: 'acknowledged', acknowledgedByUid: BM_A_UID, acknowledgedAt: new Date(),
    }));
  });

  // ── DELETE ────────────────────────────────────────────────────────────────────
  await t('14. Delete → DENY', async () => {
    await assertFails(deleteDoc(escRef(bmA())));
  });

  // ── CROSS-TENANT ────────────────────────────────────────────────────────────
  await t('15. Cross-tenant read → DENY', async () => {
    const db = testEnv.authenticatedContext(BM_A_UID, authToken('branch_manager', OTHER_TENANT)).firestore();
    await assertFails(getDoc(escRef(db)));
  });

  // ── CREATE VALIDATION ──────────────────────────────────────────────────────────
  await t("16. Create with status != 'open' → DENY", async () => {
    await assertFails(setDoc(escRef(umA(), `${AGENT_A}_draw_decision_2026_08`),
      createPayload({ status: 'acknowledged' })));
  });

  await t('17. Create with reason outside enum → DENY', async () => {
    await assertFails(setDoc(escRef(umA(), `${AGENT_A}_bogus_${MONTH}`),
      createPayload({ reason: 'bogus_reason' })));
  });

  await t('18. Create missing a required key (branchId) → DENY', async () => {
    const p = createPayload({ reason: 'confirm_request' });
    delete p.branchId;
    await assertFails(setDoc(escRef(umA(), `${AGENT_A}_confirm_request_2026_08`), p));
  });

  await t('19. Create with a non-string branchId → DENY (type guard)', async () => {
    await assertFails(setDoc(escRef(umA(), `${AGENT_A}_confirm_request_2026_09`),
      createPayload({ reason: 'confirm_request', branchId: 12345 })));
  });

  // ── K10c get()-BINDING CASES ──────────────────────────────────────────────────
  // The new create arm get()s the RAISED agent's real user doc and binds
  //   raisedAgent().unitId == auth.uid  AND  request.resource.data.branchId ==
  //   raisedAgent().branchId. These cases exercise both bindings.

  await t('20. K10c: correct-binding create (agent really in UM unit + real branch) → ALLOW', async () => {
    // UM_A raises on AGENT_A: agent.unitId==UM_A==auth.uid, branchId==agent.branchId==branchA.
    await assertSucceeds(setDoc(escRef(umA(), `${AGENT_A}_notify_5_3_${MONTH}`),
      createPayload({ reason: 'notify_5_3' })));
  });

  await t('21. K10c: forged agentId (agent in ANOTHER unit, agentUnitId stamped as own) → DENY', async () => {
    // UM_A raises on AGENT_B (whose real unitId is UM_B) but stamps agentUnitId=UM_A
    //   (== auth.uid, so the OLD arm would have PASSED). branchId set to AGENT_B's real
    //   branch so ONLY the unitId binding (raisedAgent().unitId != auth.uid) trips.
    await assertFails(setDoc(escRef(umA(), `${AGENT_B}_draw_decision_${MONTH}`),
      createPayload({ agentId: AGENT_B, agentName: 'Agent B', agentUnitId: UM_A, branchId: BRANCH_B })));
  });

  await t('22. K10c: wrong branchId (string, but not the agent\'s real branch) → DENY', async () => {
    // UM_A raises on own-unit AGENT_A (unitId binding passes) but denormalizes a
    //   WRONG branchId (branchB, not agent's real branchA) → branchId binding trips.
    await assertFails(setDoc(escRef(umA(), `${AGENT_A}_confirm_request_2026_10`),
      createPayload({ reason: 'confirm_request', branchId: BRANCH_B })));
  });

  await t('23. K10c: agent user doc missing branchId → DENY (fail closed on null branchId)', async () => {
    // AGENT_NB is in UM_A's unit (unitId binding passes) but has NO branchId field;
    //   raisedAgent().branchId is null → request branchId == null is false → DENY.
    await assertFails(setDoc(escRef(umA(), `${AGENT_NB}_draw_decision_${MONTH}`),
      createPayload({ agentId: AGENT_NB, agentName: 'Agent NB', agentUnitId: UM_A, branchId: BRANCH_A })));
  });

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
