/**
 * smoke-ladder-staging.mjs — proves the DEPLOYED ingestCallActivity understands
 * the ladder contract, end to end, against STAGING ONLY.
 *
 * Why this exists: every contract check in the repo runs against the source in
 * this working tree. None of them can tell you which revision Cloud Functions is
 * actually serving, and that is the only question that matters before the KQM
 * projection starts sending ladder events - a 400 there marks an outbox row
 * `rejected`, which is permanent by design.
 *
 * It talks to agencytrack-staging (tenant staging_test) and NEVER to production.
 * The token it uses is generated here, used for a few seconds, and revoked in
 * the same run; nothing is deleted, so the evidence stays readable afterwards.
 *
 *   node scripts/verification/smoke-ladder-staging.mjs
 */

import { createRequire } from 'module';
import { randomBytes } from 'crypto';

const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');
const { hashToken } = require('../../functions/callSources/createCallSource');

const PROJECT = 'agencytrack-staging';
const TENANT = 'staging_test';
const URL = `https://us-central1-${PROJECT}.cloudfunctions.net/ingestCallActivity`;

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

const stamp = Date.now();
const SOURCE_ID = `smoke_ladder_${stamp}`;
const CREDIT_UID = `smoke_ladder_agent_${stamp}`;
const RAW_TOKEN = randomBytes(32).toString('hex');
// 17:00 TT on a fixed day, so the daily doc id is unambiguous.
const OCCURRED = '2026-08-30T17:00:00-04:00';
const DATE = '2026-08-30';

const base = (over = {}) => ({
  sourceApp: 'kqm-calls',
  occurredAt: OCCURRED,
  lane: 'newBusiness',
  rawOutcome: 'smoke',
  rawCampaign: 'smoke_2026',
  ...over,
});

const call = (over = {}) => base({
  bucket: 'cold', reached: true, booking: false, newName: false, ffi: false, ...over,
});

const ladder = (over = {}) => base({
  kind: 'ladder', bucket: null,
  reached: false, booking: false, newName: false, ffi: false,
  ...over,
});

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
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -- ${detail}` : ''}`);
}

async function main() {
  console.log(`smoke-ladder-staging  project=${PROJECT}  tenant=${TENANT}`);
  console.log(`url=${URL}`);

  await db.doc(`tenants/${TENANT}/callSources/${SOURCE_ID}`).set({
    sourceId: SOURCE_ID,
    tenantId: TENANT,
    sourceApp: 'kqm-calls',
    sourceUserId: SOURCE_ID,
    creditUid: CREDIT_UID,
    label: 'ladder smoke (temporary, revoked at the end of this run)',
    tokenHash: hashToken(RAW_TOKEN),
    active: true,
    revokedAt: null,
    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3600e3)),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`seeded call source ${SOURCE_ID} -> creditUid ${CREDIT_UID}\n`);

  try {
    // 1. THE VERSION PROOF. Old code drops `kind`, sees lane newBusiness with a
    //    null bucket, and answers "bucket must be one of ...". New code sees a
    //    ladder event asserting no rung. Both are 400 and neither writes, so
    //    this probe is safe whichever revision is live - only the words differ.
    const probe = await post(ladder({ sourceId: `${SOURCE_ID}_probe` }));
    check('ladder-aware revision is live', probe.status === 400
      && /requires at least one of/.test(probe.payload?.error || ''),
    `${probe.status} ${probe.payload?.error}`);

    // 2. A real fact find.
    const ffi = await post(ladder({ sourceId: `${SOURCE_ID}_ffi`, ffiHeld: true }));
    check('a fact find held is accepted', ffi.status === 200 && ffi.payload?.applied === true,
      `${ffi.status} ${JSON.stringify(ffi.payload)}`);

    // 3. Idempotency still holds on the new shape.
    const ffiAgain = await post(ladder({ sourceId: `${SOURCE_ID}_ffi`, ffiHeld: true }));
    check('a replayed ladder event counts once',
      ffiAgain.status === 200 && ffiAgain.payload?.applied === false,
      `${ffiAgain.status} ${JSON.stringify(ffiAgain.payload)}`);

    // 4. A closing interview, in the servicing lane, to prove lane independence.
    const ci = await post(ladder({
      sourceId: `${SOURCE_ID}_ci`, lane: 'servicing', closingHeld: true,
    }));
    check('a closing interview in the servicing lane is accepted', ci.status === 200,
      `${ci.status} ${JSON.stringify(ci.payload)}`);

    // 5. The old contract, untouched. THE BACKWARDS-COMPATIBILITY PROOF: this is
    //    byte-identical to what the live KQM dispatcher sends today.
    const plain = await post(call({ sourceId: `${SOURCE_ID}_call` }));
    check('a plain call with no kind is still accepted', plain.status === 200
      && plain.payload?.applied === true, `${plain.status} ${JSON.stringify(plain.payload)}`);

    // 6. The confusions.
    const withBucket = await post(ladder({
      sourceId: `${SOURCE_ID}_bad1`, bucket: 'cold', ffiHeld: true,
    }));
    check('a ladder event carrying a dial bucket is refused', withBucket.status === 400
      && /bucket must be null when kind is ladder/.test(withBucket.payload?.error || ''),
    `${withBucket.status} ${withBucket.payload?.error}`);

    const callWithRung = await post(call({ sourceId: `${SOURCE_ID}_bad2`, ffiHeld: true }));
    check('a call asserting a ladder rung is refused', callWithRung.status === 400
      && /requires kind ladder/.test(callWithRung.payload?.error || ''),
    `${callWithRung.status} ${callWithRung.payload?.error}`);

    // 7. THE ARITHMETIC. A meeting must move no dial-shaped field.
    const daily = (await db.doc(
      `tenants/${TENANT}/users/${CREDIT_UID}/dailyActivity/${DATE}`,
    ).get()).data() || {};
    console.log(`\ndaily doc ${DATE}: ${JSON.stringify(daily)}\n`);

    check('ffiConducted is 1', daily.ffiConducted === 1, String(daily.ffiConducted));
    check('ciConducted is 1', daily.ciConducted === 1, String(daily.ciConducted));
    check('dials is 1 - the ONE call, not the meetings', daily.dials === 1, String(daily.dials));
    check('dialsByType.cold is 1', daily.dialsByType?.cold === 1,
      JSON.stringify(daily.dialsByType));
    check('the partition still balances',
      daily.dials === Object.values(daily.dialsByType || {}).reduce((s, n) => s + n, 0),
      `${daily.dials} vs ${JSON.stringify(daily.dialsByType)}`);
    check('no serviceCalls from the servicing-lane MEETING',
      daily.serviceCalls === undefined, String(daily.serviceCalls));

    // 8. The ingest record carries the discriminator.
    const rec = (await db.doc(
      `tenants/${TENANT}/callActivity/kqm-calls__${SOURCE_ID}_ffi`,
    ).get()).data() || {};
    check('the ingest record says kind ladder', rec.kind === 'ladder', String(rec.kind));
    check('...and carries the rung it asserted', rec.ffiHeld === true, String(rec.ffiHeld));
    const callRec = (await db.doc(
      `tenants/${TENANT}/callActivity/kqm-calls__${SOURCE_ID}_call`,
    ).get()).data() || {};
    check('a call record says kind call', callRec.kind === 'call', String(callRec.kind));
  } finally {
    // Revoked, not deleted. The docs stay readable as evidence; the token stops
    // working the moment this run ends.
    await db.doc(`tenants/${TENANT}/callSources/${SOURCE_ID}`).set({
      active: false,
      revokedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`\nrevoked call source ${SOURCE_ID}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error('SMOKE ERROR:', e); process.exit(2); });
