/**
 * flag-toggle.cjs — VH Tier-3 guarded feature-flag flipper (STAGING ONLY).
 *
 * Sole purpose: let the `t3-flag-gated-shells` smoke leg flip ONE feature flag
 * on `tenants/staging_test/config/settings.featureFlags` OFF/ON to prove the
 * fail-closed gate (flag OFF ⇒ surface absent) and restore it. It writes a
 * single merge field and nothing else.
 *
 * SAFETY GUARDS — copied VERBATIM from scripts/staging/seed-fixtures.mjs
 * (abort before ANY write):
 *   1. Key project_id MUST be agencytrack-staging (never agencytrack-2a610).
 *   2. Resolved Admin app project MUST be agencytrack-staging.
 *
 * USAGE
 *   node scripts/verification/vh/flag-toggle.cjs <flagKey> <true|false>
 *   e.g. node scripts/verification/vh/flag-toggle.cjs persistencyV2 false
 */
const { resolve } = require('path');
const { existsSync, readFileSync } = require('fs');

const STAGING_PROJECT = 'agencytrack-staging';
const PROD_PROJECT    = 'agencytrack-2a610';
const TENANT_ID       = 'staging_test';

// Only these three item-3.4 flags are togglable through this helper.
const ALLOWED_FLAGS = new Set(['persistencyV2', 'policyLedgerCampaignLens', 'awardsProvenance']);

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const KEY_PATH = process.env.STAGING_SA_KEY_PATH
  ? resolve(process.env.STAGING_SA_KEY_PATH)
  : resolve(REPO_ROOT, 'functions', 'service-account-key.staging.json');

const [flagKey, valueArg] = process.argv.slice(2);
if (!flagKey || !ALLOWED_FLAGS.has(flagKey) || (valueArg !== 'true' && valueArg !== 'false')) {
  console.error('Usage: node scripts/verification/vh/flag-toggle.cjs <persistencyV2|policyLedgerCampaignLens|awardsProvenance> <true|false>');
  process.exit(1);
}
const value = valueArg === 'true';

function abort(msg) {
  console.error('\n============================================================');
  console.error(`  FLAG-TOGGLE ABORTED — ${msg}`);
  console.error('============================================================');
  process.exit(1);
}

// ── GUARD 1 — key bound to STAGING (copied verbatim from seed-fixtures.mjs) ──
if (!existsSync(KEY_PATH)) abort(`staging service-account key not found at ${KEY_PATH}`);
let keyJson;
try { keyJson = JSON.parse(readFileSync(KEY_PATH, 'utf8')); }
catch (e) { abort(`could not parse staging key JSON: ${e.message}`); }
if (keyJson.project_id === PROD_PROJECT) abort(`key project_id is PRODUCTION (${PROD_PROJECT}) — refusing.`);
if (keyJson.project_id !== STAGING_PROJECT) abort(`key project_id is '${keyJson.project_id}', expected '${STAGING_PROJECT}'.`);
console.log(`[flag-toggle] GUARD 1 passed — key bound to ${STAGING_PROJECT}.`);

const admin = require(resolve(REPO_ROOT, 'functions', 'node_modules', 'firebase-admin'));
admin.initializeApp({ credential: admin.credential.cert(keyJson), projectId: STAGING_PROJECT });
const resolvedProject = admin.app().options.projectId || keyJson.project_id;
if (resolvedProject !== STAGING_PROJECT) abort(`resolved Admin project is '${resolvedProject}'.`);
console.log(`[flag-toggle] GUARD 2 passed — Admin app project is ${resolvedProject}.`);

const db = admin.firestore();

(async () => {
  const ref = db.collection('tenants').doc(TENANT_ID).collection('config').doc('settings');
  await ref.set({ featureFlags: { [flagKey]: value } }, { merge: true });
  console.log(`[flag-toggle] set tenants/${TENANT_ID}/config/settings.featureFlags.${flagKey} = ${value}`);
  process.exit(0);
})().catch((err) => { console.error('[flag-toggle] FATAL:', err); process.exit(1); });
