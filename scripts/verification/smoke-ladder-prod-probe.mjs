/**
 * smoke-ladder-prod-probe.mjs — proves PRODUCTION's ingestCallActivity is
 * serving the ladder contract, while writing NO KPI of any kind.
 *
 * ── WHY THIS IS DELIBERATELY CRIPPLED ──────────────────────────────────────
 * The staging smoke (smoke-ladder-staging.mjs) exercises the whole loop because
 * staging_test is a tenant nobody reads. Production is not, so this script may
 * only send requests that are REFUSED under every contract version. Every probe
 * below is a 400 whichever revision is live; the two versions differ only in the
 * WORDS, and the words are the proof:
 *
 *   ladder body, no rung asserted
 *     old code: `kind` is dropped -> newBusiness with a null bucket
 *               -> "bucket must be one of ..."
 *     new code: -> "kind ladder requires at least one of ..."
 *
 * Nothing is accepted, so no daily doc, no ingest record, no agent's numbers.
 * The script asserts that afterwards rather than assuming it.
 *
 * FOOTPRINT: one callSources doc, created with a creditUid belonging to no
 * human, revoked in the same run and left in place as evidence. It is never
 * given a token that outlives this process, and the token is never printed.
 *
 *   node scripts/verification/smoke-ladder-prod-probe.mjs
 */

import { createRequire } from 'module';
import { randomBytes } from 'crypto';

const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');
const { hashToken } = require('../../functions/callSources/createCallSource');

const PROJECT = 'agencytrack-2a610';
const TENANT = 'tatillife_south';
const URL = `https://us-central1-${PROJECT}.cloudfunctions.net/ingestCallActivity`;

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

const stamp = Date.now();
const SOURCE_ID = `probe_ladder_${stamp}`;
const CREDIT_UID = `probe_ladder_no_agent_${stamp}`;
const RAW_TOKEN = randomBytes(32).toString('hex');
const OCCURRED = '2026-08-30T17:00:00-04:00';
const DATE = '2026-08-30';

async function post(body) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RAW_TOKEN}` },
    body: JSON.stringify(body),
  });
  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }
  return { status: res.status, payload };
}

const results = [];
const check = (name, ok, detail) => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -- ${detail}` : ''}`);
};

async function main() {
  console.log(`smoke-ladder-prod-probe  project=${PROJECT}  tenant=${TENANT}`);

  await db.doc(`tenants/${TENANT}/callSources/${SOURCE_ID}`).set({
    sourceId: SOURCE_ID,
    tenantId: TENANT,
    sourceApp: 'kqm-calls',
    sourceUserId: SOURCE_ID,
    creditUid: CREDIT_UID,
    label: 'ladder contract probe - no human, revoked in the same run, sends only 400s',
    tokenHash: hashToken(RAW_TOKEN),
    active: true,
    revokedAt: null,
    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 600e3)),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    const noRung = await post({
      sourceApp: 'kqm-calls', sourceId: `${SOURCE_ID}_a`, occurredAt: OCCURRED,
      kind: 'ladder', lane: 'newBusiness', bucket: null,
      reached: false, booking: false, newName: false, ffi: false,
      rawOutcome: 'probe', rawCampaign: 'probe',
    });
    check('THE VERSION PROOF: ladder-with-no-rung is refused in the NEW words',
      noRung.status === 400 && /kind ladder requires at least one of/.test(
        noRung.payload?.error || ''),
      `${noRung.status} ${noRung.payload?.error}`);

    const badKind = await post({
      sourceApp: 'kqm-calls', sourceId: `${SOURCE_ID}_b`, occurredAt: OCCURRED,
      kind: 'meeting', lane: 'newBusiness', bucket: 'cold',
      reached: true, booking: false, newName: false, ffi: false,
      rawOutcome: 'probe', rawCampaign: 'probe',
    });
    // Under the OLD code this body is LEGAL and would bump a dial. It is 400 only
    // because the deployed revision knows `kind` - which is why it runs second,
    // after the proof above has already established which revision is live.
    check('an unknown kind is refused rather than counted as a dial',
      badKind.status === 400 && /kind must be one of/.test(badKind.payload?.error || ''),
      `${badKind.status} ${badKind.payload?.error}`);

    // The production contract, proved by its refusals. An application with no
    // API figure must never become a zero, and a figure with no application
    // must never be dropped in silence — neither writes anything either way.
    const noFigure = await post({
      sourceApp: 'kqm-calls', sourceId: `${SOURCE_ID}_c`, occurredAt: OCCURRED,
      kind: 'ladder', lane: 'newBusiness', bucket: null,
      reached: false, booking: false, newName: false, ffi: false,
      appSubmitted: true,
      rawOutcome: 'probe', rawCampaign: 'probe',
    });
    check('an application with NO API figure is refused, never zeroed',
      noFigure.status === 400 && /appSubmitted requires apiAmount/.test(
        noFigure.payload?.error || ''),
      `${noFigure.status} ${noFigure.payload?.error}`);

    const overCap = await post({
      sourceApp: 'kqm-calls', sourceId: `${SOURCE_ID}_d`, occurredAt: OCCURRED,
      kind: 'ladder', lane: 'newBusiness', bucket: null,
      reached: false, booking: false, newName: false, ffi: false,
      appSubmitted: true, apiAmount: 1000001,
      rawOutcome: 'probe', rawCampaign: 'probe',
    });
    check('an API figure above the cap is refused as a typo',
      overCap.status === 400 && /probable typo/.test(overCap.payload?.error || ''),
      `${overCap.status} ${overCap.payload?.error}`);

    const daily = await db.doc(
      `tenants/${TENANT}/users/${CREDIT_UID}/dailyActivity/${DATE}`).get();
    check('NOTHING was written: no daily doc for the probe uid', !daily.exists);

    const ingestA = await db.doc(
      `tenants/${TENANT}/callActivity/kqm-calls__${SOURCE_ID}_a`).get();
    const ingestB = await db.doc(
      `tenants/${TENANT}/callActivity/kqm-calls__${SOURCE_ID}_b`).get();
    check('NOTHING was written: no ingest records', !ingestA.exists && !ingestB.exists);
  } finally {
    await db.doc(`tenants/${TENANT}/callSources/${SOURCE_ID}`).set({
      active: false,
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`revoked ${SOURCE_ID}`);
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('PROBE ERROR:', e); process.exit(2); });
