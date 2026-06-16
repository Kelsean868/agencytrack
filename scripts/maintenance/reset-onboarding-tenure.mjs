/**
 * reset-onboarding-tenure.mjs
 *
 * Clears onboarding + tenure fields from a user doc so the agent can
 * re-enter the onboarding wizard with no pre-filled data. Used to reset
 * the A11Y test agent between smoke-651-tenure-fields.mjs runs.
 *
 * Fields cleared:
 *   agentNumber, dateOfBirth, contractStartDate, monthsAtTatil,
 *   monthsInIndustry, onboardingComplete, phone, bio
 *
 * Supporting docs cleared (best-effort):
 *   moneyNeeds/{YEAR}, yearPlan/{YEAR}, goals/{uid} (personalAnnualAPI etc.)
 *
 * Usage:
 *   node scripts/maintenance/reset-onboarding-tenure.mjs \
 *     --email <agent-email>
 *
 * Env vars (from .env.local):
 *   VITE_FIREBASE_API_KEY   — for sign-in to resolve uid + tenantId
 *   (Admin SDK uses ambient credentials — run `firebase login` or set
 *    GOOGLE_APPLICATION_CREDENTIALS if ambient creds are not active)
 *
 * Safety:
 *   - Dry-run by default. Pass --apply to commit writes.
 *   - Only deletes the listed fields; all other user fields are untouched.
 */

import { createRequire } from 'module';
import { resolve } from 'path';
import { loadEnv } from '../lib/loadEnv.mjs';

const require = createRequire(import.meta.url);

// ── env ───────────────────────────────────────────────────────────────────────
const envVars = loadEnv(resolve(process.cwd(), '.env.local'));
for (const [k, v] of Object.entries(envVars)) {
  if (!(k in process.env)) process.env[k] = v;
}
const req = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing required env var: ${k}`);
  return v;
};

const API_KEY = req('VITE_FIREBASE_API_KEY');

// ── args ──────────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const email  = args[args.indexOf('--email') + 1];
const dryRun = !args.includes('--apply');

if (!email) {
  console.error('Usage: node reset-onboarding-tenure.mjs --email <email> [--apply]');
  process.exit(1);
}

// ── Admin SDK ─────────────────────────────────────────────────────────────────
const admin = require('../../functions/node_modules/firebase-admin');
admin.initializeApp();
const adminDb = admin.firestore();

const YEAR = new Date().getFullYear();

// ── resolve uid + tenantId via Auth REST ──────────────────────────────────────
async function resolveIds() {
  const pass = process.env.A11Y_AGENT_PASSWORD;
  if (!pass) throw new Error('A11Y_AGENT_PASSWORD not set in .env.local');
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, returnSecureToken: true }),
    },
  );
  if (!res.ok) throw new Error(`Auth REST sign-in failed: ${res.status} ${await res.text()}`);
  const { idToken, localId } = await res.json();
  const claims = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString());
  return { uid: localId, tenantId: claims.tenantId };
}

// ── reset ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`reset-onboarding-tenure  email=${email}  dry-run=${dryRun}`);
  if (dryRun) console.log('(pass --apply to commit writes)\n');

  const { uid, tenantId } = await resolveIds();
  console.log(`resolved: uid=${uid}  tenantId=${tenantId}`);

  const userRef  = adminDb.doc(`tenants/${tenantId}/users/${uid}`);
  const mnRef    = adminDb.doc(`tenants/${tenantId}/users/${uid}/moneyNeeds/${YEAR}`);
  const ypRef    = adminDb.doc(`tenants/${tenantId}/users/${uid}/yearPlan/${YEAR}`);
  const goalsRef = adminDb.doc(`tenants/${tenantId}/goals/${uid}`);

  const userFields = {
    agentNumber:        admin.firestore.FieldValue.delete(),
    dateOfBirth:        admin.firestore.FieldValue.delete(),
    contractStartDate:  admin.firestore.FieldValue.delete(),
    monthsAtTatil:      admin.firestore.FieldValue.delete(),
    monthsInIndustry:   admin.firestore.FieldValue.delete(),
    onboardingComplete: admin.firestore.FieldValue.delete(),
    phone:              admin.firestore.FieldValue.delete(),
    bio:                admin.firestore.FieldValue.delete(),
  };

  console.log('\nPlan:');
  console.log(`  user doc: delete ${Object.keys(userFields).join(', ')}`);
  console.log(`  moneyNeeds/${YEAR}: delete doc (best-effort)`);
  console.log(`  yearPlan/${YEAR}: delete doc (best-effort)`);
  console.log(`  goals/${uid}: delete gamePlanCommitted + personal goal fields (best-effort)`);

  if (dryRun) {
    console.log('\nDry-run complete — no writes made. Re-run with --apply to commit.');
    process.exit(0);
  }

  await userRef.update(userFields);
  console.log('\nuserDoc fields cleared');

  const [mnResult, ypResult, goalsResult] = await Promise.allSettled([
    mnRef.delete(),
    ypRef.delete(),
    goalsRef.update({
      personalAnnualAPI:       admin.firestore.FieldValue.delete(),
      personalAnnualApps:      admin.firestore.FieldValue.delete(),
      gamePlanCommitted:       admin.firestore.FieldValue.delete(),
      playgroundAvgPolicyAPI:  admin.firestore.FieldValue.delete(),
    }),
  ]);

  console.log(`moneyNeeds delete: ${mnResult.status}`);
  console.log(`yearPlan delete:   ${ypResult.status}`);
  console.log(`goals update:      ${goalsResult.status}`);
  if (goalsResult.status === 'rejected') {
    console.log('  (goals doc may not exist — safe to ignore)');
  }

  console.log('\nReset complete. Re-run smoke-651-tenure-fields.mjs against the preview.');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
