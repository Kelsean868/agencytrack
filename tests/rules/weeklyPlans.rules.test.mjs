/**
 * Emulator rules tests — weeklyPlans collection (Weekly Planner v2 Slice 2).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/weeklyPlans.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 *
 * Privacy model: agent owns full CRUD on OWN doc only; upline GET mirrors the
 * moneyNeeds cross-doc-lookup scoping (UM same-unit, BM same-branch, SM tenant-
 * wide) MINUS the visibility gate; no manager write/delete; no list arm.
 *
 * Test matrix (29 cases):
 *   CREATE
 *    1. Agent creates own valid plan                          → ALLOW
 *    2. Agent forges agentId (payload.agentId = other)        → DENY
 *    3. Agent writes to another agent's docId (prefix ≠ uid)  → DENY
 *    4. UM attempts create on an agent's plan                 → DENY (no manager write)
 *    5. Agent sends non-int target                            → DENY
 *    6. Agent sends bad provenance enum                       → DENY
 *    7. Agent omits a required key (no targets)               → DENY
 *    8. Agent sends weekStart as string (not timestamp)       → DENY
 *    9. Cross-tenant create                                   → DENY
 *   10. Unauthenticated create                                → DENY
 *   11. Extra TOP-LEVEL key (hasOnly)                         → DENY
 *   12. Extra TARGETS key (targets hasOnly)                   → DENY
 *   13. Malformed planId date segment                         → DENY
 *   UPDATE
 *   14. Owner re-commits own plan (targets change)            → ALLOW
 *   15. Other agent updates owner's plan (changed field)      → DENY
 *   16. Owner update mutating weekStart                       → DENY (week immutable)
 *   GET
 *   17. Owner reads own plan (exists)                         → ALLOW
 *   18. Owner pre-write get on non-existent doc (prefix)      → ALLOW
 *   19. NON-owner get on non-existent doc                     → DENY (no existence oracle)
 *   20. UM same-unit reads agent plan                         → ALLOW
 *   21. UM other-unit reads agent plan                        → DENY
 *   22. BM same-branch reads agent plan                       → ALLOW
 *   23. BM other-branch reads agent plan                      → DENY
 *   24. SM reads any agent plan (tenant-wide)                 → ALLOW
 *   25. Unauthenticated get                                   → DENY
 *   DELETE
 *   26. Owner deletes own plan                                → ALLOW
 *   27. Manager attempts delete                               → DENY
 *   28. Other agent deletes owner's plan                      → DENY
 *   LIST
 *   29. Agent self-list query                                 → DENY (no list arm)
 *   KEY-DRIFT REGRESSION (C2 — weeklyPlanService real payload shape)
 *   30. Real weeklyPlanService payload (targets.telContacts)   → ALLOW
 *   31. Stale contactsMade-keyed payload (pre-fix shape)       → DENY (hasOnly)
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
const TENANT_ID  = 'wp-rules-test-tenant';
const OTHER_TENANT = 'wp-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

// Users + scoping
const AGENT_A = 'agentA';  const BRANCH_A = 'branch-a';  const UNIT_1 = 'unit-1';
const AGENT_B = 'agentB';  const BRANCH_B = 'branch-b';  const UNIT_2 = 'unit-2';
const UM_SAME  = 'umSame';   // unit-1 (agentA's unit)
const UM_OTHER = 'umOther';  // unit-2
const BM_SAME  = 'bmSame';   // branch-a
const BM_OTHER = 'bmOther';  // branch-b
const SM1      = 'sm1';

const WEEK   = '2026-06-07';  // a Sunday (rules only check \d{4}-\d{2}-\d{2})
const WEEK_2 = '2026-06-14';
const GHOST  = '2099-01-04';  // never-seeded week

function authToken(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}

function planRef(db, agentId, week, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/weeklyPlans/${agentId}_${week}`);
}

// Matches the REAL payload shape weeklyPlanService.js writes (PLAN_METRIC_KEYS
// in weeklyPlanAssembly.js) — telContacts, not contactsMade. See C2 (VH run):
// rules previously required contactsMade, which no live writer ever sent.
function validPayload(agentId) {
  return {
    agentId,
    tenantId: TENANT_ID,
    weekStart: new Date(`${WEEK}T04:00:00Z`),
    targets: {
      callsMade: 100, telContacts: 40, factFindsCompleted: 8,
      closingInterviewsKept: 5, applicationsSubmitted: 3,
    },
    provenance: {
      callsMade: 'derived', telContacts: 'floor', factFindsCompleted: 'floor',
      closingInterviewsKept: 'derived', applicationsSubmitted: 'agent',
    },
    anchorAPIAtCommit: 200000,
    committedAt: new Date(),
    updatedAt: new Date(),
  };
}

// Pre-fix stale shape (what the rules WRONGLY required until C2): contactsMade
// instead of telContacts in both targets and provenance.
function stalePayload(agentId) {
  const p = validPayload(agentId);
  const { telContacts: tc, ...targetsRest } = p.targets;
  const { telContacts: tcProv, ...provRest } = p.provenance;
  return {
    ...p,
    targets: { ...targetsRest, contactsMade: tc },
    provenance: { ...provRest, contactsMade: tcProv },
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

    // Pre-seed agentA's plan for read/update/delete tests.
    await setDoc(planRef(db, AGENT_A, WEEK), validPayload(AGENT_A));
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
  console.log('weeklyPlans — Firestore emulator rules tests (Weekly Planner v2 Slice 2)');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const agentA = () => testEnv.authenticatedContext(AGENT_A, authToken('agent')).firestore();
  const agentB = () => testEnv.authenticatedContext(AGENT_B, authToken('agent')).firestore();

  // ── CREATE ──────────────────────────────────────────────────────────────────

  await t('1. Agent creates own valid plan → ALLOW', async () => {
    await assertSucceeds(setDoc(planRef(agentA(), AGENT_A, WEEK_2), { ...validPayload(AGENT_A), weekStart: new Date(`${WEEK_2}T04:00:00Z`) }));
  });

  await t('2. Agent forges agentId (payload.agentId = other) → DENY', async () => {
    await assertFails(setDoc(planRef(agentA(), AGENT_A, '2026-06-21'), { ...validPayload(AGENT_B) }));
  });

  await t('3. Agent writes to another agent docId (prefix ≠ uid) → DENY', async () => {
    // docId prefix = agentB, payload.agentId = agentA → prefix check fails.
    await assertFails(setDoc(planRef(agentA(), AGENT_B, '2026-06-21'), { ...validPayload(AGENT_A) }));
  });

  // Rotted test data (fixed): the case previously used UM_SAME as BOTH the
  // target docId/agentId and the caller uid, which is a producing manager
  // filing their OWN plan — allowed by design (firestore.rules ~L1900:
  // "allow create: if (isAgent() || isProducingManager()) ..." — UM/BM file
  // personal policies alongside their management role, same pattern as
  // moneyNeeds). That is not "manager writes an AGENT's plan"; it vacuously
  // passed the wrong scenario. Retargeted at a real agent's doc so the
  // assertion actually exercises `d.agentId == request.auth.uid` denying a
  // manager who is not that agent — matches case 27 (delete) below, which
  // already targets AGENT_A correctly.
  await t("4. UM attempts create on an agent's plan (not own) → DENY (no manager write)", async () => {
    const db = testEnv.authenticatedContext(UM_SAME, authToken('unit_manager')).firestore();
    await assertFails(setDoc(planRef(db, AGENT_A, '2026-06-21'), { ...validPayload(AGENT_A) }));
  });

  await t('5. Agent sends non-int target → DENY', async () => {
    const p = validPayload(AGENT_A);
    p.targets.callsMade = 100.5;
    await assertFails(setDoc(planRef(agentA(), AGENT_A, '2026-06-28'), p));
  });

  await t('6. Agent sends bad provenance enum → DENY', async () => {
    const p = validPayload(AGENT_A);
    p.provenance.callsMade = 'personal';
    await assertFails(setDoc(planRef(agentA(), AGENT_A, '2026-07-05'), p));
  });

  await t('7. Agent omits a required key (no targets) → DENY', async () => {
    const { targets: _t, ...noTargets } = validPayload(AGENT_A);
    await assertFails(setDoc(planRef(agentA(), AGENT_A, '2026-07-12'), noTargets));
  });

  await t('8. Agent sends weekStart as string → DENY', async () => {
    await assertFails(setDoc(planRef(agentA(), AGENT_A, '2026-07-19'), { ...validPayload(AGENT_A), weekStart: '2026-07-19' }));
  });

  await t('9. Cross-tenant create → DENY', async () => {
    // Caller token tenant = OTHER_TENANT, writing to TENANT_ID path.
    const db = testEnv.authenticatedContext(AGENT_A, authToken('agent', OTHER_TENANT)).firestore();
    await assertFails(setDoc(planRef(db, AGENT_A, '2026-07-26'), { ...validPayload(AGENT_A) }));
  });

  await t('10. Unauthenticated create → DENY', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(planRef(db, AGENT_A, '2026-08-02'), { ...validPayload(AGENT_A) }));
  });

  await t('11. Extra TOP-LEVEL key → DENY (hasOnly)', async () => {
    await assertFails(setDoc(planRef(agentA(), AGENT_A, '2026-08-09'), { ...validPayload(AGENT_A), sneaky: 1 }));
  });

  await t('12. Extra TARGETS key → DENY (targets hasOnly)', async () => {
    const p = validPayload(AGENT_A);
    p.targets.bonusMetric = 9;
    await assertFails(setDoc(planRef(agentA(), AGENT_A, '2026-08-16'), p));
  });

  await t('13. Malformed planId date segment → DENY', async () => {
    // docId date segment "2026-6-7" fails \\d{4}-\\d{2}-\\d{2}.
    await assertFails(setDoc(doc(agentA(), `tenants/${TENANT_ID}/weeklyPlans/${AGENT_A}_2026-6-7`), { ...validPayload(AGENT_A) }));
  });

  // ── UPDATE ──────────────────────────────────────────────────────────────────

  await t('14. Owner re-commits own plan (targets change) → ALLOW', async () => {
    const p = validPayload(AGENT_A);
    p.targets.callsMade = 120;
    p.provenance.callsMade = 'agent';
    await assertSucceeds(setDoc(planRef(agentA(), AGENT_A, WEEK), p));
  });

  await t('15. Other agent updates owner plan (changed field) → DENY', async () => {
    const p = validPayload(AGENT_B);  // payload.agentId = agentB (caller's own uid)
    p.targets.callsMade = 7;          // real diff
    await assertFails(setDoc(planRef(agentB(), AGENT_A, WEEK), p));
  });

  await t('16. Owner update mutating weekStart → DENY (week immutable)', async () => {
    await assertFails(setDoc(planRef(agentA(), AGENT_A, WEEK), { ...validPayload(AGENT_A), weekStart: new Date('2025-01-05T04:00:00Z') }));
  });

  // ── GET ─────────────────────────────────────────────────────────────────────

  await t('17. Owner reads own plan (exists) → ALLOW', async () => {
    await assertSucceeds(getDoc(planRef(agentA(), AGENT_A, WEEK)));
  });

  await t('18. Owner pre-write get on non-existent doc (prefix) → ALLOW', async () => {
    await assertSucceeds(getDoc(planRef(agentA(), AGENT_A, GHOST)));
  });

  await t('19. NON-owner get on non-existent doc → DENY (no existence oracle)', async () => {
    await assertFails(getDoc(planRef(agentB(), AGENT_A, GHOST)));
  });

  await t('20. UM same-unit reads agent plan → ALLOW', async () => {
    const db = testEnv.authenticatedContext(UM_SAME, authToken('unit_manager')).firestore();
    await assertSucceeds(getDoc(planRef(db, AGENT_A, WEEK)));
  });

  await t('21. UM other-unit reads agent plan → DENY', async () => {
    const db = testEnv.authenticatedContext(UM_OTHER, authToken('unit_manager')).firestore();
    await assertFails(getDoc(planRef(db, AGENT_A, WEEK)));
  });

  await t('22. BM same-branch reads agent plan → ALLOW', async () => {
    const db = testEnv.authenticatedContext(BM_SAME, authToken('branch_manager')).firestore();
    await assertSucceeds(getDoc(planRef(db, AGENT_A, WEEK)));
  });

  await t('23. BM other-branch reads agent plan → DENY', async () => {
    const db = testEnv.authenticatedContext(BM_OTHER, authToken('branch_manager')).firestore();
    await assertFails(getDoc(planRef(db, AGENT_A, WEEK)));
  });

  await t('24. SM reads any agent plan (tenant-wide) → ALLOW', async () => {
    const db = testEnv.authenticatedContext(SM1, authToken('sales_manager')).firestore();
    await assertSucceeds(getDoc(planRef(db, AGENT_A, WEEK)));
  });

  await t('25. Unauthenticated get → DENY', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(planRef(db, AGENT_A, WEEK)));
  });

  // ── KEY-DRIFT REGRESSION (C2) ────────────────────────────────────────────────

  await t('30. Real weeklyPlanService payload (targets.telContacts) → ALLOW', async () => {
    await assertSucceeds(setDoc(planRef(agentA(), AGENT_A, '2026-08-23'), { ...validPayload(AGENT_A), weekStart: new Date('2026-08-23T04:00:00Z') }));
  });

  await t('31. Stale contactsMade-keyed payload (pre-fix shape) → DENY (hasOnly)', async () => {
    await assertFails(setDoc(planRef(agentA(), AGENT_A, '2026-08-30'), { ...stalePayload(AGENT_A), weekStart: new Date('2026-08-30T04:00:00Z') }));
  });

  // ── LIST ────────────────────────────────────────────────────────────────────

  await t('29. Agent self-list query → DENY (no list arm)', async () => {
    const q = query(
      collection(agentA(), `tenants/${TENANT_ID}/weeklyPlans`),
      where('agentId', '==', AGENT_A),
    );
    await assertFails(getDocs(q));
  });

  // ── DELETE (last — consumes the seeded doc) ──────────────────────────────────

  await t('27. Manager attempts delete → DENY', async () => {
    const db = testEnv.authenticatedContext(UM_SAME, authToken('unit_manager')).firestore();
    await assertFails(deleteDoc(planRef(db, AGENT_A, WEEK)));
  });

  await t('28. Other agent deletes owner plan → DENY', async () => {
    await assertFails(deleteDoc(planRef(agentB(), AGENT_A, WEEK)));
  });

  await t('26. Owner deletes own plan → ALLOW', async () => {
    await assertSucceeds(deleteDoc(planRef(agentA(), AGENT_A, WEEK)));
  });

  // ── Teardown ────────────────────────────────────────────────────────────────

  await testEnv.cleanup();

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed (31 expected)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
