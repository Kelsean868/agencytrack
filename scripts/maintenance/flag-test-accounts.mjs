/**
 * flag-test-accounts.mjs
 *
 * Operational script: set isTestAccount: true on preserved test accounts and
 * delete their leaderboard/{uid} entries (one-time durable cleanup).
 * Dry-run by default; --apply to commit writes.
 *
 * Usage:
 *   # Phase 1 — list all users with isTestAccount status (read-only):
 *   node scripts/maintenance/flag-test-accounts.mjs --tenant tatillife_south
 *
 *   # Phase 2 — apply to specific emails:
 *   node scripts/maintenance/flag-test-accounts.mjs \
 *     --tenant tatillife_south \
 *     --emails "kelsean@gmail.com,kyronmarchan@gmail.com,testagent@tatillife.com,branch.manager@tatillife.com,unit.manager@tatillife.com" \
 *     --apply
 *
 * Credentials:
 *   functions/service-account-key.json (Admin SDK).
 *
 * Safety:
 *   - HARD-EXCLUDED email: kyronmarchan+tenant@gmail.com (real tenant admin).
 *     Script aborts if this address appears in --emails.
 *   - set({ isTestAccount: true }, { merge: true }) — touches no other field.
 *   - Idempotent: safe to re-run.
 *   - Leaderboard cleanup: deletes tenants/{tenant}/leaderboard/{uid} if present;
 *     the write-layer guard in onSubmissionWrite keeps it durable after this run.
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

const args       = process.argv.slice(2);
const APPLY      = args.includes('--apply');

function argValue(flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

const TENANT_ID  = argValue('--tenant');
const emailsArg  = argValue('--emails');
const TARGET_EMAILS = emailsArg
  ? emailsArg.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : [];

// ── Hard-excluded anchor ──────────────────────────────────────────────────────

const EXCLUDED_ANCHOR = 'kyronmarchan+tenant@gmail.com';

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
    '       This is the real tenant admin account — it must never be flagged as a test account.\n' +
    '       If you meant the personal Gmail, use kyronmarchan@gmail.com (no +tenant).',
  );
  process.exit(1);
}

if (!existsSync(KEY_PATH)) {
  console.error(
    `ERROR: Service account key not found at:\n  ${KEY_PATH}\n\n` +
    'Ensure the service account key is present before running this script.',
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

function fmt(val) {
  if (val === undefined) return '—';
  if (val === null)      return 'null';
  return String(val);
}

// ── Phase 1: list all users with isTestAccount status ────────────────────────

async function listUsers() {
  console.log(`\n── Phase 1: user roster — tenant: ${TENANT_ID} ──`);
  console.log(
    `${'Name'.padEnd(32)} ${'Email'.padEnd(40)} ${'Role'.padEnd(15)} ${'UID'.padEnd(30)} isTestAccount`,
  );
  console.log('─'.repeat(135));

  const usersRef = db.collection(`tenants/${TENANT_ID}/users`);
  const snap     = await usersRef.get();

  const users = snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

  if (users.length === 0) {
    console.log('  (no users found)');
    return users;
  }

  for (const u of users) {
    const marker = u.isTestAccount === true ? ' ← flagged' : '';
    console.log(
      `${fmt(u.name).padEnd(32)} ${fmt(u.email).padEnd(40)} ${fmt(u.role).padEnd(15)} ${fmt(u.uid).padEnd(30)} ${fmt(u.isTestAccount)}${marker}`,
    );
  }

  const flaggedCount = users.filter((u) => u.isTestAccount === true).length;
  console.log(`\n${users.length} user(s) listed. ${flaggedCount} already flagged.`);
  return users;
}

// ── Phase 2: apply isTestAccount: true + leaderboard cleanup ─────────────────

async function applyTestAccountFlag(users) {
  console.log(`\n── Phase 2: apply isTestAccount: true + clear leaderboard entries ──`);
  console.log(`Target emails: ${TARGET_EMAILS.join(', ')}`);

  let applied = 0;
  let skipped = 0;

  for (const email of TARGET_EMAILS) {
    // Belt-and-suspenders anchor guard
    if (email === EXCLUDED_ANCHOR) {
      console.error(`  ERROR: anchor address ${EXCLUDED_ANCHOR} in target list — aborting.`);
      process.exit(1);
    }

    const match = users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (!match) {
      console.error(`  ERROR: no user found with email "${email}" in tenant ${TENANT_ID} — skipping.`);
      skipped++;
      continue;
    }

    const before    = fmt(match.isTestAccount);
    const userRef   = db.doc(`tenants/${TENANT_ID}/users/${match.uid}`);
    const lbRef     = db.doc(`tenants/${TENANT_ID}/leaderboard/${match.uid}`);

    await userRef.set({ isTestAccount: true }, { merge: true });

    // One-time leaderboard cleanup — delete if present, swallow not-found
    const lbSnap = await lbRef.get();
    if (lbSnap.exists) {
      await lbRef.delete();
      console.log(
        `  ✓ ${match.name} (${match.email}) — isTestAccount: ${before} → true | leaderboard entry deleted`,
      );
    } else {
      console.log(
        `  ✓ ${match.name} (${match.email}) — isTestAccount: ${before} → true | no leaderboard entry`,
      );
    }
    applied++;
  }

  console.log(`\n${applied} applied, ${skipped} skipped.`);
  return applied;
}

// ── Read-back: re-fetch and confirm ──────────────────────────────────────────

async function readBack() {
  console.log('\n── Read-back: confirming isTestAccount = true ──');
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
    const val = snap.docs[0].data().isTestAccount;
    if (val === true) {
      console.log(`  ✓ ${email} — isTestAccount: true`);
    } else {
      console.error(`  ✗ ${email} — isTestAccount: ${fmt(val)} (expected true)`);
      allOk = false;
    }
  }
  return allOk;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  try {
    const users = await listUsers();

    if (!APPLY) {
      console.log('\nDry-run complete. Pass --apply --emails "a@,b@,..." to write.');
      process.exit(0);
    }

    const applied = await applyTestAccountFlag(users);
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
