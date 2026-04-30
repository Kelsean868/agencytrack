/**
 * One-time script: seeds Kyron's user document in Firestore.
 * Run from the functions/ directory:
 *   node seed-super-admin-user.cjs
 *
 * Requires service-account-key.json in the same directory (gitignored).
 */

const admin = require('firebase-admin');
const path  = require('path');

const serviceAccount = require(path.join(__dirname, 'service-account-key.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db       = admin.firestore();
const TENANT   = 'tatillife_south';
const UID      = '4GeeZbhZBwdtGOLoJoggf4MQo142';

async function main() {
  const ref = db.doc(`tenants/${TENANT}/users/${UID}`);

  await ref.set(
    {
      uid:       UID,
      role:      'super_admin',
      name:      'Kyron',
      email:     'kyron@tatillife.com',
      tenantId:  TENANT,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`✓ User document written: tenants/${TENANT}/users/${UID}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
