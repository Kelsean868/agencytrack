/**
 * verify-financing-notify-k7-live.mjs — Phase 6 live CF verification for Track K · K7.
 *
 * Proves notifyFinancingAdjustment in PRODUCTION (agencytrack-2a610):
 *   L2 POSITIVE — real >10% confirmed cut → fires; bell + audit (SERVER pct + basis)
 *                 + cooldown written; audit records the SERVER-recomputed pct, NOT the
 *                 fabricated client payload.
 *   L3 SECOND FIRE — a direct second call RE-WRITES artifacts (no server-side cooldown
 *                 block — that is the #1 FU; client button is the only guard today).
 *   L4 NEGATIVE (load-bearing) — ledger shows <=10% but client CLAIMS >10% → the CF
 *                 writes NOTHING and returns { success:false, reason:'condition-not-met' }.
 *                 This proves the clause-5.3 audit trail CANNOT be fabricated.
 *   L5 lighter negatives — provisional basis / missing ledger / unconfirmed manager → no fire.
 *
 * Admin SDK (ADC) seeds + reads-back + cleans up (value-level). A BM client auth token
 * invokes the live callable. The recipient is a TEST user with NO email → the CF takes
 * its emailQueued:false path: no mail/ doc, no SendGrid, no outbound email.
 *
 * Throw-away test agent in the BM's OWN branch (agentInScope). Far-future months (2099_*)
 * never collide with real ledger data. ALL seeds + CF-written artifacts cleaned in finally;
 * the original financingConfig is saved and restored.
 *
 * Run from the MAIN worktree (has .env.local + node_modules):
 *   node scripts/verification/verify-financing-notify-k7-live.mjs
 */
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { initializeApp as initClientApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

const require = createRequire(import.meta.url);
const admin = require('../../functions/node_modules/firebase-admin');

// ── env ───────────────────────────────────────────────────────────────────────
function loadEnv() {
  const src = readFileSync('.env.local', 'utf8');
  src.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}
loadEnv();
const req = (k) => { const v = process.env[k]; if (!v) throw new Error(`Missing env var ${k}`); return v; };

const PROJECT_ID = 'agencytrack-2a610';
const NOTIFY_TYPE = 'financing.adjustment.notify';
const TS = Date.now();
const AGENT_UID = `k7lv-agent-${TS}`;
const RECIPIENT_UID = `k7lv-recipient-${TS}`;

const results = [];
const pass = (leg, detail = '') => { results.push({ leg, ok: true, detail }); console.log(`  PASS  ${leg}${detail ? ' — ' + detail : ''}`); };
const fail = (leg, detail = '') => { results.push({ leg, ok: false, detail }); console.log(`  FAIL  ${leg}${detail ? ' — ' + detail : ''}`); };
const approx = (a, b) => Math.abs(a - b) < 1e-9;

// ── Admin SDK (ADC) ─────────────────────────────────────────────────────────
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

// ── seeded-doc tracking for cleanup ───────────────────────────────────────────
let TENANT = null;
const seededDocPaths = [];      // terms / ledger / user docs
let originalConfig = undefined; // undefined = doc absent; else the prior data

const ledgerPath = (m) => `tenants/${TENANT}/financing/${AGENT_UID}_${m}`;
const cooldownPath = (m) => `tenants/${TENANT}/nudges/${AGENT_UID}_${NOTIFY_TYPE}_${m}`;

async function seedLedger(month, fields) {
  const p = ledgerPath(month);
  await db.doc(p).set({ agentId: AGENT_UID, tenantId: TENANT, month, ...fields });
  if (!seededDocPaths.includes(p)) seededDocPaths.push(p);
}

// Count CF-written artifacts (single-field queries → no composite index needed;
// the test recipient/agent are unique so every match is ours).
async function bellsForRecipient() {
  const snap = await db.collection(`tenants/${TENANT}/notifications`).where('userId', '==', RECIPIENT_UID).get();
  return snap.docs.map((d) => d.data());
}
async function auditsForAgent(month = null) {
  const snap = await db.collection(`tenants/${TENANT}/auditNudges`).where('agentId', '==', AGENT_UID).get();
  return snap.docs.map((d) => d.data()).filter((d) => d.type === NOTIFY_TYPE && (month === null || d.month === month));
}

async function main() {
  console.log(`\nK7 notifyFinancingAdjustment — PRODUCTION live verify  (project ${PROJECT_ID})\n`);

  // Client auth — sign in as BM to invoke the callable.
  const clientApp = initClientApp({
    apiKey: req('VITE_FIREBASE_API_KEY'),
    authDomain: req('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: PROJECT_ID,
  });
  const auth = getAuth(clientApp);
  const cred = await signInWithEmailAndPassword(auth, req('A11Y_BRANCH_MANAGER_EMAIL'), req('A11Y_BRANCH_MANAGER_PASSWORD'));
  const tok = await cred.user.getIdTokenResult();
  TENANT = tok.claims.tenantId;
  const bmUid = cred.user.uid;
  const bmRole = tok.claims.role;
  if (!TENANT || bmRole !== 'branch_manager') {
    fail('setup', `BM token claims unexpected: role=${bmRole} tenantId=${TENANT}`);
    return;
  }

  // BM branchId from the user doc (the CF's agentInScope reads caller.branchId from the doc).
  const bmDoc = await db.doc(`tenants/${TENANT}/users/${bmUid}`).get();
  const bmBranchId = bmDoc.exists ? bmDoc.data().branchId : null;
  if (!bmBranchId) {
    fail('setup', `BM ${bmUid} has no branchId on file — cannot satisfy agentInScope`);
    return;
  }
  console.log(`  setup: BM ${bmUid} tenant=${TENANT} branch=${bmBranchId}`);

  const notify = httpsCallable(getFunctions(clientApp, 'us-central1'), 'notifyFinancingAdjustment');
  const fire = (month) => notify({
    agentId: AGENT_UID,
    month,
    // FABRICATED client payload — the CF must IGNORE adjustmentPct and recompute.
    payload: { adjustmentPct: 0.99, monthLabel: `TEST ${month}`, agentName: 'Fabricated Name' },
  }).then((r) => r.data);

  try {
    // ── Seed test recipient (NO email) + test agent (BM's branch) + config ──────
    const recipientPath = `tenants/${TENANT}/users/${RECIPIENT_UID}`;
    await db.doc(recipientPath).set({ uid: RECIPIENT_UID, tenantId: TENANT, role: 'tenant_admin', name: 'K7 LiveVerify Recipient' /* NO email */ });
    seededDocPaths.push(recipientPath);
    const agentPath = `tenants/${TENANT}/users/${AGENT_UID}`;
    await db.doc(agentPath).set({ uid: AGENT_UID, tenantId: TENANT, role: 'agent', name: 'K7 LiveVerify Agent', branchId: bmBranchId, unitId: null });
    seededDocPaths.push(agentPath);

    const cfgRef = db.doc(`tenants/${TENANT}/config/financingConfig`);
    const cfgSnap = await cfgRef.get();
    originalConfig = cfgSnap.exists ? cfgSnap.data() : undefined;
    await cfgRef.set({ notifyRecipientUid: RECIPIENT_UID }, { merge: true });

    // Terms (shared denominator) — currentMonthlyFinancing 5000.
    const termsPath = `tenants/${TENANT}/financingTerms/${AGENT_UID}`;
    await db.doc(termsPath).set({ agentId: AGENT_UID, tenantId: TENANT, currentMonthlyFinancing: 5000, agreedMonthlyFinancing: 5000, validatingAPI: 30000, effectiveDate: '2099-01-01' });
    seededDocPaths.push(termsPath);

    // ── L2 — POSITIVE fire (14% confirmed cut on 2099_01) ──────────────────────
    await seedLedger('2099_01', { managerFinancing: 4300, basisSource: 'settled-confirmed' }); // (5000-4300)/5000 = 0.14
    const r1 = await fire('2099_01');
    if (r1?.success === true && r1.recipientUid === RECIPIENT_UID && r1.emailQueued === false) {
      pass('L2 positive fire returns success (no email — recipient has none)', `recipientUid=${r1.recipientUid} emailQueued=${r1.emailQueued}`);
    } else {
      fail('L2 positive fire', `unexpected result: ${JSON.stringify(r1)}`);
    }
    // read-back: bell
    const bells1 = await bellsForRecipient();
    const bell = bells1[0];
    if (bells1.length === 1 && bell.type === NOTIFY_TYPE && bell.userId === RECIPIENT_UID && bell.body.includes('14%') && !bell.body.includes('99%')) {
      pass('L2 bell persisted to recipient (server 14%, not client 99%)', `body="${bell.body.slice(0, 60)}…"`);
    } else {
      fail('L2 bell read-back', `count=${bells1.length} body=${bell?.body}`);
    }
    // read-back: audit (SERVER pct + basis, not client)
    const audits1 = await auditsForAgent('2099_01');
    const audit = audits1[0];
    if (audits1.length === 1 && approx(audit.adjustmentPct, 0.14) && audit.basisSource === 'settled-confirmed' && audit.recipientUid === RECIPIENT_UID && audit.actorUid === bmUid) {
      pass('L2 audit records SERVER-recomputed pct + basis (NOT client 0.99)', `adjustmentPct=${audit.adjustmentPct} basisSource=${audit.basisSource}`);
    } else {
      fail('L2 audit read-back', `count=${audits1.length} pct=${audit?.adjustmentPct} basis=${audit?.basisSource}`);
    }
    // read-back: cooldown
    const cd = await db.doc(cooldownPath('2099_01')).get();
    if (cd.exists && cd.data().audienceUid === AGENT_UID && approx(cd.data().payload?.adjustmentPct, 0.14)) {
      pass('L2 cooldown record written (value-level)', `audienceUid=${cd.data().audienceUid}`);
    } else {
      fail('L2 cooldown read-back', `exists=${cd.exists}`);
    }

    // ── L3 — SECOND fire DEMONSTRATES the #1 gap (no server-side block) ─────────
    const r2 = await fire('2099_01');
    const bells2 = await bellsForRecipient();
    const audits2 = await auditsForAgent('2099_01');
    if (r2?.success === true && bells2.length === 2 && audits2.length === 2) {
      pass('L3 second fire RE-WRITES artifacts (confirms #1 cooldown is FU/client-only)', `bells=${bells2.length} audits=${audits2.length}`);
    } else {
      fail('L3 second fire', `success=${r2?.success} bells=${bells2.length} audits=${audits2.length} (expected 2/2)`);
    }

    // ── L4 — NEGATIVE (load-bearing): fabricated client pct, ledger <=10% ───────
    await seedLedger('2099_02', { managerFinancing: 4800, basisSource: 'settled-confirmed' }); // (5000-4800)/5000 = 0.04
    const bellsBefore = (await bellsForRecipient()).length;
    const rNeg = await fire('2099_02'); // client payload claims 0.99
    const condNotMet = rNeg?.success === false && rNeg.reason === 'condition-not-met';
    const cdNeg = await db.doc(cooldownPath('2099_02')).get();
    const auditsNeg = await auditsForAgent('2099_02');
    const bellsAfter = (await bellsForRecipient()).length;
    if (condNotMet && !cdNeg.exists && auditsNeg.length === 0 && bellsAfter === bellsBefore) {
      pass('L4 NEGATIVE: fabricated >10% on a <=10% ledger → condition-not-met + ZERO artifacts', `reason=${rNeg.reason}; bells +0, audit 0, cooldown absent`);
    } else {
      fail('L4 NEGATIVE (LEGAL-INTEGRITY PROOF)', `condNotMet=${condNotMet} reason=${rNeg?.reason} cooldownExists=${cdNeg.exists} audits=${auditsNeg.length} bellsΔ=${bellsAfter - bellsBefore}`);
    }

    // ── L5 — lighter negatives ─────────────────────────────────────────────────
    // provisional basis (14% cut but unconfirmed)
    await seedLedger('2099_03', { managerFinancing: 4300, basisSource: 'submitted-provisional' });
    const rProv = await fire('2099_03');
    const cdProv = await db.doc(cooldownPath('2099_03')).get();
    (rProv?.reason === 'condition-not-met' && !cdProv.exists)
      ? pass('L5a provisional basis → condition-not-met, no fire')
      : fail('L5a provisional basis', `reason=${rProv?.reason} cooldown=${cdProv.exists}`);

    // missing ledger month (no ledger doc for 2099_04)
    const rMissing = await fire('2099_04');
    const cdMissing = await db.doc(cooldownPath('2099_04')).get();
    (rMissing?.reason === 'condition-not-met' && !cdMissing.exists)
      ? pass('L5b missing ledger month → condition-not-met, no fire')
      : fail('L5b missing ledger', `reason=${rMissing?.reason} cooldown=${cdMissing.exists}`);

    // unconfirmed managerFinancing (confirmed basis but no manager figure)
    await seedLedger('2099_05', { basisSource: 'settled-confirmed' });
    const rUnconf = await fire('2099_05');
    const cdUnconf = await db.doc(cooldownPath('2099_05')).get();
    (rUnconf?.reason === 'condition-not-met' && !cdUnconf.exists)
      ? pass('L5c unconfirmed managerFinancing → condition-not-met, no fire')
      : fail('L5c unconfirmed manager', `reason=${rUnconf?.reason} cooldown=${cdUnconf.exists}`);

  } finally {
    // ── L6 — cleanup (value-level tenant-clean confirm) ────────────────────────
    console.log('\n  cleanup…');
    // CF-written artifacts: bells (recipient), audits (agent), cooldowns (agent).
    const bellSnap = await db.collection(`tenants/${TENANT}/notifications`).where('userId', '==', RECIPIENT_UID).get().catch(() => ({ docs: [] }));
    const auditSnap = await db.collection(`tenants/${TENANT}/auditNudges`).where('agentId', '==', AGENT_UID).get().catch(() => ({ docs: [] }));
    const nudgeSnap = await db.collection(`tenants/${TENANT}/nudges`).where('audienceUid', '==', AGENT_UID).get().catch(() => ({ docs: [] }));
    const toDelete = [
      ...bellSnap.docs.map((d) => d.ref),
      ...auditSnap.docs.map((d) => d.ref),
      ...nudgeSnap.docs.map((d) => d.ref),
      ...seededDocPaths.map((p) => db.doc(p)),
    ];
    for (const ref of toDelete) await ref.delete().catch(() => {});

    // Restore the original financingConfig (or delete if it was absent before).
    const cfgRef = db.doc(`tenants/${TENANT}/config/financingConfig`);
    if (originalConfig === undefined) await cfgRef.delete().catch(() => {});
    else await cfgRef.set(originalConfig).catch(() => {});

    // Value-level clean confirm.
    const bellsLeft = (await db.collection(`tenants/${TENANT}/notifications`).where('userId', '==', RECIPIENT_UID).get().catch(() => ({ size: -1 }))).size;
    const auditsLeft = (await db.collection(`tenants/${TENANT}/auditNudges`).where('agentId', '==', AGENT_UID).get().catch(() => ({ size: -1 }))).size;
    const nudgesLeft = (await db.collection(`tenants/${TENANT}/nudges`).where('audienceUid', '==', AGENT_UID).get().catch(() => ({ size: -1 }))).size;
    const agentLeft = (await db.doc(`tenants/${TENANT}/users/${AGENT_UID}`).get()).exists;
    const recipLeft = (await db.doc(`tenants/${TENANT}/users/${RECIPIENT_UID}`).get()).exists;
    const termsLeft = (await db.doc(`tenants/${TENANT}/financingTerms/${AGENT_UID}`).get()).exists;
    const cfgNow = await cfgRef.get();
    const cfgRestored = originalConfig === undefined ? !cfgNow.exists : JSON.stringify(cfgNow.data()) === JSON.stringify(originalConfig);
    const clean = bellsLeft === 0 && auditsLeft === 0 && nudgesLeft === 0 && !agentLeft && !recipLeft && !termsLeft && cfgRestored;
    clean
      ? pass('L6 cleanup — tenant clean (value-level)', `bells/audits/nudges=0; agent/recipient/terms gone; config restored`)
      : fail('L6 cleanup', `bells=${bellsLeft} audits=${auditsLeft} nudges=${nudgesLeft} agent=${agentLeft} recip=${recipLeft} terms=${termsLeft} cfgRestored=${cfgRestored}`);
  }
}

main()
  .then(() => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n──────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────`);
    if (failed.length) { failed.forEach((r) => console.log(`  ✗ ${r.leg}${r.detail ? ' — ' + r.detail : ''}`)); process.exit(1); }
    console.log('All legs green.');
    process.exit(0);
  })
  .catch((err) => { console.error('Fatal:', err?.stack ?? err); process.exit(1); });
