/**
 * Emulator rules tests — storage.rules (profile photo path, SEC-12 follow-up).
 *
 * Run with:
 *   firebase emulators:exec --only firestore,storage \
 *     "node tests/rules/storage.rules.test.mjs"
 *
 * storage.rules opens exactly one path: avatars/{tenantId}/{uid}.jpg, written by
 * uploadProfilePhoto() in src/services/userService.js. Same-tenant users may read
 * any avatar in their tenant; only the owner may create/update their own file,
 * as a JPEG under 2 MB. Delete is not allowed. Every other path is denied.
 *
 * Test matrix (12 cases):
 *   1. Owner uploads own avatar, JPEG, < 2 MB → ALLOW
 *   2. Owner overwrites own avatar → ALLOW
 *   3. Owner reads own avatar → ALLOW
 *   4. Same-tenant colleague reads the avatar → ALLOW
 *   5. Other-tenant user reads the avatar → DENY
 *   6. Unauthenticated read → DENY
 *   7. User uploads to another user's file → DENY
 *   8. User uploads into another tenant's folder → DENY
 *   9. Upload ≥ 2 MB → DENY
 *  10. Upload with contentType image/png → DENY
 *  11. Owner deletes own avatar → DENY
 *  12. Write to any other path (uploads/x.jpg) → DENY
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';

const PROJECT_ID     = process.env.GCLOUD_PROJECT ?? 'agencytrack-2a610';
const TENANT_ID      = 'storage-rules-test-tenant';
const OTHER_TENANT   = 'storage-rules-other-tenant';
const OWNER_ID       = 'agent1';
const COLLEAGUE_ID   = 'manager1';
const OUTSIDER_ID    = 'agent-other-tenant';

if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  console.error('FIREBASE_STORAGE_EMULATOR_HOST is not set — start the emulators with --only firestore,storage.');
  process.exit(1);
}
const [EMU_HOST, EMU_PORT_STR] = process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
const EMU_PORT = parseInt(EMU_PORT_STR, 10);

// Same path shape as userService.uploadProfilePhoto.
const AVATAR_PATH = `avatars/${TENANT_ID}/${OWNER_ID}.jpg`;
const JPEG_BYTES  = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const JPEG_META   = { contentType: 'image/jpeg' };
const TWO_MB      = 2 * 1024 * 1024;

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
  await testEnv.clearStorage();

  const owner = testEnv
    .authenticatedContext(OWNER_ID, { role: 'agent', tenantId: TENANT_ID })
    .storage();
  const colleague = testEnv
    .authenticatedContext(COLLEAGUE_ID, { role: 'unit_manager', tenantId: TENANT_ID })
    .storage();
  const outsider = testEnv
    .authenticatedContext(OUTSIDER_ID, { role: 'agent', tenantId: OTHER_TENANT })
    .storage();
  const anon = testEnv.unauthenticatedContext().storage();

  await t('1. Owner uploads own avatar, JPEG, < 2 MB → ALLOW', async () => {
    await assertSucceeds(owner.ref(AVATAR_PATH).put(JPEG_BYTES, JPEG_META).then());
  });

  await t('2. Owner overwrites own avatar → ALLOW', async () => {
    await assertSucceeds(owner.ref(AVATAR_PATH).put(JPEG_BYTES, JPEG_META).then());
  });

  await t('3. Owner reads own avatar → ALLOW', async () => {
    await assertSucceeds(owner.ref(AVATAR_PATH).getDownloadURL());
  });

  await t('4. Same-tenant colleague reads the avatar → ALLOW', async () => {
    await assertSucceeds(colleague.ref(AVATAR_PATH).getDownloadURL());
  });

  await t('5. Other-tenant user reads the avatar → DENY', async () => {
    await assertFails(outsider.ref(AVATAR_PATH).getDownloadURL());
  });

  await t('6. Unauthenticated read → DENY', async () => {
    await assertFails(anon.ref(AVATAR_PATH).getDownloadURL());
  });

  await t("7. User uploads to another user's file → DENY", async () => {
    await assertFails(
      owner.ref(`avatars/${TENANT_ID}/${COLLEAGUE_ID}.jpg`).put(JPEG_BYTES, JPEG_META).then(),
    );
  });

  await t("8. User uploads into another tenant's folder → DENY", async () => {
    await assertFails(
      owner.ref(`avatars/${OTHER_TENANT}/${OWNER_ID}.jpg`).put(JPEG_BYTES, JPEG_META).then(),
    );
  });

  await t('9. Upload ≥ 2 MB → DENY', async () => {
    await assertFails(owner.ref(AVATAR_PATH).put(new Uint8Array(TWO_MB), JPEG_META).then());
  });

  await t('10. Upload with contentType image/png → DENY', async () => {
    await assertFails(
      owner.ref(AVATAR_PATH).put(JPEG_BYTES, { contentType: 'image/png' }).then(),
    );
  });

  await t('11. Owner deletes own avatar → DENY', async () => {
    await assertFails(owner.ref(AVATAR_PATH).delete());
  });

  await t('12. Write to any other path (uploads/x.jpg) → DENY', async () => {
    await assertFails(owner.ref('uploads/x.jpg').put(JPEG_BYTES, JPEG_META).then());
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
