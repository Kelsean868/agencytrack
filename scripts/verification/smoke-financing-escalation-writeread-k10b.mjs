/**
 * smoke-financing-escalation-writeread-k10b.mjs — POST-DEPLOY write-read-ack cycle
 * for Track K · K10b (financingEscalations), as REAL SUBJECTS through the LIVE rules.
 *
 * Deferred-verification FU (banked at PR #779). Requires the rules + composite index
 * to be DEPLOYED (firebase deploy --only firestore:rules,firestore:indexes) and the
 * index Enabled. Reuses the natural A11Y smoke accounts (no seed): the A11Y agent is
 * in the A11Y UM's unit (agent.unitId == UM.uid) and the A11Y BM's branch
 * (agent.branchId == BM.branchId == smoke_branch), so all rule arms are exercised.
 *
 * Run (from the main worktree, .env.local present):
 *   node scripts/verification/smoke-financing-escalation-writeread-k10b.mjs
 *
 * Legs:
 *   1. UM raises on the in-unit agent → ALLOW; value-level doc assert (incl. branchId).
 *   2. UM raises on an out-of-unit agent (agentUnitId != uid) → DENY.
 *   3. Agent signed-in reads the escalation → DENY (no agent read arm).
 *   4. BM same-branch lists (composite index) + acks → ALLOW; status flip asserted.
 *   5. UM same-month re-raise → DENY (routes to update arm) = the "already raised" state.
 *   6. Cleanup (admin delete) → 0 orphans. Runs in finally.
 *
 * SAFETY: tatillife_smoke ONLY (aborts on tatillife_south). Client SDK for the real
 * rule-gated ops; Admin SDK for value-level asserts + cleanup. No credential is echoed.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc,
  collection, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = {};
readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).forEach((l) => {
  const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
});
const need = (k) => { const v = env[k]; if (!v) throw new Error(`Missing env var: ${k}`); return v; };

const TENANT = env.A11Y_TENANT_ID || 'tatillife_smoke';
if (TENANT === 'tatillife_south') { console.error('ABORT: refusing to write to tatillife_south (live pilot).'); process.exit(2); }

// Client SDK (real rule-gated ops).
const app = initializeApp({
  apiKey: need('VITE_FIREBASE_API_KEY'),
  authDomain: need('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: need('VITE_FIREBASE_PROJECT_ID'),
});
const auth = getAuth(app);
const cdb = getFirestore(app);

// Admin SDK (value-level asserts + cleanup) — from functions/node_modules.
const require = (await import('module')).createRequire(import.meta.url);
const admin = require(path.join(ROOT, 'functions', 'node_modules', 'firebase-admin'));
const key = require(path.join(ROOT, 'functions', 'service-account-key.json'));
admin.initializeApp({ credential: admin.credential.cert(key), projectId: key.project_id });
const adb = admin.firestore();

// TT-local month key (mirrors dateInputs.monthKeyFromDate(getTodayTT())).
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Port_of_Spain' }).format(new Date());
const MONTH = `${today.slice(0, 4)}_${today.slice(5, 7)}`;
const REASON = 'draw_decision';

const results = [];
const pass = (id, note = '') => { results.push({ id, ok: true, note }); console.log(`  PASS ${id}${note ? ' — ' + note : ''}`); };
const fail = (id, note = '') => { results.push({ id, ok: false, note }); console.log(`  FAIL ${id}${note ? ' — ' + note : ''}`); };

async function signIn(emailKey, pwKey) {
  await signInWithEmailAndPassword(auth, need(emailKey), need(pwKey));
  return auth.currentUser.uid;
}
const escRef = (id) => doc(cdb, `tenants/${TENANT}/financingEscalations/${id}`);
const escCol = () => collection(cdb, `tenants/${TENANT}/financingEscalations`);

async function main() {
  // Resolve the real subjects (admin read; no emails printed).
  const usersSnap = await adb.collection(`tenants/${TENANT}/users`).get();
  const byEmail = {};
  usersSnap.forEach((d) => { const x = d.data() || {}; if (x.email) byEmail[String(x.email).toLowerCase()] = { uid: d.id, ...x }; });
  const UM = byEmail[need('A11Y_UNIT_MANAGER_EMAIL').toLowerCase()];
  const BM = byEmail[need('A11Y_BRANCH_MANAGER_EMAIL').toLowerCase()];
  const AG = byEmail[need('A11Y_AGENT_EMAIL').toLowerCase()];
  if (!UM || !BM || !AG) throw new Error('Could not resolve UM/BM/agent in the smoke tenant.');
  if (AG.unitId !== UM.uid) throw new Error(`Precondition: agent.unitId (${AG.unitId}) != UM.uid (${UM.uid})`);
  if (AG.branchId !== BM.branchId) throw new Error(`Precondition: agent.branchId (${AG.branchId}) != BM.branchId (${BM.branchId})`);

  const ESC_ID = `${AG.uid}_${REASON}_${MONTH}`;
  console.log(`\nK10b write-read-ack (real subjects) → ${TENANT}  month=${MONTH}  esc=${ESC_ID}\n`);

  // Pre-clean any leftover from a prior run (admin).
  await adb.doc(`tenants/${TENANT}/financingEscalations/${ESC_ID}`).delete().catch(() => {});

  // ── Leg 1: UM raises on the in-unit agent → ALLOW ──────────────────────────
  await signIn('A11Y_UNIT_MANAGER_EMAIL', 'A11Y_UNIT_MANAGER_PASSWORD');
  try {
    await setDoc(escRef(ESC_ID), {
      tenantId: TENANT, agentId: AG.uid, agentName: AG.name ?? AG.email ?? AG.uid,
      agentUnitId: UM.uid, branchId: AG.branchId,
      raisedByUid: UM.uid, raisedByName: UM.name ?? 'Unit Mgr', raisedByRole: 'unit_manager',
      reason: REASON, note: 'writeread-smoke', status: 'open', createdAt: serverTimestamp(),
    });
    // Value-level assert via admin (rules deployed IS proven by the write succeeding).
    const snap = await adb.doc(`tenants/${TENANT}/financingEscalations/${ESC_ID}`).get();
    const d = snap.data() || {};
    (snap.exists && d.status === 'open' && d.branchId === AG.branchId && d.agentUnitId === UM.uid && d.raisedByUid === UM.uid)
      ? pass('1-um-raise', `open doc written (branchId=${d.branchId}, agentUnitId==UM.uid) — RULES ARE DEPLOYED`)
      : fail('1-um-raise', `doc assert mismatch: ${JSON.stringify({ exists: snap.exists, ...d, createdAt: undefined })}`);
  } catch (e) {
    fail('1-um-raise', `UM raise DENIED (${e.code || e.message}) — rules NOT deployed or payload invalid; STOP`);
    return; // nothing downstream can pass; cleanup runs in finally
  }

  // ── Leg 2: UM raises on an out-of-unit agent → DENY ───────────────────────
  try {
    await setDoc(escRef(`foilagent_${REASON}_${MONTH}`), {
      tenantId: TENANT, agentId: 'foilagent', agentName: 'Foil', agentUnitId: 'other_unit_uid',
      branchId: AG.branchId, raisedByUid: UM.uid, raisedByName: UM.name ?? 'Unit Mgr', raisedByRole: 'unit_manager',
      reason: REASON, note: 'out-of-unit', status: 'open', createdAt: serverTimestamp(),
    });
    fail('2-out-of-unit-deny', 'out-of-unit raise SUCCEEDED — rule breach');
  } catch (e) {
    e.code === 'permission-denied' ? pass('2-out-of-unit-deny', 'out-of-unit raise denied (agentUnitId != uid)')
      : fail('2-out-of-unit-deny', `unexpected error: ${e.code || e.message}`);
  }

  // ── Leg 3: agent signed-in cannot read the escalation → DENY ──────────────
  await signOut(auth);
  await signIn('A11Y_AGENT_EMAIL', 'A11Y_AGENT_PASSWORD');
  try {
    await getDoc(escRef(ESC_ID));
    fail('3-agent-read-deny', 'agent READ the escalation — rule breach');
  } catch (e) {
    e.code === 'permission-denied' ? pass('3-agent-read-deny', 'agent cannot read the escalation')
      : fail('3-agent-read-deny', `unexpected error: ${e.code || e.message}`);
  }

  // ── Leg 4: BM same-branch lists (composite index) + acks → ALLOW ──────────
  await signOut(auth);
  await signIn('A11Y_BRANCH_MANAGER_EMAIL', 'A11Y_BRANCH_MANAGER_PASSWORD');
  let listedOpen = false;
  try {
    const qs = await getDocs(query(escCol(), where('branchId', '==', BM.branchId), orderBy('status', 'asc'), orderBy('createdAt', 'desc')));
    listedOpen = qs.docs.some((x) => x.id === ESC_ID && (x.data().status === 'open'));
    listedOpen ? pass('4a-bm-list', `BM sees the open escalation via the composite index (${qs.size} in branch)`)
      : fail('4a-bm-list', `BM list did not include the open escalation (saw ${qs.docs.map((x) => x.id).join(',') || 'none'})`);
  } catch (e) {
    e.code === 'failed-precondition'
      ? fail('4a-bm-list', 'composite index NOT yet Enabled (FAILED_PRECONDITION) — wait for index build; STOP')
      : fail('4a-bm-list', `BM list error: ${e.code || e.message}`);
  }
  if (listedOpen) {
    try {
      await updateDoc(escRef(ESC_ID), { status: 'acknowledged', acknowledgedByUid: BM.uid, acknowledgedAt: serverTimestamp() });
      const d = (await adb.doc(`tenants/${TENANT}/financingEscalations/${ESC_ID}`).get()).data() || {};
      (d.status === 'acknowledged' && d.acknowledgedByUid === BM.uid)
        ? pass('4b-bm-ack', 'status flipped open→acknowledged, acknowledgedByUid == BM.uid')
        : fail('4b-bm-ack', `ack assert mismatch: status=${d.status} ackBy=${d.acknowledgedByUid}`);
    } catch (e) { fail('4b-bm-ack', `BM ack error: ${e.code || e.message}`); }
  }

  // ── Leg 5: UM same-month re-raise → DENY (the "already raised" state) ──────
  await signOut(auth);
  await signIn('A11Y_UNIT_MANAGER_EMAIL', 'A11Y_UNIT_MANAGER_PASSWORD');
  try {
    await setDoc(escRef(ESC_ID), {
      tenantId: TENANT, agentId: AG.uid, agentName: AG.name ?? AG.uid, agentUnitId: UM.uid, branchId: AG.branchId,
      raisedByUid: UM.uid, raisedByName: UM.name ?? 'Unit Mgr', raisedByRole: 'unit_manager',
      reason: REASON, note: 're-raise', status: 'open', createdAt: serverTimestamp(),
    });
    fail('5-dup-deny', 'same-month re-raise SUCCEEDED — should route to update arm and deny');
  } catch (e) {
    e.code === 'permission-denied' ? pass('5-dup-deny', 'same-month re-raise denied → surfaces "already raised this month"')
      : fail('5-dup-deny', `unexpected error: ${e.code || e.message}`);
  }
}

(async () => {
  try { await main(); }
  catch (e) { fail('smoke', `crashed: ${e.message}`); }
  finally {
    // ── Leg 6: cleanup (admin) — non-negotiable, 0 orphans ──────────────────
    try {
      await signOut(auth).catch(() => {});
      const MARKERS = ['writeread-smoke', 're-raise', 'out-of-unit'];
      let deleted = 0;
      const snap = await adb.collection(`tenants/${TENANT}/financingEscalations`).where('note', 'in', MARKERS).get().catch(() => ({ docs: [] }));
      for (const d of snap.docs) { await d.ref.delete(); deleted++; }
      const remain = await adb.collection(`tenants/${TENANT}/financingEscalations`).where('note', 'in', MARKERS).get().catch(() => ({ size: 0 }));
      (remain.size === 0) ? pass('6-cleanup', `deleted ${deleted} smoke doc(s), 0 orphans`)
        : fail('6-cleanup', `${remain.size} smoke doc(s) remain`);
    } catch (e) { fail('6-cleanup', `cleanup error: ${e.message}`); }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n──────────── RESULT: ${results.length - failed.length}/${results.length} PASS ────────────`);
    if (failed.length) { failed.forEach((r) => console.log(`  ✗ ${r.id}${r.note ? ' — ' + r.note : ''}`)); process.exit(1); }
    console.log('All legs green.');
    process.exit(0);
  }
})();
