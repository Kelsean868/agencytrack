/**
 * Emulator rules tests — kioskTokens (SEC-03, audit 2026-09-24).
 *
 * Run with:
 *   firebase emulators:exec --only firestore \
 *     "node tests/rules/kioskTokens.rules.test.mjs"
 *
 * A kiosk token doc is a bearer credential: validateKioskToken mints a kiosk
 * session for whatever tenantId/branchId the doc names. Before SEC-03 every
 * manager role (unit_manager included) could write these docs directly, so a
 * UM could self-mint a never-expiring kiosk session for any branch. Tokens are
 * now written ONLY by the createKioskToken / revokeKioskToken Cloud Functions
 * (Admin SDK, bypasses rules). Reads stay open to managers — KioskModeTab
 * lists the tenant's tokens to show and revoke them.
 *
 * Test matrix (10 cases):
 *   client writes — all DENY
 *     1. branch_manager creates a token doc → DENY
 *     2. unit_manager creates a token doc → DENY
 *     3. tenant_admin creates a token doc → DENY
 *     4. branch_manager clears revokedAt on an existing token → DENY
 *     5. branch_manager sets expiresAt far in the future → DENY
 *     6. branch_manager deletes a token → DENY
 *     7. kiosk session creates a token doc → DENY
 *   reads — unchanged
 *     8. branch_manager gets a token → ALLOW
 *     9. branch_manager lists tokens → ALLOW (KioskModeTab)
 *    10. agent gets a token → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'kiosk-tokens-rules-test-tenant';

const [EMU_HOST, EMU_PORT_STR] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
const EMU_PORT = parseInt(EMU_PORT_STR ?? '8080', 10);

const TOKEN_ID     = 'existing-token';
const NEW_TOKEN_ID = 'self-minted-token';

function authToken(role, extra = {}) {
  return { role, tenantId: TENANT_ID, ...extra };
}

function tokenRef(db, tokenId) {
  return doc(db, `tenants/${TENANT_ID}/kioskTokens/${tokenId}`);
}

// A doc shaped like the SEC-03 exploit: no expiresAt, a branch of the
// caller's choosing.
function selfMintedDoc(createdBy) {
  return {
    tokenId: NEW_TOKEN_ID,
    tenantId: TENANT_ID,
    branchId: 'other-branch',
    createdBy,
    revokedAt: null,
    lastUsedAt: null,
  };
}

async function seedDocs(testEnv) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(tokenRef(db, TOKEN_ID), {
      tokenId: TOKEN_ID,
      tenantId: TENANT_ID,
      branchId: 'branch-a',
      createdBy: 'bm1',
      expiresAt: new Date('2026-12-01T00:00:00Z'),
      revokedAt: new Date('2026-09-01T00:00:00Z'),
      lastUsedAt: null,
    });
  });
}

// ── Test harness ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

async function t(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message?.slice(0, 200) ?? err}`);
    failed++;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('kioskTokens — Firestore emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore:  { host: EMU_HOST, port: EMU_PORT },
  });

  await testEnv.clearFirestore();
  await seedDocs(testEnv);

  const bm    = testEnv.authenticatedContext('bm1', authToken('branch_manager', { branchId: 'branch-a' })).firestore();
  const um    = testEnv.authenticatedContext('um1', authToken('unit_manager')).firestore();
  const ta    = testEnv.authenticatedContext('ta1', authToken('tenant_admin')).firestore();
  const agent = testEnv.authenticatedContext('agent1', authToken('agent')).firestore();
  const kiosk = testEnv.authenticatedContext('kiosk_x', authToken('kiosk', { branchId: 'branch-a' })).firestore();

  console.log('client writes (SEC-03 — Cloud Functions only):');

  await t('1. branch_manager creates a token doc → DENY', async () => {
    await assertFails(setDoc(tokenRef(bm, NEW_TOKEN_ID), selfMintedDoc('bm1')));
  });

  await t('2. unit_manager creates a token doc → DENY', async () => {
    await assertFails(setDoc(tokenRef(um, NEW_TOKEN_ID), selfMintedDoc('um1')));
  });

  await t('3. tenant_admin creates a token doc → DENY', async () => {
    await assertFails(setDoc(tokenRef(ta, NEW_TOKEN_ID), selfMintedDoc('ta1')));
  });

  await t('4. branch_manager clears revokedAt on an existing token → DENY', async () => {
    await assertFails(updateDoc(tokenRef(bm, TOKEN_ID), { revokedAt: null }));
  });

  await t('5. branch_manager sets expiresAt far in the future → DENY', async () => {
    await assertFails(updateDoc(tokenRef(bm, TOKEN_ID), { expiresAt: new Date('2099-01-01T00:00:00Z') }));
  });

  await t('6. branch_manager deletes a token → DENY', async () => {
    await assertFails(deleteDoc(tokenRef(bm, TOKEN_ID)));
  });

  await t('7. kiosk session creates a token doc → DENY', async () => {
    await assertFails(setDoc(tokenRef(kiosk, NEW_TOKEN_ID), selfMintedDoc('kiosk_x')));
  });

  console.log('\nreads (unchanged):');

  await t('8. branch_manager gets a token → ALLOW', async () => {
    await assertSucceeds(getDoc(tokenRef(bm, TOKEN_ID)));
  });

  await t('9. branch_manager lists tokens → ALLOW (KioskModeTab)', async () => {
    await assertSucceeds(getDocs(collection(bm, `tenants/${TENANT_ID}/kioskTokens`)));
  });

  await t('10. agent gets a token → DENY', async () => {
    await assertFails(getDoc(tokenRef(agent, TOKEN_ID)));
  });

  // ── Summary ─────────────────────────────────────────────────────────────────
  await testEnv.cleanup();
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
