/**
 * seed-cro-staging.cjs — one-off staging seed for the 3.1 CRO smoke.
 * STAGING ONLY: hard-aborts unless the key's project_id is agencytrack-staging.
 * Seeds: (1) a cro auth user + claims + user doc; (2) one settled policy
 * (policyDeliveryDate null) for the Delivery Register write-read-verify.
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

const CRO_EMAIL = 'staging-cro@agencytrack-staging.test';
const CRO_PASSWORD = 'ChangeMe-Staging-2026!';

(async () => {
  const db = admin.firestore();

  // Discover the staging tenant from an existing seeded user
  const agentAuth = await admin.auth().getUserByEmail('staging-agent-1@agencytrack-staging.test');
  const tenantId = agentAuth.customClaims?.tenantId;
  if (!tenantId) { console.error('ABORT: staging-agent-1 has no tenantId claim'); process.exit(1); }
  console.log(`tenant: ${tenantId}; agent uid: ${agentAuth.uid}`);

  // 1) CRO auth user (idempotent)
  let cro;
  try {
    cro = await admin.auth().getUserByEmail(CRO_EMAIL);
    console.log(`cro user exists: ${cro.uid}`);
  } catch {
    cro = await admin.auth().createUser({ email: CRO_EMAIL, password: CRO_PASSWORD, displayName: 'Staging CRO' });
    console.log(`cro user created: ${cro.uid}`);
  }
  await admin.auth().setCustomUserClaims(cro.uid, { role: 'cro', tenantId, ownedBranchIds: ['*'] });
  await db.doc(`tenants/${tenantId}/users/${cro.uid}`).set({
    uid: cro.uid, role: 'cro', tenantId, name: 'Staging CRO', email: CRO_EMAIL, active: true,
  }, { merge: true });
  console.log('cro claims + user doc set');

  // 2) One settled, undelivered policy for the register (idempotent doc id)
  const agentDoc = await db.doc(`tenants/${tenantId}/users/${agentAuth.uid}`).get();
  const { unitId = null, branchId = null } = agentDoc.data() ?? {};
  const now = admin.firestore.Timestamp.now();
  const daysAgo = (n) => admin.firestore.Timestamp.fromMillis(Date.now() - n * 86400000);
  await db.doc(`tenants/${tenantId}/policies/smoke-cro-delivery-1`).set({
    tenantId, agentId: agentAuth.uid, unitId, branchId,
    agentNumber: 'A-001', status: 'settled', statusUpdatedAt: now,
    sourceOfProspect: 'referral', dateWritten: daysAgo(20), dateSubmitted: daysAgo(20),
    proposedAPI: 6000, ownerName: 'Smoke Owner', insuredName: 'Smoke Owner',
    productLine: 'life', newBusinessType: 'nb_ordinary', policyClass: 'whole_life',
    proposedFrequency: 'M', proposedPremium: 500, isSelfOrFamily: false,
    cashWithApp: { collected: false, amount: null },
    dateIssued: daysAgo(10), settledAPI: 6000, issuedCoverage: 120000,
    initialPremium: 500, earnedCommission: 300,
    policyDeliveryDate: null, policyNumber: 'SMK-CRO-001',
    createdAt: daysAgo(20), createdBy: agentAuth.uid,
  });
  console.log('settled undelivered policy seeded: smoke-cro-delivery-1 (dateIssued 10d ago -> 20 days left)');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
