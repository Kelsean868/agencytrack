/**
 * Emulator rules tests — linked call sources (slice A).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/callSources.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 * NOTE: this repo runs the Firestore emulator on PORT 9090 (see firebase.json).
 *
 * Covers `match /callSources/{sourceId}`, gated on canManageCallSources —
 * NOT canManage. The unit_manager DENY cases below are the rules-layer half of
 * the F4 trap: canManage() routes through isManager(), which includes
 * unit_manager, so substituting it here would flip cases 3 and 10 to ALLOW and
 * hand a UM read access to a collection of KPI-writing credentials.
 *
 *   READ:
 *     1. branch_manager get                       → ALLOW
 *     2. sales_manager  get                       → ALLOW
 *     3. unit_manager   get   (F4 TRAP)           → DENY
 *     4. agent          get                       → DENY
 *     5. tenant_admin   get                       → ALLOW
 *     6. unauthenticated get                      → DENY
 *     7. cross-tenant branch_manager get          → DENY
 *     8. branch_manager list                      → ALLOW
 *     9. agent          list                      → DENY
 *    10. unit_manager   list (F4 TRAP)            → DENY
 *   WRITE (CF-only — Admin SDK bypasses rules; every client write is denied):
 *    11. branch_manager create                    → DENY
 *    12. tenant_admin   create                    → DENY
 *    13. branch_manager update (revoke by hand)   → DENY
 *    14. branch_manager delete                    → DENY
 *    15. agent          create                    → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, getDocs, collection } from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'call-sources-test-tenant';
const OTHER_TENANT = 'other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:9090').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '9090', 10);

const BM    = 'bm_user';
const SM    = 'sm_user';
const UM    = 'um_user';      // the F4 trap subject
const TA    = 'ta_user';
const AGENT = 'agent_user';
const BM_X  = 'bm_cross_tenant';

const SOURCE_ID = 'src_seeded';

function token(role, tenantId = TENANT_ID) {
  return { role, tenantId };
}
function srcRef(db, sourceId = SOURCE_ID, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/callSources/${sourceId}`);
}
function srcCol(db, tenantId = TENANT_ID) {
  return collection(db, `tenants/${tenantId}/callSources`);
}

// Mirrors what createCallSource writes. tokenHash is a hash, never a raw token.
function seededBody() {
  return {
    sourceId: SOURCE_ID,
    tenantId: TENANT_ID,
    sourceApp: 'kqm-calls',
    sourceUserId: 'kqm-user-77',
    creditUid: AGENT,
    label: 'Tracy-ann Nurse (assistant)',
    tokenHash: 'a'.repeat(64),
    active: true,
    createdBy: BM,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    lastUsedAt: null,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(srcRef(db), seededBody());
  });
}

// ── Harness ──────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
async function t(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message?.slice(0, 240) ?? err}`);
    failed++;
  }
}

async function main() {
  console.log('Linked call sources (slice A) — rules verification');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const bm    = () => testEnv.authenticatedContext(BM,    token('branch_manager')).firestore();
  const sm    = () => testEnv.authenticatedContext(SM,    token('sales_manager')).firestore();
  const um    = () => testEnv.authenticatedContext(UM,    token('unit_manager')).firestore();
  const ta    = () => testEnv.authenticatedContext(TA,    token('tenant_admin')).firestore();
  const agent = () => testEnv.authenticatedContext(AGENT, token('agent')).firestore();
  const bmX   = () => testEnv.authenticatedContext(BM_X,  token('branch_manager', OTHER_TENANT)).firestore();
  const anon  = () => testEnv.unauthenticatedContext().firestore();

  console.log('READ:');

  await t('1. branch_manager get → ALLOW', async () => {
    await assertSucceeds(getDoc(srcRef(bm())));
  });
  await t('2. sales_manager get → ALLOW', async () => {
    await assertSucceeds(getDoc(srcRef(sm())));
  });
  await t('3. unit_manager get → DENY  ← F4 TRAP', async () => {
    await assertFails(getDoc(srcRef(um())));
  });
  await t('4. agent get → DENY', async () => {
    await assertFails(getDoc(srcRef(agent())));
  });
  await t('5. tenant_admin get → ALLOW', async () => {
    await assertSucceeds(getDoc(srcRef(ta())));
  });
  await t('6. unauthenticated get → DENY', async () => {
    await assertFails(getDoc(srcRef(anon())));
  });
  await t('7. cross-tenant branch_manager get → DENY', async () => {
    await assertFails(getDoc(srcRef(bmX())));
  });
  await t('8. branch_manager list → ALLOW', async () => {
    await assertSucceeds(getDocs(srcCol(bm())));
  });
  await t('9. agent list → DENY', async () => {
    await assertFails(getDocs(srcCol(agent())));
  });
  await t('10. unit_manager list → DENY  ← F4 TRAP', async () => {
    await assertFails(getDocs(srcCol(um())));
  });

  console.log('\nWRITE — CF-only, every client write denied:');

  await t('11. branch_manager create → DENY', async () => {
    await assertFails(setDoc(srcRef(bm(), 'src_new'), seededBody()));
  });
  await t('12. tenant_admin create → DENY', async () => {
    await assertFails(setDoc(srcRef(ta(), 'src_new2'), seededBody()));
  });
  await t('13. branch_manager update (hand-revoke) → DENY', async () => {
    await assertFails(updateDoc(srcRef(bm()), { revokedAt: new Date() }));
  });
  await t('14. branch_manager delete → DENY', async () => {
    await assertFails(deleteDoc(srcRef(bm())));
  });
  await t('15. agent create → DENY', async () => {
    await assertFails(setDoc(srcRef(agent(), 'src_agent'), seededBody()));
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
  await testEnv.cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main();
