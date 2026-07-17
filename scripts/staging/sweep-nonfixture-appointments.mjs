/**
 * sweep-nonfixture-appointments.mjs — Run 9 utility: delete NON-FIXTURE
 * appointment docs (id not starting with 'vhfix') from the staging test
 * tenant. Smoke runs accumulate appointment residue (rebooks, sentinels,
 * recurrence series) that seed-fixtures --apply does NOT sweep; this restores
 * a pristine appointments collection between smoke phases.
 *
 *   node --env-file=.env.staging scripts/staging/sweep-nonfixture-appointments.mjs           # dry-run
 *   node --env-file=.env.staging scripts/staging/sweep-nonfixture-appointments.mjs --apply
 *
 * SAFETY: staging-only (agencytrack-staging asserted on the SA key AND the
 * resolved app project — same dual guard as seed-fixtures.mjs). Scope is the
 * single collection tenants/staging_test/appointments; fixtures preserved.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const STAGING_PROJECT = 'agencytrack-staging';
const PROD_PROJECT = 'agencytrack-2a610';
const APPLY = process.argv.includes('--apply');

const KEY_PATH = process.env.STAGING_SA_KEY_PATH
  ? resolve(process.env.STAGING_SA_KEY_PATH)
  : resolve(REPO_ROOT, 'functions', 'service-account-key.staging.json');
if (!existsSync(KEY_PATH)) throw new Error(`ABORT — staging SA key not found at ${KEY_PATH}`);
const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
if (key.project_id === PROD_PROJECT) throw new Error('ABORT — key is PRODUCTION. Refusing.');
if (key.project_id !== STAGING_PROJECT) throw new Error(`ABORT — key project '${key.project_id}' != '${STAGING_PROJECT}'.`);

const admin = require(resolve(REPO_ROOT, 'functions', 'node_modules', 'firebase-admin'));
const app = admin.apps?.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(key), projectId: STAGING_PROJECT });
if ((app.options.projectId || '') !== STAGING_PROJECT) throw new Error('ABORT — resolved app project is not staging.');
const db = app.firestore();

const snap = await db.collection('tenants/staging_test/appointments').get();
const targets = snap.docs.filter((d) => !d.id.startsWith('vhfix'));
console.log(`[sweep] appointments total=${snap.size} non-fixture=${targets.length} mode=${APPLY ? 'APPLY' : 'dry-run'}`);
if (APPLY && targets.length) {
  let batch = db.batch(); let n = 0;
  for (const d of targets) {
    batch.delete(d.ref); n++;
    if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`[sweep] deleted ${targets.length} non-fixture appointment docs.`);
} else {
  targets.slice(0, 10).forEach((d) => console.log('  would delete', d.id));
}
process.exit(0);
