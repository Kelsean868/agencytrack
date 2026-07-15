/**
 * Emulator rules tests — configAudit (Run 5 Item 3, append-only config audit).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/configAudit.rules.test.mjs"
 *
 * Contract: append-only tenant config audit trail under
 * tenants/{tid}/configAudit/{autoId}. tenant_admin (own tenant) and
 * platform_admin (cross-tenant) may create + read. Every entry is shape-locked
 * to the buildAuditEntry payload (settingId/section/from/to/who/whoName/at
 * [+correction]); `who` must equal auth.uid; `at` must equal request.time
 * (serverTimestamp); from/to are string-or-null. No updates, no deletes.
 *
 * PROJECT_ID note: this suite talks ONLY to the local Firestore emulator via
 * initializeTestEnvironment({ firestore: { host, port } }); the projectId string
 * is an emulator namespace, NOT a live-project handle. Mirrors the repo idiom
 * (appointments.rules.test.mjs) — no credentials, no network, no live contact.
 */
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  setDoc, updateDoc, deleteDoc, doc, collection, getDoc, addDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID = 'cfg-audit-test-tenant';
const OTHER_TENANT = 'cfg-audit-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const TA1 = 'ta1'; // tenant_admin, TENANT_ID
const TA2 = 'ta2'; // tenant_admin, OTHER_TENANT
const PA1 = 'pa1'; // platform_admin (cross-tenant)
const AG1 = 'ag1'; // agent, TENANT_ID
const E1 = 'seeded-entry-1';

function authToken(role, tenantId) {
  return tenantId === undefined ? { role } : { role, tenantId };
}
function auditColl(db, tenantId = TENANT_ID) {
  return collection(db, `tenants/${tenantId}/configAudit`);
}
function auditRef(db, id, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/configAudit/${id}`);
}
/** Mirrors configAuditService.buildAuditEntry output shape. */
function validEntry(who, over = {}) {
  return {
    settingId: 'jfwCount',
    section: 'managerActivityStandards',
    from: 'OFF',
    to: 'ON',
    who,
    whoName: 'Test Admin',
    at: serverTimestamp(),
    ...over,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // A pre-existing audit entry to exercise update/delete/read denials.
    await setDoc(auditRef(db, E1), {
      settingId: 'jfwCount', section: 'managerActivityStandards',
      from: 'OFF', to: 'ON', who: TA1, whoName: 'Test Admin',
      at: Timestamp.fromMillis(1_700_000_000_000),
    });
  });
}

let passed = 0, failed = 0;
async function t(label, fn) {
  try { await fn(); console.log(`  OK ${label}`); passed++; }
  catch (err) { console.error(`  XX ${label}`); console.error(`    ${err.message ?? err}`); failed++; }
}

async function main() {
  console.log('configAudit - Firestore emulator rules tests');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID, firestore: { host: EMU_HOST, port: EMU_PORT },
  });
  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const ta1Db = testEnv.authenticatedContext(TA1, authToken('tenant_admin', TENANT_ID)).firestore();
  const ta2Db = testEnv.authenticatedContext(TA2, authToken('tenant_admin', OTHER_TENANT)).firestore();
  const pa1Db = testEnv.authenticatedContext(PA1, authToken('platform_admin')).firestore();
  const ag1Db = testEnv.authenticatedContext(AG1, authToken('agent', TENANT_ID)).firestore();

  console.log(''); console.log('create:');
  await t('1. tenant_admin creates valid entry (from/to strings) in own tenant -> ALLOW', () =>
    assertSucceeds(addDoc(auditColl(ta1Db), validEntry(TA1))));
  await t('2. first-set save shape (from: null, to: string) -> ALLOW', () =>
    assertSucceeds(addDoc(auditColl(ta1Db), validEntry(TA1, { from: null, to: 'true' }))));
  await t('3a. entry with correction string -> ALLOW', () =>
    assertSucceeds(addDoc(auditColl(ta1Db), validEntry(TA1, { correction: 'typo fix' }))));
  await t('3b. correction wrong type (number) -> DENY', () =>
    assertFails(addDoc(auditColl(ta1Db), validEntry(TA1, { correction: 42 }))));
  await t('4. who != auth.uid (forged) -> DENY', () =>
    assertFails(addDoc(auditColl(ta1Db), validEntry('someone-else'))));
  await t('5a. missing required key (drop whoName) -> DENY', () => {
    const e = validEntry(TA1); delete e.whoName;
    return assertFails(addDoc(auditColl(ta1Db), e));
  });
  await t('5b. extra (non-allowlisted) key -> DENY', () =>
    assertFails(addDoc(auditColl(ta1Db), validEntry(TA1, { rogue: 'x' }))));
  await t('6. at not serverTimestamp (past literal Timestamp) -> DENY', () =>
    assertFails(addDoc(auditColl(ta1Db), validEntry(TA1, { at: Timestamp.fromMillis(1_700_000_000_000) }))));
  await t('7a. update of an existing entry -> DENY', () =>
    assertFails(updateDoc(auditRef(ta1Db, E1), { to: 'CHANGED' })));
  await t('7b. delete of an existing entry (even tenant_admin) -> DENY', () =>
    assertFails(deleteDoc(auditRef(ta1Db, E1))));
  await t('8a. agent create -> DENY', () =>
    assertFails(addDoc(auditColl(ag1Db), validEntry(AG1))));
  await t('8b. cross-tenant tenant_admin create -> DENY', () =>
    assertFails(addDoc(auditColl(ta2Db), validEntry(TA2))));
  await t('8c. platform_admin cross-tenant create -> ALLOW', () =>
    assertSucceeds(addDoc(auditColl(pa1Db), validEntry(PA1))));

  console.log(''); console.log('read:');
  await t('9a. tenant_admin own-tenant read -> ALLOW', () =>
    assertSucceeds(getDoc(auditRef(ta1Db, E1))));
  await t('9b. agent read -> DENY', () =>
    assertFails(getDoc(auditRef(ag1Db, E1))));
  await t('9c. cross-tenant tenant_admin read -> DENY', () =>
    assertFails(getDoc(auditRef(ta2Db, E1))));

  await testEnv.cleanup();
  console.log('');
  console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed (16 expected)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
