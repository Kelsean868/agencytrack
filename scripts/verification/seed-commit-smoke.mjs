/**
 * seed-commit-smoke.mjs — resets the test agent's plan state to a known
 * baseline so review-commit-smoke.mjs can run deterministically.
 *
 * Writes:
 *   - yearPlan/{year}: Life=504,000, status='draft' (overwrites any prior value)
 *   - monthlyPlan/{year}: deleted (smoke will re-create via UI)
 *   - goals/{uid}.playgroundAvgPolicyAPI: field deleted (inline-capture triggers)
 *
 * Math: 504,000 / 12,000 avg = 42 apps = apps floor.
 *       504,000 ≥ 500,000 (highest possible API floor, band_gt60).
 *       So the plan clears EVERY tenure tier when avg=12,000.
 *
 * Usage:
 *   node scripts/verification/seed-commit-smoke.mjs
 *
 * Credentials: uses Application Default Credentials (ADC).
 *   Run `gcloud auth application-default login` once before this script.
 *
 * Env required: A11Y_AGENT_EMAIL (from .env.local)
 */

import { createRequire } from 'module';
import { readFileSync } from 'fs';

function loadEnv() {
  try {
    const lines = readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
      const m = line.replace(/\r$/, '').match(/^([A-Z0-9_]+)=(.*)/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* rely on shell env */ }
}
loadEnv();

const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'agencytrack-2a610' });
}

const db  = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const AGENT_EMAIL = process.env.A11Y_AGENT_EMAIL;
if (!AGENT_EMAIL) {
  console.error('ERROR: A11Y_AGENT_EMAIL not set in .env.local');
  process.exit(1);
}

const year = new Date().getFullYear();
console.log(`\nSeed commit smoke — agent: ${AGENT_EMAIL}, year: ${year}\n`);

// ── Get UID + tenantId from Auth custom claims ────────────────────────────────
const userRecord = await admin.auth().getUserByEmail(AGENT_EMAIL);
const uid      = userRecord.uid;
const tenantId = userRecord.customClaims?.tenantId;

if (!tenantId) {
  console.error(`ERROR: No tenantId in custom claims for ${AGENT_EMAIL}`);
  process.exit(1);
}
console.log(`UID: ${uid}`);
console.log(`Tenant: ${tenantId}`);

// ── Year Plan — set to Life=504,000 (draft) ───────────────────────────────────
const yearPlanRef = db
  .collection('tenants').doc(tenantId)
  .collection('users').doc(uid)
  .collection('yearPlan').doc(String(year));

await yearPlanRef.set({
  status: 'draft',
  lines: {
    life:     { targetAPI: 504000, enabled: true  },
    ah:       { targetAPI: 0,      enabled: false },
    property: { targetAPI: 0,      enabled: false },
    motor:    { targetAPI: 0,      enabled: false },
  },
  updatedAt: FieldValue.serverTimestamp(),
});
console.log(`✓ yearPlan/${year}: Life=504,000, status=draft`);

// ── Monthly Plan — delete so UI can re-create from fresh ────────────────────
const monthlyPlanRef = db
  .collection('tenants').doc(tenantId)
  .collection('users').doc(uid)
  .collection('monthlyPlan').doc(String(year));

await monthlyPlanRef.delete();
console.log(`✓ monthlyPlan/${year}: deleted (smoke will re-create via ensureMonthlyPlan)`);

// ── Goals — clear playgroundAvgPolicyAPI (inline-capture test trigger) ────────
const goalsRef = db
  .collection('tenants').doc(tenantId)
  .collection('goals').doc(uid);

const goalsSnap = await goalsRef.get();
if (goalsSnap.exists && goalsSnap.data().playgroundAvgPolicyAPI !== undefined) {
  await goalsRef.update({ playgroundAvgPolicyAPI: FieldValue.delete() });
  console.log(`✓ goals.playgroundAvgPolicyAPI: field deleted`);
} else {
  console.log(`ℹ goals.playgroundAvgPolicyAPI: already absent — no-op`);
}

// ── Also clear committed state (personalAnnualAPI) if present ─────────────────
// This lets the smoke test the first-commit path, not the re-commit path.
if (goalsSnap.exists && goalsSnap.data().personalAnnualAPI !== undefined) {
  await goalsRef.update({ personalAnnualAPI: FieldValue.delete(), personalAnnualApps: FieldValue.delete() });
  console.log(`✓ goals.personalAnnualAPI: cleared (smoke will test first-commit path)`);
}

console.log(`\nSetup complete. Expected commit math:`);
console.log(`  annualAPI  = 504,000`);
console.log(`  avg        = 12,000 (to be captured inline)`);
console.log(`  apps       = 504,000 / 12,000 = 42 ≥ 42 floor ✓`);
console.log(`  API floor  = ≤ 500,000 ✓ (504,000 clears all tenure bands)`);
console.log(`\nNext: VITE_YEAR_PLAN_ENABLED=true npm run dev  →  node scripts/verification/review-commit-smoke.mjs`);

process.exit(0);
