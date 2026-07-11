/**
 * admin-read.mjs — lazy Firebase Admin SDK bootstrap for VH legs that need a
 * DIRECT (rules-bypassing) Firestore READ to prove things the signed-in-role
 * client SDK can't: key ABSENCE after a diff-only reset/disable (vs. a stored
 * `null`/`false`), and raw configAudit entries (`who`/`settingId`/`to` exactly
 * as written, not re-derived through the surface's own display logic).
 *
 * Read-only in practice: every consumer of `getAdminDb()` in this suite only
 * ever calls `.get()` — the mutations themselves happen through the real app
 * UI (Company Config Save / flag Enable-Disable), never through this module.
 *
 * SAFETY GUARDS — copied VERBATIM from scripts/staging/seed-fixtures.mjs /
 * scripts/verification/vh/flag-toggle.cjs (abort before returning a db handle):
 *   1. Key project_id MUST be agencytrack-staging (never agencytrack-2a610).
 *   2. Resolved Admin app project MUST be agencytrack-staging.
 *
 * ESM admin-script idiom (createRequire + relative require of
 * functions/node_modules/firebase-admin) copied from scripts/staging/seed-fixtures.mjs
 * per CLAUDE.md's admin-script require-path convention.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

const STAGING_PROJECT = 'agencytrack-staging';
const PROD_PROJECT = 'agencytrack-2a610';

/** The tenant every VH staging fixture + these legs' assertions target. */
export const ADMIN_TENANT_ID = 'staging_test';

const KEY_PATH = process.env.STAGING_SA_KEY_PATH
  ? resolve(process.env.STAGING_SA_KEY_PATH)
  : resolve(REPO_ROOT, 'functions', 'service-account-key.staging.json');

let _admin = null;

function bootstrap() {
  if (_admin) return _admin;
  if (!existsSync(KEY_PATH)) {
    throw new Error(`ADMIN-READ ABORTED — staging service-account key not found at ${KEY_PATH}`);
  }
  let keyJson;
  try { keyJson = JSON.parse(readFileSync(KEY_PATH, 'utf8')); }
  catch (e) { throw new Error(`ADMIN-READ ABORTED — could not parse staging key JSON: ${e.message}`); }
  if (keyJson.project_id === PROD_PROJECT) {
    throw new Error(`ADMIN-READ ABORTED — key project_id is PRODUCTION (${PROD_PROJECT}) — refusing.`);
  }
  if (keyJson.project_id !== STAGING_PROJECT) {
    throw new Error(`ADMIN-READ ABORTED — key project_id is '${keyJson.project_id}', expected '${STAGING_PROJECT}'.`);
  }
  const admin = require(resolve(REPO_ROOT, 'functions', 'node_modules', 'firebase-admin'));
  const app = admin.apps?.length
    ? admin.app()
    : admin.initializeApp({ credential: admin.credential.cert(keyJson), projectId: STAGING_PROJECT });
  const resolvedProject = app.options.projectId || keyJson.project_id;
  if (resolvedProject !== STAGING_PROJECT) {
    throw new Error(`ADMIN-READ ABORTED — resolved Admin app project is '${resolvedProject}'.`);
  }
  _admin = admin;
  return _admin;
}

/** Guarded Firestore Admin handle, bound to agencytrack-staging (never prod). */
export function getAdminDb() {
  return bootstrap().firestore();
}

/** Guarded Auth Admin handle (used to resolve a test account's real uid). */
export function getAdminAuth() {
  return bootstrap().auth();
}
