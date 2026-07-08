/**
 * verify-isolation.mjs — THE STAGING SAFETY GATE.
 *
 * Proves the staging environment is isolated from production (agencytrack-2a610)
 * BEFORE any autonomous Firebase authority is granted against staging. If ANY
 * check fails, the script prints a loud banner and exits 1 — treat that as a hard
 * block: do NOT grant autonomous staging authority until this passes.
 *
 * WHAT IT PROVES
 *   CHECK 1 (static)  Staging config points at agencytrack-staging, not prod:
 *                     VITE_FIREBASE_PROJECT_ID === 'agencytrack-staging',
 *                     all 6 VITE_FIREBASE_* present, authDomain/storageBucket
 *                     reference the staging project.
 *   CHECK 2 (static)  The production project id (agencytrack-2a610) appears in NO
 *                     value of the staging env, AND the kiosk endpoint override is
 *                     set to a staging URL (otherwise src/lib/kiosk/kioskConfig.js
 *                     falls back to PROD's Cloud Function — a real leak vector).
 *   CHECK 3 (static)  If a staging service-account key is present, its project_id
 *                     is agencytrack-staging (and not prod). Firebase credentials
 *                     are project-scoped, so this PROVES any Admin write via that
 *                     key cannot reach production by construction.
 *   CHECK 4 (--live)  A real write lands in staging Firestore and reads back, and
 *                     the resolved Admin project is agencytrack-staging. Combined
 *                     with CHECK 3, the write provably cannot have reached prod.
 *
 * HONEST GAP (per CLAUDE.md Rule 22): this script does NOT connect to production to
 * assert the probe doc is absent there. Doing so would require wiring PRODUCTION
 * credentials into the staging tooling — which would itself create the very
 * cross-project authority this setup exists to prevent. The "not in prod"
 * guarantee is therefore STRUCTURAL (project-scoped credentials, CHECK 3 + 4), not
 * observational. For belt-and-suspenders, the operator can visually confirm in the
 * agencytrack-2a610 Console that no `_isolation_probe` collection exists under
 * tenants/staging_test (see docs/runbooks/staging-setup.md).
 *
 * This script has NO code path that connects to production.
 *
 * USAGE
 *   node scripts/staging/verify-isolation.mjs           # static checks (1–3)
 *   node scripts/staging/verify-isolation.mjs --live     # + live write-read (4)
 *   node scripts/staging/verify-isolation.mjs --env .env.staging --key functions/service-account-key.staging.json
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { loadEnv } from '../lib/loadEnv.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const STAGING_PROJECT = 'agencytrack-staging';
const PROD_PROJECT     = 'agencytrack-2a610';

// ── CLI ───────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flagValue = (name, def) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};
const isLive   = args.includes('--live');
const ENV_PATH = resolve(REPO_ROOT, flagValue('--env', '.env.staging'));
const KEY_PATH = resolve(REPO_ROOT, flagValue('--key', 'functions/service-account-key.staging.json'));

// ── Result tracking ─────────────────────────────────────────────────────────
const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail });
  const icon = { PASS: '✅', FAIL: '❌', SKIP: '⏭️ ', WARN: '⚠️ ' }[status] || '  ';
  console.log(`${icon} [${status}] ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log('\n── Staging isolation verification ─────────────────────────────');
console.log(`env: ${ENV_PATH}`);
console.log(`key: ${KEY_PATH}`);
console.log(`live: ${isLive ? 'yes (network write-read)' : 'no (static checks only)'}\n`);

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 1 — staging config points at staging
// ─────────────────────────────────────────────────────────────────────────────
if (!existsSync(ENV_PATH)) {
  record('CHECK 1 config', 'FAIL', `staging env not found at ${ENV_PATH} — copy .env.staging.example to .env.staging and fill it`);
} else {
  const env = loadEnv(ENV_PATH);
  const REQUIRED = [
    'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID',
  ];
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length) {
    record('CHECK 1 config', 'FAIL', `missing/empty VITE_FIREBASE_* keys: ${missing.join(', ')}`);
  } else if (env.VITE_FIREBASE_PROJECT_ID === PROD_PROJECT) {
    record('CHECK 1 config', 'FAIL', `VITE_FIREBASE_PROJECT_ID is PRODUCTION (${PROD_PROJECT}) — catastrophic, staging env points at prod`);
  } else if (env.VITE_FIREBASE_PROJECT_ID !== STAGING_PROJECT) {
    record('CHECK 1 config', 'FAIL', `VITE_FIREBASE_PROJECT_ID is '${env.VITE_FIREBASE_PROJECT_ID}', expected '${STAGING_PROJECT}'`);
  } else {
    const domainOk = env.VITE_FIREBASE_AUTH_DOMAIN.includes(STAGING_PROJECT) && !env.VITE_FIREBASE_AUTH_DOMAIN.includes(PROD_PROJECT);
    const bucketOk = env.VITE_FIREBASE_STORAGE_BUCKET.includes(STAGING_PROJECT) && !env.VITE_FIREBASE_STORAGE_BUCKET.includes(PROD_PROJECT);
    if (!domainOk) {
      record('CHECK 1 config', 'FAIL', `VITE_FIREBASE_AUTH_DOMAIN (${env.VITE_FIREBASE_AUTH_DOMAIN}) does not reference ${STAGING_PROJECT}`);
    } else if (!bucketOk) {
      record('CHECK 1 config', 'FAIL', `VITE_FIREBASE_STORAGE_BUCKET (${env.VITE_FIREBASE_STORAGE_BUCKET}) does not reference ${STAGING_PROJECT}`);
    } else {
      record('CHECK 1 config', 'PASS', `projectId=${STAGING_PROJECT}, all 6 VITE_FIREBASE_* present, domain+bucket reference staging`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 2 — no prod id anywhere in staging env + kiosk override set to staging
// ─────────────────────────────────────────────────────────────────────────────
if (!existsSync(ENV_PATH)) {
  record('CHECK 2 no-prod-leak', 'FAIL', 'staging env absent (see CHECK 1)');
} else {
  const env = loadEnv(ENV_PATH);
  const leaks = Object.entries(env)
    .filter(([, v]) => typeof v === 'string' && v.includes(PROD_PROJECT))
    .map(([k]) => k);
  if (leaks.length) {
    record('CHECK 2 no-prod-leak', 'FAIL', `production id (${PROD_PROJECT}) present in staging env value(s): ${leaks.join(', ')}`);
  } else {
    const kiosk = env.VITE_VALIDATE_KIOSK_TOKEN_URL;
    if (!kiosk) {
      record('CHECK 2 no-prod-leak', 'FAIL', `VITE_VALIDATE_KIOSK_TOKEN_URL is UNSET — kiosk would fall back to PRODUCTION CF (src/lib/kiosk/kioskConfig.js:40). Set it to a staging URL.`);
    } else if (kiosk.includes(PROD_PROJECT)) {
      record('CHECK 2 no-prod-leak', 'FAIL', `VITE_VALIDATE_KIOSK_TOKEN_URL points at PRODUCTION (${kiosk})`);
    } else if (!kiosk.includes(STAGING_PROJECT)) {
      record('CHECK 2 no-prod-leak', 'WARN', `VITE_VALIDATE_KIOSK_TOKEN_URL (${kiosk}) does not reference ${STAGING_PROJECT} — confirm it is a staging endpoint`);
    } else {
      record('CHECK 2 no-prod-leak', 'PASS', `no prod id in staging env; kiosk endpoint references ${STAGING_PROJECT}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 3 — credential binding (structural isolation proof)
// ─────────────────────────────────────────────────────────────────────────────
let keyJson = null;
if (!existsSync(KEY_PATH)) {
  record('CHECK 3 key-binding', 'SKIP', `no staging key at ${KEY_PATH} (static config checks still gate; provide a key for CHECK 3/4)`);
} else {
  try {
    keyJson = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
  } catch (e) {
    record('CHECK 3 key-binding', 'FAIL', `could not parse staging key JSON: ${e.message}`);
    keyJson = null;
  }
  if (keyJson) {
    if (keyJson.project_id === PROD_PROJECT) {
      record('CHECK 3 key-binding', 'FAIL', `staging key's project_id is PRODUCTION (${PROD_PROJECT}) — this is the prod key`);
    } else if (keyJson.project_id !== STAGING_PROJECT) {
      record('CHECK 3 key-binding', 'FAIL', `staging key's project_id is '${keyJson.project_id}', expected '${STAGING_PROJECT}'`);
    } else {
      record('CHECK 3 key-binding', 'PASS', `key credential is project-bound to ${STAGING_PROJECT} — Admin writes provably cannot reach ${PROD_PROJECT}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 4 — live write-read round trip (gated behind --live + a valid staging key)
// ─────────────────────────────────────────────────────────────────────────────
async function runLiveCheck() {
  if (!isLive) {
    record('CHECK 4 live-write', 'SKIP', 're-run with --live to perform a real staging write-read round trip');
    return;
  }
  const keyOk = keyJson && keyJson.project_id === STAGING_PROJECT;
  if (!keyOk) {
    record('CHECK 4 live-write', 'FAIL', 'live check needs a valid staging key (CHECK 3 must PASS)');
    return;
  }
  try {
    const admin = require('../../functions/node_modules/firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(keyJson) });
    }
    const resolvedProject = admin.app().options.projectId || keyJson.project_id;
    if (resolvedProject !== STAGING_PROJECT) {
      record('CHECK 4 live-write', 'FAIL', `resolved Admin project is '${resolvedProject}', expected '${STAGING_PROJECT}'`);
      return;
    }
    const db = admin.firestore();
    const probeId = `probe-${Date.now()}`;
    const ref = db.doc(`tenants/staging_test/_isolation_probe/${probeId}`);
    await ref.set({ probe: true, project: STAGING_PROJECT, writtenAt: admin.firestore.FieldValue.serverTimestamp() });
    const snap = await ref.get();
    if (!snap.exists || snap.get('project') !== STAGING_PROJECT) {
      record('CHECK 4 live-write', 'FAIL', 'probe doc did not read back correctly from staging');
      await ref.delete().catch(() => {});
      return;
    }
    await ref.delete(); // cleanup
    record('CHECK 4 live-write', 'PASS', `wrote+read+deleted ${ref.path} in ${STAGING_PROJECT}; project-scoped key means it cannot have reached ${PROD_PROJECT}`);
  } catch (e) {
    record('CHECK 4 live-write', 'FAIL', `live round trip errored: ${e.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Run + summarize
// ─────────────────────────────────────────────────────────────────────────────
await runLiveCheck();

const failed = results.filter((r) => r.status === 'FAIL');
console.log('\n──────────────────────────────────────────────────────────────');
if (failed.length) {
  console.log('❌❌❌ ISOLATION VERIFICATION FAILED ❌❌❌');
  console.log(`${failed.length} check(s) failed. DO NOT grant autonomous staging authority.`);
  for (const f of failed) console.log(`   - ${f.name}: ${f.detail}`);
  console.log('──────────────────────────────────────────────────────────────\n');
  process.exit(1);
}
console.log('✅ ISOLATION VERIFIED — staging config/credentials are bound to');
console.log(`   ${STAGING_PROJECT} and carry no reference to ${PROD_PROJECT}.`);
if (!isLive) console.log('   (static checks only — re-run with --live once a staging key exists to prove a real write lands in staging)');
console.log('──────────────────────────────────────────────────────────────\n');
process.exit(0);
