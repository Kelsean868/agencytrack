/**
 * getDraft non-existent-doc denial probe (client SDK, agent auth).
 *
 * Confirms the root cause of the agent-walk console error: the wizard's
 * getDraft() does getDoc() on `submissions/{uid}_{weekStarting}`. When the agent
 * picks a week with NO existing draft, the doc does not exist → `resource == null`
 * in the `allow get` rule → `canAccessOwn(tenantId, resource.data.agentId)`
 * dereferences `.data` on a null resource → the rule errors to false →
 * permission-denied (NOT not-found).
 *
 * This signs in as the agent via the CLIENT SDK (subject to rules — NOT Admin
 * SDK) and reads a definitely-non-existent own submission doc. A `permission-denied`
 * here proves the mechanism. A clean `null` (not-found) would falsify it.
 *
 * Run: node --env-file=.env.local scripts/verification/getdraft-nonexistent-probe.mjs
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const cfg = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};
const TENANT = process.env.A11Y_TENANT_ID;
const EMAIL  = process.env.A11Y_AGENT_EMAIL;
const PASS   = process.env.A11Y_AGENT_PASSWORD;

const app = initializeApp(cfg);
const auth = getAuth(app);
const db = getFirestore(app);

function classify(e) {
  const code = e?.code || '(no code)';
  return { code, message: e?.message };
}

(async () => {
  const cred = await signInWithEmailAndPassword(auth, EMAIL, PASS);
  const uid = cred.user.uid;
  console.log(`[probe] signed in as agent uid=${uid}`);

  // A Sunday far in the future — guaranteed no submission/draft doc exists.
  const nonexistentWeek = '2099-01-04';
  const docId = `${uid}_${nonexistentWeek}`;
  const path = `tenants/${TENANT}/submissions/${docId}`;
  console.log(`[probe] getDoc on definitely-non-existent own draft: ${path}`);

  try {
    const snap = await getDoc(doc(db, path));
    console.log(`[probe] RESULT: read SUCCEEDED — exists=${snap.exists()} (rule allows non-existent own-doc get → root cause is something ELSE / already fixed)`);
  } catch (e) {
    const { code, message } = classify(e);
    if (code === 'permission-denied') {
      console.log(`[probe] RESULT: permission-denied ✓ — CONFIRMS root cause. getDoc on a non-existent own submission doc is DENIED because the \`allow get\` rule dereferences resource.data.agentId on a null resource.`);
    } else {
      console.log(`[probe] RESULT: unexpected error code=${code} msg=${message}`);
    }
  }

  process.exit(0);
})().catch((e) => { console.error('[probe] fatal', e?.code, e?.message); process.exit(1); });
