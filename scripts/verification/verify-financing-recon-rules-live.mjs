/**
 * verify-financing-recon-rules-live.mjs — Rule 23/24 live-ruleset gate.
 *
 * Fetches the ACTIVE Firestore ruleset from the Firebase Rules API (NOT the deploy
 * log) and confirms the K6 financingReconciliation block is live: the access token is
 * minted inside this process from the Admin service-account credential and used only in
 * the Authorization header — it is never printed, logged, or passed through the shell.
 *
 *   node scripts/verification/verify-financing-recon-rules-live.mjs
 *
 * Exit 0 = live source contains the block (deploy landed). Exit 1 = block absent / error.
 */
import { createRequire } from 'module';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require   = createRequire(import.meta.url);

const PROJECT = 'agencytrack-2a610';
const keyPath = resolve(__dirname, '../../functions/service-account-key.json');
if (!existsSync(keyPath)) {
  console.error('ABORT: functions/service-account-key.json not found.');
  process.exit(1);
}

const admin = require(resolve(__dirname, '../../functions/node_modules/firebase-admin'));
const cred = admin.credential.cert(require(keyPath));

const main = async () => {
  const tok = await cred.getAccessToken();
  const auth = { Authorization: `Bearer ${tok.access_token}` };

  const relRes = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/releases/cloud.firestore`,
    { headers: auth },
  );
  if (!relRes.ok) { console.error(`Release fetch failed: ${relRes.status}`); process.exit(1); }
  const release = await relRes.json();
  const rulesetName = release.rulesetName; // projects/{p}/rulesets/{id}

  const rsRes = await fetch(`https://firebaserules.googleapis.com/v1/${rulesetName}`, { headers: auth });
  if (!rsRes.ok) { console.error(`Ruleset fetch failed: ${rsRes.status}`); process.exit(1); }
  const ruleset = await rsRes.json();

  const source = (ruleset.source?.files ?? []).map((f) => f.content).join('\n');
  const hasMatch         = /match\s+\/financingReconciliation\/\{docId\}/.test(source);
  const hasValidFn       = /function\s+validReconciliation\s*\(\)/.test(source);
  const hasYearInt       = /request\.resource\.data\.year\s+is\s+int/.test(source);
  const hasServiceMonths = /request\.resource\.data\.serviceMonths\s+is\s+int/.test(source);

  console.log('── Rule 23/24 — live ruleset gate ──');
  console.log(`active ruleset : ${rulesetName.split('/').pop()}`);
  console.log(`createTime     : ${ruleset.createTime}`);
  console.log(`match /financingReconciliation/{docId} : ${hasMatch}`);
  console.log(`function validReconciliation()         : ${hasValidFn}`);
  console.log(`year is int (Gemini fix present)       : ${hasYearInt}`);
  console.log(`serviceMonths is int (K6 fast-follow)  : ${hasServiceMonths}`);

  if (hasMatch && hasValidFn && hasYearInt && hasServiceMonths) {
    console.log('\n✓ LIVE — financingReconciliation block (incl. the year-is-int and serviceMonths-is-int constraints) is in the active ruleset. Deploy landed.');
    process.exit(0);
  }
  console.error('\n✗ INCOMPLETE — the active ruleset is missing the financingReconciliation match, validReconciliation(), the year-is-int constraint, or the serviceMonths-is-int constraint. Deploy did not land the full block.');
  process.exit(1);
};

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
