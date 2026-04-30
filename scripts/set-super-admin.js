const admin = require('firebase-admin');
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setSuperAdminClaims() {
  const uid = '4GeeZbhZBwdtGOLoJoggf4MQo142';
  await admin.auth().setCustomUserClaims(uid, {
    role: 'super_admin',
    tenantId: 'tatil-life',
  });
  console.log('Super admin claims set successfully for UID:', uid);
  process.exit(0);
}

setSuperAdminClaims().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
