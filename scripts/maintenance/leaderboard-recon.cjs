const admin = require('../../functions/node_modules/firebase-admin');
const path = require('path');

const keyPath = path.resolve(__dirname, '..', '..', 'functions', 'service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

const db = admin.firestore();
const auth = admin.auth();
const UID = 'DRXMI8AgthW7eazwRL06l2Uac4a2'; // canary: kyron.marchan@tatil.co.tt

(async () => {
  const user = await auth.getUser(UID);
  console.log('=== AUTH CUSTOM CLAIMS ===');
  console.log(JSON.stringify(user.customClaims || {}, null, 2));
  const claimTenant = user.customClaims?.tenantId;

  // best-effort user-doc tenant (adjust path if the user doc lives elsewhere)
  let docTenant = '(users/{uid} not found)';
  const userDoc = await db.collection('users').doc(UID).get();
  if (userDoc.exists) docTenant = userDoc.data()?.tenantId;
  console.log('=== USER DOC tenantId ===', docTenant, '| claim:', claimTenant, '| match:', claimTenant === docTenant);

  if (!claimTenant) { console.log('No tenant claim — stopping.'); process.exit(0); }

  const lb = await db.doc(`tenants/${claimTenant}/leaderboard/${UID}`).get();
  console.log(`=== LEADERBOARD tenants/${claimTenant}/leaderboard/${UID} ===`);
  console.log('exists:', lb.exists);
  console.log(JSON.stringify(lb.exists ? lb.data() : null, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
