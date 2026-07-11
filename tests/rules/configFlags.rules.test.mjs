/**
 * Emulator rules tests — config/settings featureFlags allowlist (Run 5 Item 5).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/configFlags.rules.test.mjs"
 *
 * Contract: on config/settings, client writes may only add/modify/REMOVE the
 * allowlisted feature-flag keys (persistencyV2 / policyLedgerCampaignLens /
 * awardsProvenance) in the featureFlags + featureFlagsMeta maps. Non-settings
 * config docs (companyMinimums, managerActivityStandards, awardsRuleset_2026)
 * are unaffected. delete arm on settings unchanged (still allowed).
 *
 * MapDiff/merge semantics under test (per CLAUDE.md banked traps):
 *   - request.resource.data is the POST-MERGE doc — unchanged pre-existing keys
 *     do NOT appear in the diff.
 *   - a write of a value IDENTICAL to the stored one is invisible to
 *     diff().affectedKeys() — every deny-test writes a DIFFERENT value.
 *   - doc-create path exercises resource == null (old maps default to {}).
 *
 * PROJECT_ID note: emulator-only namespace (see configAudit.rules.test.mjs) —
 * no credentials, no network, no live contact.
 */
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  setDoc, doc, getDoc, deleteDoc, serverTimestamp, deleteField,
} from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID = 'cfg-flags-test-tenant';
const OTHER_TENANT = 'cfg-flags-other-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const TA1 = 'ta1'; // tenant_admin, TENANT_ID
const TA2 = 'ta2'; // tenant_admin, OTHER_TENANT
const AG1 = 'ag1'; // agent, TENANT_ID

function authToken(role, tenantId) {
  return { role, tenantId };
}
function cfgRef(db, docId, tenantId = TENANT_ID) {
  return doc(db, `tenants/${tenantId}/config/${docId}`);
}
function metaEntry() {
  return { who: TA1, whoName: 'Test Admin', date: serverTimestamp() };
}

/** Overwrite config/settings via a rules-bypass context (no merge) to reset state. */
async function setSettings(testEnv, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(cfgRef(ctx.firestore(), 'settings'), data);
  });
}
/** Delete config/settings via a rules-bypass context (exercise resource == null). */
async function delSettings(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(cfgRef(ctx.firestore(), 'settings'));
  });
}

let passed = 0, failed = 0;
async function t(label, fn) {
  try { await fn(); console.log(`  OK ${label}`); passed++; }
  catch (err) { console.error(`  XX ${label}`); console.error(`    ${err.message ?? err}`); failed++; }
}

async function main() {
  console.log('configFlags - Firestore emulator rules tests');
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID, firestore: { host: EMU_HOST, port: EMU_PORT },
  });
  await testEnv.clearFirestore();

  const ta1Db = testEnv.authenticatedContext(TA1, authToken('tenant_admin', TENANT_ID)).firestore();
  const ta2Db = testEnv.authenticatedContext(TA2, authToken('tenant_admin', OTHER_TENANT)).firestore();
  const ag1Db = testEnv.authenticatedContext(AG1, authToken('agent', TENANT_ID)).firestore();

  console.log(''); console.log('allowlisted flag writes:');
  // 1a. create-path (resource == null): merge-set an allowlisted flag on a doc
  // that does not yet exist.
  await delSettings(testEnv);
  await t('1a. create-path: merge-set featureFlags.persistencyV2=true (+meta) -> ALLOW', () =>
    assertSucceeds(setDoc(cfgRef(ta1Db, 'settings'), {
      featureFlags: { persistencyV2: true },
      featureFlagsMeta: { persistencyV2: metaEntry() },
    }, { merge: true })));

  // 1b. update-path: doc exists with one allowlisted flag; add another.
  await setSettings(testEnv, {
    featureFlags: { persistencyV2: true },
    featureFlagsMeta: { persistencyV2: { who: TA1, whoName: 'x', date: serverTimestamp() } },
  });
  await t('1b. update-path: merge-set featureFlags.awardsProvenance=true (+meta) -> ALLOW', () =>
    assertSucceeds(setDoc(cfgRef(ta1Db, 'settings'), {
      featureFlags: { awardsProvenance: true },
      featureFlagsMeta: { awardsProvenance: metaEntry() },
    }, { merge: true })));

  console.log(''); console.log('non-allowlisted flag writes (deny):');
  // 2a. non-allowlisted key added to featureFlags (value differs — it's an add).
  await setSettings(testEnv, { featureFlags: { persistencyV2: true } });
  await t('2a. featureFlags.evilFlag=true -> DENY', () =>
    assertFails(setDoc(cfgRef(ta1Db, 'settings'), {
      featureFlags: { evilFlag: true },
    }, { merge: true })));
  // 2b. non-allowlisted key added to featureFlagsMeta alone.
  await t('2b. featureFlagsMeta.evilMeta added alone -> DENY', () =>
    assertFails(setDoc(cfgRef(ta1Db, 'settings'), {
      featureFlagsMeta: { evilMeta: metaEntry() },
    }, { merge: true })));

  console.log(''); console.log('delete + unrelated + non-settings docs:');
  // 3. delete an allowlisted key (FieldValue.delete()) from both maps.
  await setSettings(testEnv, {
    featureFlags: { persistencyV2: true },
    featureFlagsMeta: { persistencyV2: { who: TA1, whoName: 'x', date: serverTimestamp() } },
  });
  await t('3. delete allowlisted persistencyV2 (flags+meta) -> ALLOW', () =>
    assertSucceeds(setDoc(cfgRef(ta1Db, 'settings'), {
      featureFlags: { persistencyV2: deleteField() },
      featureFlagsMeta: { persistencyV2: deleteField() },
    }, { merge: true })));

  // 4. unrelated settings field, no flags touched.
  await setSettings(testEnv, { featureFlags: { persistencyV2: true } });
  await t('4. write unrelated settings field (someOtherSetting) -> ALLOW', () =>
    assertSucceeds(setDoc(cfgRef(ta1Db, 'settings'), { someOtherSetting: 1 }, { merge: true })));

  // 5. whole-doc set (NO merge) that implicitly REMOVES a non-allowlisted legacy
  // flag key — the removal appears in the diff -> DENY.
  await setSettings(testEnv, {
    featureFlags: { legacyKey: true, persistencyV2: true },
    featureFlagsMeta: {},
  });
  await t('5. whole-doc set dropping legacy non-allowlisted flag key -> DENY', () =>
    assertFails(setDoc(cfgRef(ta1Db, 'settings'), {
      featureFlags: { persistencyV2: true },
      featureFlagsMeta: {},
    })));

  // 6a. companyMinimums (non-settings) write — allowlist does not apply.
  await t('6a. config/companyMinimums write by tenant_admin -> ALLOW', () =>
    assertSucceeds(setDoc(cfgRef(ta1Db, 'companyMinimums'), { minAPI: 5000 }, { merge: true })));
  // 6b. managerActivityStandards nested set-merge (savePlainValues payload shape).
  await t('6b. config/managerActivityStandards nested set-merge -> ALLOW', () =>
    assertSucceeds(setDoc(cfgRef(ta1Db, 'managerActivityStandards'), {
      updatedBy: TA1, updatedAt: serverTimestamp(),
      unit_manager: { jfwCount: 5 },
    }, { merge: true })));
  // 6c. awardsRuleset_2026 whole-doc set.
  await t('6c. config/awardsRuleset_2026 whole-doc set -> ALLOW', () =>
    assertSucceeds(setDoc(cfgRef(ta1Db, 'awardsRuleset_2026'), { ruleset: { foo: 'bar' } })));

  console.log(''); console.log('role / tenant boundaries:');
  await setSettings(testEnv, { featureFlags: { persistencyV2: true } });
  // 7a. agent write to settings -> DENY (pre-existing role gate).
  await t('7a. agent write to settings -> DENY', () =>
    assertFails(setDoc(cfgRef(ag1Db, 'settings'), {
      featureFlags: { persistencyV2: deleteField() },
    }, { merge: true })));
  // 7b. tenant_admin read of config docs -> ALLOW.
  await t('7b. tenant_admin read of config/settings -> ALLOW', () =>
    assertSucceeds(getDoc(cfgRef(ta1Db, 'settings'))));
  // 7c. cross-tenant read -> DENY.
  await t('7c. cross-tenant tenant_admin read of settings -> DENY', () =>
    assertFails(getDoc(cfgRef(ta2Db, 'settings'))));

  // 8. settings doc DELETE by tenant_admin -> ALLOW (unchanged wildcard behavior).
  await t('8. settings doc delete by tenant_admin -> ALLOW', () =>
    assertSucceeds(deleteDoc(cfgRef(ta1Db, 'settings'))));

  await testEnv.cleanup();
  console.log('');
  console.log(`${passed + failed} tests: ${passed} passed, ${failed} failed (14 expected)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
