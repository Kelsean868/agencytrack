/** READ-ONLY: canonical Auth uids + claims for the staging synthetic accounts. */
const { readFileSync } = require('fs');
const path = require('path');
const KEY_PATH = path.resolve(__dirname, '..', 'functions', 'service-account-key.staging.json');
const key = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
if (key.project_id !== 'agencytrack-staging') { console.error('ABORT: not staging key'); process.exit(1); }
const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(key), projectId: 'agencytrack-staging' });

const EMAILS = [
  'staging-tenant-admin@agencytrack-staging.test',
  'staging-branch-manager@agencytrack-staging.test',
  'staging-unit-manager@agencytrack-staging.test',
  'staging-agent-1@agencytrack-staging.test',
  'staging-agent-2@agencytrack-staging.test',
  'staging-cro@agencytrack-staging.test',
];
(async () => {
  for (const email of EMAILS) {
    try {
      const u = await admin.auth().getUserByEmail(email);
      console.log(`${email}\n  uid=${u.uid}  claims=${JSON.stringify(u.customClaims)}`);
    } catch (e) { console.log(`${email}\n  ABSENT (${e.code})`); }
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
