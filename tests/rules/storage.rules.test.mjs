/**
 * Emulator rules tests — storage.rules (SEC-12, audit 2026-09-24).
 *
 * Run with:
 *   firebase emulators:exec --only firestore,storage \
 *     "node tests/rules/storage.rules.test.mjs"
 *
 * storage.rules is a VERBATIM copy of the live Storage rules Kyron pasted from
 * the Firebase Console on 24 Sep 2026 (docs/briefs/storage-rules-live.txt).
 * SEC-12 brings them into the repo with NO behaviour change, so these tests pin
 * what production does today — not what it should do.
 *
 * What production does today: the live rules deny every read and write. The
 * app's only Storage path is the profile photo upload in
 * src/services/userService.js (`avatars/{tenantId}/{uid}.jpg`), so these cases
 * assert that path is DENIED. If a test here starts failing, the rules changed:
 * that is a behaviour change and needs its own reviewed PR.
 *
 * Test matrix (3 cases):
 *   1. Owner uploads own avatar (avatars/{tenantId}/{uid}.jpg) → DENY
 *   2. Owner reads own avatar URL → DENY
 *   3. Unauthenticated read of an avatar → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID  = 'storage-rules-test-tenant';
const OWNER_ID   = 'agent1';

if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  console.error('FIREBASE_STORAGE_EMULATOR_HOST is not set — start the emulators with --only firestore,storage.');
  process.exit(1);
}
const [EMU_HOST, EMU_PORT_STR] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
const EMU_PORT = parseInt(EMU_PORT_STR, 10);

// Same path shape as userService.uploadAvatar.
const AVATAR_PATH = `avatars/${TENANT_ID}/${OWNER_ID}.jpg`;
const JPEG_BYTES  = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

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
  console.log('storage.rules — Storage emulator rules tests');
  console.log(`Emulator: ${EMU_HOST}:${EMU_PORT}\n`);

  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      host: EMU_HOST,
      port: EMU_PORT,
      rules: readFileSync('storage.rules', 'utf8'),
    },
  });

  const owner = testEnv
    .authenticatedContext(OWNER_ID, { role: 'agent', tenantId: TENANT_ID })
    .storage();
  const anon = testEnv.unauthenticatedContext().storage();

  await t('1. Owner uploads own avatar → DENY (live rules deny all)', async () => {
    await assertFails(
      owner.ref(AVATAR_PATH).put(JPEG_BYTES, { contentType: 'image/jpeg' }).then(),
    );
  });

  await t('2. Owner reads own avatar URL → DENY', async () => {
    await assertFails(owner.ref(AVATAR_PATH).getDownloadURL());
  });

  await t('3. Unauthenticated read of an avatar → DENY', async () => {
    await assertFails(anon.ref(AVATAR_PATH).getDownloadURL());
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
