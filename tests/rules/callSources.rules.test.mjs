/**
 * Emulator rules tests — linked call sources, self-service model.
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/callSources.rules.test.mjs"
 *
 * Requires: Java JDK 17+ for the Firestore emulator.
 * NOTE: this repo runs the Firestore emulator on PORT 9090 (see firebase.json).
 *
 * Covers `match /callSources/{sourceId}` under the OWNER-ONLY read arm:
 *
 *     allow read: if isSignedIn()
 *                 && getTenantId() == tenantId
 *                 && resource.data.creditUid == request.auth.uid;
 *
 * There is deliberately NO role in that rule. The previous manager-scoped
 * version had to get "which roles, scoped how" right and got it wrong twice —
 * once caught pre-build (unit_manager via canManage), once in review (any
 * tenant_admin cross-tenant). `creditUid == uid` has no such degrees of freedom,
 * which is why cases 3 and 4 below are the load-bearing ones: a manager reading
 * an agent's link is now a DENY, and that is the operator's explicit ruling.
 *
 *   READ — get:
 *     1. owner gets own link                          → ALLOW
 *     2. another agent gets it                        → DENY
 *     3. branch_manager gets it   (decision 4)        → DENY
 *     4. tenant_admin gets it     (decision 4)        → DENY
 *     5. unauthenticated get                          → DENY
 *     6. cross-tenant caller with same uid            → DENY
 *   READ — list (the query must carry the constraint, or the rule cannot pass):
 *     7. owner lists WITH where(creditUid == uid)     → ALLOW
 *     8. owner lists UNCONSTRAINED                    → DENY
 *     9. agent lists with where(creditUid == OTHER)   → DENY
 *    10. branch_manager lists unconstrained           → DENY
 *   WRITE (CF-only — Admin SDK bypasses rules; every client write is denied):
 *    11. owner create                                 → DENY
 *    12. owner update (hand-revoke)                   → DENY
 *    13. owner delete                                 → DENY
 *    14. branch_manager create                        → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, deleteDoc, updateDoc, getDocs, collection, query, where,
} from 'firebase/firestore';

const PROJECT_ID   = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID    = 'call-sources-test-tenant';
const OTHER_TENANT = 'other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:9090').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '9090', 10);

const OWNER = 'agent_owner';   // creditUid on the seeded doc
const OTHER = 'agent_other';
const BM    = 'bm_user';
const TA    = 'ta_user';

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
// The query shape the UI must use. Rules filter documents; they do not narrow
// queries — so the constraint has to be in the query itself.
function ownedQuery(db, uid) {
  return query(srcCol(db), where('creditUid', '==', uid));
}

// Mirrors what createCallSource writes. tokenHash is a hash, never a raw token.
// creditUid === createdBy always, now that creation is self-credit.
function seededBody() {
  return {
    sourceId: SOURCE_ID,
    tenantId: TENANT_ID,
    sourceApp: 'kqm-calls',
    sourceUserId: 'kqm-user-77',
    creditUid: OWNER,
    label: 'Tracy-ann Nurse (assistant)',
    tokenHash: 'a'.repeat(64),
    active: true,
    createdBy: OWNER,
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
  console.log('Linked call sources (self-service) — rules verification');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: EMU_HOST, port: EMU_PORT },
  });

  // Everything after initialization runs inside try/finally so a seed or
  // assertion failure still tears the emulator context down (Rule 3).
  try {
    await testEnv.clearFirestore();
    await seedDocs(testEnv);

    const owner = () => testEnv.authenticatedContext(OWNER, token('agent')).firestore();
    const other = () => testEnv.authenticatedContext(OTHER, token('agent')).firestore();
    const bm    = () => testEnv.authenticatedContext(BM,    token('branch_manager')).firestore();
    const ta    = () => testEnv.authenticatedContext(TA,    token('tenant_admin')).firestore();
    // Same uid as the owner, but a token scoped to a different tenant.
    const ownerX = () => testEnv.authenticatedContext(OWNER, token('agent', OTHER_TENANT)).firestore();
    const anon  = () => testEnv.unauthenticatedContext().firestore();

    console.log('READ — get:');

    await t('1. owner gets own link → ALLOW', async () => {
      await assertSucceeds(getDoc(srcRef(owner())));
    });
    await t('2. another agent gets it → DENY', async () => {
      await assertFails(getDoc(srcRef(other())));
    });
    await t('3. branch_manager gets it → DENY  ← decision 4', async () => {
      await assertFails(getDoc(srcRef(bm())));
    });
    await t('4. tenant_admin gets it → DENY  ← decision 4', async () => {
      await assertFails(getDoc(srcRef(ta())));
    });
    await t('5. unauthenticated get → DENY', async () => {
      await assertFails(getDoc(srcRef(anon())));
    });
    await t('6. same uid, different tenant → DENY', async () => {
      await assertFails(getDoc(srcRef(ownerX())));
    });

    console.log('\nREAD — list (query must carry the constraint):');

    await t('7. owner lists WITH where(creditUid == uid) → ALLOW', async () => {
      await assertSucceeds(getDocs(ownedQuery(owner(), OWNER)));
    });
    await t('8. owner lists UNCONSTRAINED → DENY', async () => {
      await assertFails(getDocs(srcCol(owner())));
    });
    await t('9. agent lists with where(creditUid == someone else) → DENY', async () => {
      await assertFails(getDocs(ownedQuery(other(), OWNER)));
    });
    await t('10. branch_manager lists unconstrained → DENY', async () => {
      await assertFails(getDocs(srcCol(bm())));
    });

    console.log('\nWRITE — CF-only, every client write denied:');

    await t('11. owner create → DENY', async () => {
      await assertFails(setDoc(srcRef(owner(), 'src_new'), seededBody()));
    });
    await t('12. owner update (hand-revoke) → DENY', async () => {
      await assertFails(updateDoc(srcRef(owner()), { revokedAt: new Date() }));
    });
    await t('13. owner delete → DENY', async () => {
      await assertFails(deleteDoc(srcRef(owner())));
    });
    await t('14. branch_manager create → DENY', async () => {
      await assertFails(setDoc(srcRef(bm(), 'src_bm'), seededBody()));
    });

    console.log(`\n${passed} passed, ${failed} failed.`);
  } finally {
    await testEnv.cleanup();
  }
  // Set rather than exit() so the cleanup above is never skipped.
  process.exitCode = failed === 0 ? 0 : 1;
}

main();
