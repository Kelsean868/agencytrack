// Read-only probe: list agent-1 policies on STAGING (diagnoses the A-4 CSV
// row-count mismatch). Never writes; staging key + project guard identical
// to seed-fixtures.mjs.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const KEY_PATH = process.env.STAGING_SA_KEY_PATH
  ? resolve(process.env.STAGING_SA_KEY_PATH)
  : resolve(REPO_ROOT, 'functions', 'service-account-key.staging.json');

const admin = require(resolve(REPO_ROOT, 'functions', 'node_modules', 'firebase-admin'));
const key = require(KEY_PATH);
if (key.project_id !== 'agencytrack-staging') {
  console.error(`ABORT: key project is ${key.project_id}, not agencytrack-staging`);
  process.exit(2);
}
admin.initializeApp({ credential: admin.credential.cert(key), projectId: 'agencytrack-staging' });

const db = admin.firestore();
const users = await db.collection('tenants/staging_test/users').get();
const a1 = users.docs.find((d) => d.data().email === 'staging-agent-1@agencytrack-staging.test');
if (!a1) { console.error('agent-1 user doc not found'); process.exit(1); }
const pols = await db.collection('tenants/staging_test/policies').where('agentId', '==', a1.id).get();
for (const d of pols.docs) {
  const x = d.data();
  console.log(`${d.id} | owner=${x.ownerName} | status=${x.status} | papi=${x.plannedAPI ?? x.papi} | written=${x.writtenDate?.toDate?.()?.toISOString?.()?.slice(0, 10) ?? x.writtenDate}`);
}
console.log('TOTAL', pols.size);
process.exit(0);
