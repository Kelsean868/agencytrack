/**
 * set-producing-manager.mjs
 *
 * Operational script: set isProducingManager: true on selected manager user
 * docs in a given tenant. Dry-run by default; --apply to commit writes.
 *
 * Usage:
 *   # Phase 1 — list all unit_manager / branch_manager users (read-only):
 *   node scripts/maintenance/set-producing-manager.mjs --tenant tatillife_south
 *
 *   # Phase 2 — apply to specific emails:
 *   node scripts/maintenance/set-producing-manager.mjs \
 *     --tenant tatillife_south \
 *     --emails "mary-ann@example.com,letitia@example.com" \
 *     --apply
 *
 * Credentials:
 *   functions/service-account-key.json (Admin SDK).
 *   If absent, copy from functions/service-account-key-archived.json:
 *     cp functions/service-account-key-archived.json functions/service-account-key.json
 *   Delete key after use.
 *
 * Safety:
 *   - HARD-EXCLUDED email: cyril.murray+phoenix@tatil.co.tt (Phoenix anchor).
 *     Script aborts if this address appears in --emails — it is one character
 *     off the real Cyril address and must never be modified.
 *   - set({ isProducingManager: true }, { merge: true }) — touches no other
 *     field.
 *   - Idempotent: safe to re-run.
 *
 * Firebase Admin SDK is installed only in functions/node_modules, not repo
 * root. Uses createRequire per CLAUDE.md admin-script pattern.
 */

import { createRequire } from 'module';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../functions/service-account-key.json');

// ── Argument parsing ──────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const APPLY  = args.includes('--apply');

function argValue(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

const TENANT_ID = argValue('--tenant');
const emailsArg = argValue('--emails');
const TARGET_EMAILS = emailsArg
  ? emailsArg.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : [];

// ── Hard-excluded anchor ──────────────────────────────────────────────────────

const EXCLUDED_ANCHOR = 'cyril.murray+phoenix@tatil.co.tt';

// ── Validation ────────────────────────────────────────────────────────────────

if (!TENANT_ID) {
  console.error('ERROR: --tenant <tenantId> is required.');
  process.exit(1);
}

if (APPLY && TARGET_EMAILS.length === 0) {
  console.error('ERROR: --apply requires --emails <a@,b@,...>.');
  process.exit(1);
}

if (TARGET_EMAILS.includes(EXCLUDED_ANCHOR)) {
  console.error(
    `ERROR: HARD-EXCLUDED anchor address detected in --emails: ${EXCLUDED_ANCHOR}\n` +
    '       This is the Phoenix anchor account — it must never be set as a producing manager.\n' +
    '       Check for a typo vs cyril.murray@tatil.co.tt (no +phoenix).',
  );
  process.exit(1);
}

if (!existsSync(KEY_PATH)) {
  console.error(
    `ERROR: Service account key not found at:\n  ${KEY_PATH}\n\n` +
    'Copy the archived key first:\n' +
    '  cp functions/service-account-key-archived.json functions/service-account-key.json\n' +
    'Delete it after use.',
  );
  process.exit(1);
}

// ── Firebase Admin init ───────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const admin   = require('../../functions/node_modules/firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(KEY_PATH),
});

const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────

const MANAGER_ROLES = ['unit_manager', 'branch_manager'];

function fmt(val) {
  if (val === undefined) return '—';
  if (val === null)      return 'null';
  return String(val);
}

// ── Phase 1: list all managers in tenant ─────────────────────────────────────

async function listManagers() {
  console.log(`\n── Phase 1: manager roster — tenant: ${TENANT_ID} ──`);
  console.log(
    `${'Name'.padEnd(32)} ${'Email'.padEnd(40)} ${'Role'.padEnd(15)} ${'branchId'.padEnd(24)} isProducingManager`,
  );
  console.log('─'.repeat(130));

  const usersRef = db.collection(`tenants/${TENANT_ID}/users`);
  const snap     = await usersRef.get();

  const managers = snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((u) => MANAGER_ROLES.includes(u.role))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

  if (managers.length === 0) {
    console.log('  (no unit_manager or branch_manager users found)');
    return managers;
  }

  for (const u of managers) {
    console.log(
      `${fmt(u.name).padEnd(32)} ${fmt(u.email).padEnd(40)} ${fmt(u.role).padEnd(15)} ${fmt(u.branchId).padEnd(24)} ${fmt(u.isProducingManager)}`,
    );
  }

  console.log(`\n${managers.length} manager(s) listed.`);
  return managers;
}

// ── Phase 2: apply isProducingManager: true ───────────────────────────────────

async function applyProducingManager(managers) {
  console.log(`\n── Phase 2: apply isProducingManager: true ──`);
  console.log(`Target emails: ${TARGET_EMAILS.join(', ')}`);

  let applied = 0;
  let skipped = 0;

  for (const email of TARGET_EMAILS) {
    // Anchor guard — belt-and-suspenders (already checked above)
    if (email === EXCLUDED_ANCHOR) {
      console.error(`  ERROR: anchor address ${EXCLUDED_ANCHOR} in target list — aborting.`);
      process.exit(1);
    }

    const match = managers.find((u) => (u.email ?? '').toLowerCase() === email);
    if (!match) {
      console.error(`  ERROR: no user found with email "${email}" in tenant ${TENANT_ID} — skipping.`);
      skipped++;
      continue;
    }

    const before = fmt(match.isProducingManager);
    const docRef = db.doc(`tenants/${TENANT_ID}/users/${match.uid}`);
    await docRef.set({ isProducingManager: true }, { merge: true });
    console.log(`  ✓ ${match.name} (${match.email}) — isProducingManager: ${before} → true`);
    applied++;
  }

  console.log(`\n${applied} applied, ${skipped} skipped.`);
  return applied;
}

// ── Read-back: re-fetch and confirm ──────────────────────────────────────────

async function readBack() {
  console.log('\n── Read-back: confirming isProducingManager = true ──');
  let allOk = true;
  for (const email of TARGET_EMAILS) {
    const snap = await db.collection(`tenants/${TENANT_ID}/users`)
      .where('email', '==', email)
      .limit(1)
      .get();
    if (snap.empty) {
      console.error(`  ✗ ${email} — doc not found`);
      allOk = false;
      continue;
    }
    const val = snap.docs[0].data().isProducingManager;
    if (val === true) {
      console.log(`  ✓ ${email} — isProducingManager: true`);
    } else {
      console.error(`  ✗ ${email} — isProducingManager: ${fmt(val)} (expected true)`);
      allOk = false;
    }
  }
  return allOk;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    const managers = await listManagers();

    if (!APPLY) {
      console.log('\nDry-run complete. Pass --apply --emails "a@,b@,..." to write.');
      process.exit(0);
    }

    const applied = await applyProducingManager(managers);
    if (applied === 0) {
      console.error('\nNo records updated — check the email addresses above.');
      process.exit(1);
    }

    const ok = await readBack();
    process.exit(ok ? 0 : 1);
  } catch (err) {
    console.error(`\nFATAL: ${err.message ?? String(err)}`);
    process.exit(1);
  }
})();
