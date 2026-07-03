/**
 * smoke-financing-escalation-k10c-postdeploy.mjs — POST-DEPLOY verification for
 * Track K · K10c (rules get()-bindings + onFinancingEscalationCreate BM bell CF),
 * as REAL SUBJECTS through the LIVE rules + the LIVE Cloud Function.
 *
 * Deferred-verification FU banked at PR #783. Requires the K10c rules + CF DEPLOYED
 * (firebase deploy --only firestore:rules,functions). Reuses the natural A11Y smoke
 * accounts (agent.unitId == UM.uid, agent.branchId == BM.branchId == smoke_branch)
 * plus one admin-seeded foil agent (different unit) for the forged-agentId DENY.
 *
 * Run (from the main worktree, .env.local present):
 *   node scripts/verification/smoke-financing-escalation-k10c-postdeploy.mjs
 *
 * Legs:
 *   1. UM coherent raise (real agent) → ALLOW; escalation doc asserted.
 *   2. BM receives the CF bell notification doc (value-level: id/userId/type/escalationId).
 *   3. Forged-agentId raise (foil agent in ANOTHER unit, agentUnitId stamped as own) →
 *      DENY live — proves the unitId get()-binding is LIVE (old rules would ALLOW it).
 *   3b. Wrong-branchId raise (real agent, branchId != agent's real branch) → DENY live —
 *      proves the branchId get()-binding is LIVE.
 *   4. #780 write-read-ack cycle, bindings live: agent-read DENY · BM list+ack ALLOW
 *      (status flip) · same-month dup DENY.
 *   5. CF idempotence: admin delete + re-create the escalation (re-fires onCreate) →
 *      still exactly ONE notification for (escalationId, BM) — deterministic-id dedupe.
 *   6. Cleanup (admin): escalation docs + CF notification docs + foil agent → 0 orphans.
 *
 * SAFETY: tatillife_smoke ONLY (aborts on tatillife_south). Client SDK for the real
 * rule-gated ops; Admin SDK for value-level asserts + cleanup. No credential echoed.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc,
  collection, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { loadEnv } from '../lib/loadEnv.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// Shared strict parser (FU-F-1, PR #198): skips blank/# lines, strips quotes,
// TOOLING-N embedded-key defense. Supersedes the inline parser (#780 FU item 4).
const env = loadEnv(path.join(ROOT, '.env.local'));
const need = (k) => { const v = env[k]; if (!v) throw new Error(`Missing env var: ${k}`); return v; };

const TENANT = env.A11Y_TENANT_ID || 'tatillife_smoke';
if (TENANT === 'tatillife_south') { console.error('ABORT: refusing to write to tatillife_south (live pilot).'); process.exit(2); }

const app = initializeApp({
  apiKey: need('VITE_FIREBASE_API_KEY'),
  authDomain: need('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: need('VITE_FIREBASE_PROJECT_ID'),
});
const auth = getAuth(app);
const cdb = getFirestore(app);

// Actionable setup errors instead of bare MODULE_NOT_FOUND (#780 FU item 3 parity).
const require = (await import('module')).createRequire(import.meta.url);
let admin, key;
try {
  admin = require(path.join(ROOT, 'functions', 'node_modules', 'firebase-admin'));
} catch {
  console.error('SETUP: firebase-admin not found — run `npm install` in functions/ first.');
  process.exit(2);
}
try {
  key = require(path.join(ROOT, 'functions', 'service-account-key.json'));
} catch {
  console.error('SETUP: functions/service-account-key.json missing — place the Admin SDK key there (gitignored; never commit).');
  process.exit(2);
}
admin.initializeApp({ credential: admin.credential.cert(key), projectId: key.project_id });
const adb = admin.firestore();

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date());
const MONTH = `${today.slice(0, 4)}_${today.slice(5, 7)}`;
const REASON = 'draw_decision';
const FOIL_UID = 'k10c_foil_agent';           // admin-seeded, unit != UM
const FOIL_UNIT = 'k10c_other_unit';

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(emailKey, pwKey) {
  await signInWithEmailAndPassword(auth, need(emailKey), need(pwKey));
  return auth.currentUser.uid;
}
const escRef = (id) => doc(cdb, `tenants/${TENANT}/financingEscalations/${id}`);
const escCol = () => collection(cdb, `tenants/${TENANT}/financingEscalations`);
const notifDedupeId = (escId, uid) => `finesc_${escId}_${uid}`;

function payload(agentUid, agentUnitId, branchId, overrides = {}) {
  return {
    tenantId: TENANT, agentId: agentUid, agentName: 'Smoke Agent',
    agentUnitId, branchId,
    raisedByUid: overrides.raisedByUid, raisedByName: 'Unit Mgr', raisedByRole: 'unit_manager',
    reason: REASON, note: 'k10c-postdeploy', status: 'open', createdAt: serverTimestamp(),
    ...overrides,
  };
}

let ESC_ID, UM, BM, AG;

async function main() {
  const usersSnap = await adb.collection(`tenants/${TENANT}/users`).get();
  const byEmail = {};
  usersSnap.forEach((d) => { const x = d.data() || {}; if (x.email) byEmail[String(x.email).toLowerCase()] = { uid: d.id, ...x }; });
  UM = byEmail[need('A11Y_UNIT_MANAGER_EMAIL').toLowerCase()];
  BM = byEmail[need('A11Y_BRANCH_MANAGER_EMAIL').toLowerCase()];
  AG = byEmail[need('A11Y_AGENT_EMAIL').toLowerCase()];
  if (!UM || !BM || !AG) throw new Error('Could not resolve UM/BM/agent.');
  // Field-presence preconditions — fail early with a clear message (#780 FU item 2 parity).
  for (const [who, u, fields] of [
    ['UM', UM, ['uid']], ['BM', BM, ['uid', 'branchId']], ['agent', AG, ['uid', 'unitId', 'branchId']],
  ]) {
    for (const f of fields) {
      if (!u[f]) throw new Error(`Precondition: resolved ${who} doc is missing required field "${f}"`);
    }
  }
  if (AG.unitId !== UM.uid) throw new Error(`Precondition: agent.unitId(${AG.unitId}) != UM.uid(${UM.uid})`);
  if (AG.branchId !== BM.branchId) throw new Error(`Precondition: agent.branchId(${AG.branchId}) != BM.branchId(${BM.branchId})`);

  ESC_ID = `${AG.uid}_${REASON}_${MONTH}`;
  console.log(`\nK10c post-deploy (real subjects, live rules+CF) → ${TENANT}  month=${MONTH}  esc=${ESC_ID}\n`);

  // Pre-clean (admin): escalation + its CF notification + any leftover foil.
  await adb.doc(`tenants/${TENANT}/financingEscalations/${ESC_ID}`).delete().catch(() => {});
  await adb.doc(`tenants/${TENANT}/notifications/${notifDedupeId(ESC_ID, BM.uid)}`).delete().catch(() => {});
  await adb.doc(`tenants/${TENANT}/users/${FOIL_UID}`).delete().catch(() => {});
  // Seed the foil agent (different unit, same branch) for the forged-agentId DENY.
  await adb.doc(`tenants/${TENANT}/users/${FOIL_UID}`).set({ role: 'agent', unitId: FOIL_UNIT, branchId: BM.branchId, tenantId: TENANT, email: 'k10c-foil@smoke.local', name: 'K10c Foil' });

  // ── Leg 1: UM coherent raise → ALLOW ───────────────────────────────────────
  await signIn('A11Y_UNIT_MANAGER_EMAIL', 'A11Y_UNIT_MANAGER_PASSWORD');
  try {
    await setDoc(escRef(ESC_ID), payload(AG.uid, UM.uid, AG.branchId, { raisedByUid: UM.uid, agentName: AG.name ?? AG.uid }));
    const d = (await adb.doc(`tenants/${TENANT}/financingEscalations/${ESC_ID}`).get()).data() || {};
    (d.status === 'open' && d.branchId === AG.branchId && d.agentUnitId === UM.uid)
      ? pass('1-coherent-raise', 'coherent raise ALLOW (rules+bindings live)')
      : fail('1-coherent-raise', `doc mismatch: ${JSON.stringify({ ...d, createdAt: undefined })}`);
  } catch (e) {
    fail('1-coherent-raise', `coherent raise DENIED (${e.code || e.message}) — rules not deployed or agent doc incoherent; STOP`);
    return;
  }

  // ── Leg 2: BM receives the CF bell notification (value-level) ──────────────
  const notifId = notifDedupeId(ESC_ID, BM.uid);
  let notif = null;
  for (let i = 0; i < 20 && !notif; i++) { // poll up to ~30s for the async CF
    const s = await adb.doc(`tenants/${TENANT}/notifications/${notifId}`).get();
    if (s.exists) notif = s.data(); else await sleep(1500);
  }
  if (!notif) {
    // Explicit stop (#784 FU item 2): the message says STOP — make the code match.
    // Legs 3–5 are CF/rules-dependent; cleanup still runs in finally.
    fail('2-bm-bell-ping', `notification ${notifId} not written after ~30s — CF not deployed/fired; STOP`);
    return;
  } else {
    (notif.userId === BM.uid && notif.type === 'manager_alert' && notif.escalationId === ESC_ID && notif.read === false)
      ? pass('2-bm-bell-ping', `CF wrote ${notifId} (userId==BM, type=manager_alert, escalationId==esc, read=false) — CF LIVE`)
      : fail('2-bm-bell-ping', `notification shape mismatch: ${JSON.stringify({ userId: notif.userId, type: notif.type, escalationId: notif.escalationId, read: notif.read })}`);
  }

  // ── Leg 3: forged-agentId raise → DENY (unitId binding live) ───────────────
  // UM raises on the foil agent (unit=FOIL_UNIT) while STAMPING agentUnitId=UM.uid
  // (satisfies the old agentUnitId==auth.uid check) — only the NEW get()-binding
  // raisedAgent().unitId==auth.uid can deny this. Old rules would ALLOW.
  try {
    await setDoc(escRef(`${FOIL_UID}_${REASON}_${MONTH}`), payload(FOIL_UID, UM.uid, BM.branchId, { raisedByUid: UM.uid }));
    fail('3-forged-agentid-deny', 'forged-agentId raise SUCCEEDED — unitId binding NOT live (old rules?)');
  } catch (e) {
    e.code === 'permission-denied' ? pass('3-forged-agentid-deny', 'forged-agentId raise DENIED — unitId get()-binding LIVE')
      : fail('3-forged-agentid-deny', `unexpected error: ${e.code || e.message}`);
  }

  // ── Leg 3b: wrong-branchId raise → DENY (branchId binding live) ────────────
  // Real agent, but a branchId that is NOT the agent's real branch → the
  // request.branchId == raisedAgent().branchId binding must deny.
  try {
    await setDoc(escRef(`${AG.uid}_confirm_request_${MONTH}`), payload(AG.uid, UM.uid, 'k10c_wrong_branch', { raisedByUid: UM.uid, reason: 'confirm_request' }));
    fail('3b-wrong-branch-deny', 'wrong-branchId raise SUCCEEDED — branchId binding NOT live');
  } catch (e) {
    e.code === 'permission-denied' ? pass('3b-wrong-branch-deny', 'wrong-branchId raise DENIED — branchId get()-binding LIVE')
      : fail('3b-wrong-branch-deny', `unexpected error: ${e.code || e.message}`);
  }

  // ── Leg 4: write-read-ack cycle (bindings live) ───────────────────────────
  // 4a agent cannot read
  await signOut(auth); await signIn('A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD');
  try { await getDoc(escRef(ESC_ID)); fail('4a-agent-read-deny', 'agent READ the escalation'); }
  catch (e) { e.code === 'permission-denied' ? pass('4a-agent-read-deny', 'agent cannot read') : fail('4a-agent-read-deny', e.code || e.message); }

  // 4b BM lists (composite index) + acks
  await signOut(auth); await signIn('A11Y_BRANCH_MANAGER_EMAIL', 'A11Y_BRANCH_MANAGER_PASSWORD');
  let sawOpen = false;
  try {
    const qs = await getDocs(query(escCol(), where('branchId', '==', BM.branchId), orderBy('status', 'asc'), orderBy('createdAt', 'desc')));
    sawOpen = qs.docs.some((x) => x.id === ESC_ID && x.data().status === 'open');
    sawOpen ? pass('4b-bm-list', 'BM sees the open escalation via composite index') : fail('4b-bm-list', 'BM list missing the open escalation');
  } catch (e) { fail('4b-bm-list', e.code === 'failed-precondition' ? 'composite index not Enabled' : (e.code || e.message)); }
  if (sawOpen) {
    try {
      await updateDoc(escRef(ESC_ID), { status: 'acknowledged', acknowledgedByUid: BM.uid, acknowledgedAt: serverTimestamp() });
      const d = (await adb.doc(`tenants/${TENANT}/financingEscalations/${ESC_ID}`).get()).data() || {};
      (d.status === 'acknowledged' && d.acknowledgedByUid === BM.uid) ? pass('4c-bm-ack', 'status open→acknowledged, ackBy==BM') : fail('4c-bm-ack', `status=${d.status} ackBy=${d.acknowledgedByUid}`);
    } catch (e) { fail('4c-bm-ack', e.code || e.message); }
  }

  // 4d same-month dup DENY (UM re-raise routes to update arm)
  await signOut(auth); await signIn('A11Y_UNIT_MANAGER_EMAIL', 'A11Y_UNIT_MANAGER_PASSWORD');
  try { await setDoc(escRef(ESC_ID), payload(AG.uid, UM.uid, AG.branchId, { raisedByUid: UM.uid })); fail('4d-dup-deny', 'same-month re-raise SUCCEEDED'); }
  catch (e) { e.code === 'permission-denied' ? pass('4d-dup-deny', 'same-month re-raise denied ("already raised")') : fail('4d-dup-deny', e.code || e.message); }
  await signOut(auth);

  // ── Leg 5: CF idempotence — re-fire onCreate, still ONE notification ───────
  // Admin delete + re-create the escalation (fires onCreate again). The CF's
  // deterministic-id .create() must swallow ALREADY_EXISTS → exactly one notif.
  await adb.doc(`tenants/${TENANT}/financingEscalations/${ESC_ID}`).delete();
  await sleep(1500);
  await adb.doc(`tenants/${TENANT}/financingEscalations/${ESC_ID}`).set({
    tenantId: TENANT, agentId: AG.uid, agentName: AG.name ?? AG.uid, agentUnitId: UM.uid, branchId: AG.branchId,
    raisedByUid: UM.uid, raisedByName: 'Unit Mgr', raisedByRole: 'unit_manager', reason: REASON, note: 'k10c-idem', status: 'open',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await sleep(8000); // let the re-fire settle
  const notifQ = await adb.collection(`tenants/${TENANT}/notifications`).where('escalationId', '==', ESC_ID).get();
  const forBm = notifQ.docs.filter((d) => d.data().userId === BM.uid);
  (forBm.length === 1) ? pass('5-cf-idempotence', `re-fire produced no duplicate — exactly 1 notification for (esc, BM)`)
    : fail('5-cf-idempotence', `expected 1 notification for BM, found ${forBm.length}`);
}

(async () => {
  try { await main(); }
  catch (e) { fail('smoke', `crashed: ${e.message}`); }
  finally {
    try {
      await signOut(auth).catch(() => {});
      let deleted = 0;
      // NO inline .catch on the cleanup delete/verify queries (#780 FU item 1
      // parity): a failed query must propagate to the outer handler and register
      // a FAIL — never report "0 orphans" it did not actually verify.
      // Escalation docs from this run (note markers + the idem re-create).
      const escSnap = await adb.collection(`tenants/${TENANT}/financingEscalations`).where('note', 'in', ['k10c-postdeploy', 'k10c-idem']).get();
      for (const d of escSnap.docs) { await d.ref.delete(); deleted++; }
      if (ESC_ID) { await adb.doc(`tenants/${TENANT}/financingEscalations/${ESC_ID}`).delete(); }
      // CF notification docs for our escalation id.
      if (ESC_ID) {
        const nSnap = await adb.collection(`tenants/${TENANT}/notifications`).where('escalationId', '==', ESC_ID).get();
        for (const d of nSnap.docs) { await d.ref.delete(); deleted++; }
      }
      // Foil agent.
      await adb.doc(`tenants/${TENANT}/users/${FOIL_UID}`).delete();
      // Orphan check.
      const remainEsc = ESC_ID ? (await adb.collection(`tenants/${TENANT}/financingEscalations`).where('note', 'in', ['k10c-postdeploy', 'k10c-idem']).get()).size : 0;
      const remainNotif = ESC_ID ? (await adb.collection(`tenants/${TENANT}/notifications`).where('escalationId', '==', ESC_ID).get()).size : 0;
      const foilGone = !(await adb.doc(`tenants/${TENANT}/users/${FOIL_UID}`).get()).exists;
      (remainEsc === 0 && remainNotif === 0 && foilGone)
        ? pass('6-cleanup', `deleted ${deleted} doc(s) + foil; 0 orphans`)
        : fail('6-cleanup', `orphans — esc:${remainEsc} notif:${remainNotif} foilGone:${foilGone}`);
    } catch (e) { fail('6-cleanup', `cleanup error: ${e.message}`); }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
    if (failed.length) { failed.forEach((r) => console.log(`  ✗ ${r.id}${r.note ? ' — ' + r.note : ''}`)); process.exit(1); }
    console.log('All legs green.');
    process.exit(0);
  }
})().catch((e) => { console.error('SMOKE CRASHED:', e); process.exit(1); });
