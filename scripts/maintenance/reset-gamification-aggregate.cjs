const admin = require('../../functions/node_modules/firebase-admin');
const path = require('path');

const keyPath = path.resolve(__dirname, '..', '..', 'functions', 'service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

const db = admin.firestore();
const auth = admin.auth();

// Test/canary UIDs. Extend this list for the full pre-pilot sweep.
const UIDS = [
  'DRXMI8AgthW7eazwRL06l2Uac4a2', // canary: kyron.marchan@tatil.co.tt
];

(async () => {
  for (const uid of UIDS) {
    const user = await auth.getUser(uid);
    const tenant = user.customClaims?.tenantId;
    if (!tenant) { console.log(`SKIP ${uid} — no tenant claim`); continue; }

    const ref = db.doc(`tenants/${tenant}/leaderboard/${uid}`);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`SKIP ${uid} — no leaderboard doc (already clean)`); continue; }

    const before = snap.data();
    await ref.update({
      points: 0,
      level: 1,
      levelTitle: 'Rookie',
      weeklyStreak: 0,
      badges: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`RESET ${uid} (tenants/${tenant}/leaderboard/${uid}) — points ${before.points} -> 0, badges ${JSON.stringify(before.badges)} -> []`);
  }
  console.log('Done.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
