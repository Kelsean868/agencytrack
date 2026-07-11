/**
 * probe-staging-state.cjs — READ-ONLY inventory of tenants/staging_test in
 * agencytrack-staging. Zero writes. Hard-aborts unless key is staging-bound.
 */
const { readFileSync } = require('fs');
const path = require('path');

const KEY_PATH = path.resolve(__dirname, '..', 'functions', 'service-account-key.staging.json');
const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
if (key.project_id !== 'agencytrack-staging') {
  console.error(`ABORT: key project_id is "${key.project_id}", not agencytrack-staging`);
  process.exit(1);
}

const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(key), projectId: 'agencytrack-staging' });

(async () => {
  const db = admin.firestore();
  const tenant = db.doc('tenants/staging_test');

  const cols = await tenant.listCollections();
  console.log(`collections under tenants/staging_test: ${cols.map(c => c.id).join(', ') || '(none)'}\n`);

  for (const col of cols) {
    const snap = await col.get();
    console.log(`── ${col.id} (${snap.size} docs)`);
    for (const doc of snap.docs.slice(0, 30)) {
      const d = doc.data();
      const brief = {};
      for (const k of ['role', 'name', 'email', 'status', 'weekStarting', 'week', 'stage', 'date', 'type', 'year', 'month', 'agentId', 'ownerUid', 'annualAPI'])
        if (d[k] !== undefined) brief[k] = typeof d[k] === 'object' && d[k]?.toDate ? d[k].toDate().toISOString().slice(0, 10) : d[k];
      console.log(`   ${doc.id}  ${JSON.stringify(brief)}`);
    }
    if (snap.size > 30) console.log(`   … +${snap.size - 30} more`);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
