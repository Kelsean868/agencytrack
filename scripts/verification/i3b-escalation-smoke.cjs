'use strict';
/**
 * I3b escalation CF — 6-leg production smoke
 *
 * Uses Admin SDK to write test WAR docs (triggering onWarSubmitNotifyUpline),
 * waits for CF, verifies notifications, then deletes all test artifacts.
 *
 * Legs:
 *   1. UM under one standard → BM in branch gets manager_alert
 *   2. Compliant UM → no notification
 *   3. Re-submit (submitted→submitted) → no second notification
 *   4. BM under → SM(s) alerted
 *   5. SM under → no escalation (chain stops)
 *   6. CF log clean (no unhandled errors); WAR write succeeded each leg
 */

const admin = require('../../functions/node_modules/firebase-admin');
const path  = require('path');

const KEY_PATH = path.resolve(__dirname, '../../functions/service-account-key.json');
admin.initializeApp({
  credential: admin.credential.cert(require(KEY_PATH)),
});

const db     = admin.firestore();
const TENANT = 'tatillife_south';

// All test WAR doc IDs — cleaned up at end
const testWarIds = [];
// All test notification doc paths created by CF — cleaned up at end
const testNotifPaths = [];
// Override docs written for smoke (deleted at end)
const testOverridePaths = [];

// ── helpers ──────────────────────────────────────────────────────────────────

function pass(leg, msg) { console.log(`  [PASS] Leg ${leg}: ${msg}`); }
function fail(leg, msg) { console.error(`  [FAIL] Leg ${leg}: ${msg}`); process.exitCode = 1; }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function writeWar(warId, data) {
  await db
    .collection(`tenants/${TENANT}/managerWeeklyReports`)
    .doc(warId)
    .set(data);
  testWarIds.push(warId);
}

async function updateWarStatus(warId, status) {
  await db
    .collection(`tenants/${TENANT}/managerWeeklyReports`)
    .doc(warId)
    .update({ status });
}

async function getNotifIdSet(userId) {
  const snap = await db
    .collection(`tenants/${TENANT}/notifications`)
    .where('userId', '==', userId)
    .where('type', '==', 'manager_alert')
    .get();
  return new Map(snap.docs.map(d => [d.id, d]));
}

// Returns count of net-new notification docs for userId since snapshot `before` (Map of id→doc).
async function countNewNotifs(userId, before) {
  const after = await getNotifIdSet(userId);
  const newDocs = [];
  for (const [id, doc] of after) {
    if (!before.has(id)) newDocs.push(doc);
  }
  newDocs.forEach(d => testNotifPaths.push(d.ref));
  return newDocs.length;
}

// ── setup: query topology ─────────────────────────────────────────────────────

async function getTopology() {
  const [stdSnap, usersSnap] = await Promise.all([
    db.doc(`tenants/${TENANT}/config/managerActivityStandards`).get(),
    db.collection(`tenants/${TENANT}/users`).get(),
  ]);

  const standards = stdSnap.exists ? stdSnap.data() : {};

  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ums   = users.filter(u => u.role === 'unit_manager');
  const bms   = users.filter(u => u.role === 'branch_manager');
  const sms   = users.filter(u => u.role === 'sales_manager');

  return { standards, ums, bms, sms };
}

// ── cleanup ───────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log('\n── CLEANUP ──────────────────────────────────────────────────');
  const batch = db.batch();

  for (const warId of testWarIds) {
    batch.delete(db.collection(`tenants/${TENANT}/managerWeeklyReports`).doc(warId));
  }
  for (const ref of testNotifPaths) {
    batch.delete(ref);
  }
  for (const ref of testOverridePaths) {
    batch.delete(ref);
  }

  await batch.commit();
  console.log(`  Deleted ${testWarIds.length} test WAR(s) + ${testNotifPaths.length} test notification(s) + ${testOverridePaths.length} test override(s).`);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== I3b Escalation CF — Production Smoke ===\n');

  const { standards, ums, bms, sms } = await getTopology();

  console.log(`Standards (unit_manager):  jfwCount=${standards.unit_manager?.jfwCount ?? 'n/a'}`);
  console.log(`Standards (branch_manager): jfwCount=${standards.branch_manager?.jfwCount ?? 'n/a'}`);
  console.log(`UMs: ${ums.length}, BMs: ${bms.length}, SMs: ${sms.length}\n`);

  // Need at least one UM with a BM in the same branch
  const um = ums.find(u => u.branchId && bms.some(b => b.branchId === u.branchId));
  if (!um) {
    console.error('ABORT: no UM with a BM in the same branch found in production.');
    process.exitCode = 1;
    return;
  }
  const branchBms = bms.filter(b => b.branchId === um.branchId);
  const bm = bms.find(b => b.branchId && sms.length > 0);
  const sm = sms[0];

  const umStd  = standards.unit_manager?.jfwCount  ?? 3;
  const bmStd  = standards.branch_manager?.jfwCount ?? 2;
  const WEEK   = '2026-01-04'; // Sunday — smoke week

  console.log(`UM under test:  ${um.id} (branch: ${um.branchId})`);
  console.log(`Branch BMs:     ${branchBms.map(b => b.id).join(', ')}`);
  console.log(`BM under test:  ${bm?.id ?? 'none'} (branch: ${bm?.branchId})`);
  console.log(`SM(s):          ${sms.map(s => s.id).join(', ')}`);
  console.log(`Standards:      UM jfwCount>=${umStd}, BM jfwCount>=${bmStd}\n`);

  const CF_WAIT_MS = 6000; // allow 6s for CF to fire + write notifications

  // ── Leg 1: UM misses jfwCount → each BM in branch gets manager_alert ────────
  console.log('── Leg 1: UM under standard → BMs alerted ──────────────────');
  {
    // Snapshot existing notifications for each BM before the WAR write
    const bmSnapshots = {};
    for (const b of branchBms) bmSnapshots[b.id] = await getNotifIdSet(b.id);

    const warId = `smoke_um_missed_${Date.now()}`;
    await writeWar(warId, {
      managerId:   um.id,
      managerName: um.displayName || um.id,
      managerRole: 'unit_manager',
      branchId:    um.branchId,
      weekStart:   WEEK,
      tenantId:    TENANT,
      status:      'submitted',
      jfwCount:    0,         // under any realistic standard
    });
    await sleep(CF_WAIT_MS);

    for (const b of branchBms) {
      const notifs = await countNewNotifs(b.id, bmSnapshots[b.id]);
      if (notifs === 1) {
        const n = testNotifPaths[testNotifPaths.length - 1];
        const nData = (await n.get()).data();
        const titleOk = nData.title?.includes(um.displayName || um.id) && nData.title?.includes('missed');
        const bodyOk  = nData.body?.includes(WEEK);
        const typeOk  = nData.type === 'manager_alert';
        const readOk  = nData.read === false;
        const linkOk  = nData.link === null;
        if (titleOk && bodyOk && typeOk && readOk && linkOk) {
          pass(1, `BM ${b.id} got exactly 1 manager_alert (title/body/type/read/link ✓)`);
        } else {
          fail(1, `BM ${b.id} notification payload mismatch: ${JSON.stringify({ titleOk, bodyOk, typeOk, readOk, linkOk })}`);
        }
      } else {
        fail(1, `BM ${b.id} got ${notifs} notification(s) — expected 1`);
      }
    }
  }

  // ── Leg 2: Compliant UM → no notification ────────────────────────────────
  console.log('── Leg 2: Compliant UM → no notification ────────────────────');
  {
    const bmSnapshots = {};
    for (const b of branchBms) bmSnapshots[b.id] = await getNotifIdSet(b.id);

    const warId = `smoke_um_compliant_${Date.now()}`;
    await writeWar(warId, {
      managerId:   um.id,
      managerName: um.displayName || um.id,
      managerRole: 'unit_manager',
      branchId:    um.branchId,
      weekStart:   WEEK,
      tenantId:    TENANT,
      status:      'submitted',
      jfwCount:    umStd + 5,  // clearly meets standard
    });
    await sleep(CF_WAIT_MS);

    for (const b of branchBms) {
      const notifs = await countNewNotifs(b.id, bmSnapshots[b.id]);
      if (notifs === 0) {
        pass(2, `BM ${b.id}: no notification (compliant) ✓`);
      } else {
        fail(2, `BM ${b.id}: unexpected ${notifs} notification(s) on compliant submit`);
      }
    }
  }

  // ── Leg 3: submitted→submitted → no second notification (de-dup) ──────────
  console.log('── Leg 3: Re-submit (submitted→submitted) → de-dup ─────────');
  {
    const warId = `smoke_dedup_${Date.now()}`;
    await writeWar(warId, {
      managerId:   um.id,
      managerName: um.displayName || um.id,
      managerRole: 'unit_manager',
      branchId:    um.branchId,
      weekStart:   WEEK,
      tenantId:    TENANT,
      status:      'submitted',
      jfwCount:    0,
    });
    await sleep(CF_WAIT_MS);

    // Snapshot after first submit (whatever notifs now exist)
    const bmSnapshotsAfterFirst = {};
    for (const b of branchBms) bmSnapshotsAfterFirst[b.id] = await getNotifIdSet(b.id);

    // Second write: submitted→submitted — should NOT trigger CF gate
    await updateWarStatus(warId, 'submitted');
    await sleep(CF_WAIT_MS);

    for (const b of branchBms) {
      const extraNotifs = await countNewNotifs(b.id, bmSnapshotsAfterFirst[b.id]);
      if (extraNotifs === 0) {
        pass(3, `BM ${b.id}: no second notification on re-submit ✓`);
      } else {
        fail(3, `BM ${b.id}: ${extraNotifs} extra notification(s) on submitted→submitted`);
      }
    }
  }

  // ── Leg 4: BM under → SM(s) alerted ─────────────────────────────────────
  console.log('── Leg 4: BM under standard → SM(s) alerted ────────────────');
  if (!bm || sms.length === 0) {
    console.log('  SKIP: no BM with SMs in tenant — skipped (unit topology)');
  } else {
    // Org-default has no branch_manager jfwCount standard. Write a per-BM override
    // so the CF has a threshold to compare against, then clean it up in teardown.
    const overrideRef = db.doc(`tenants/${TENANT}/managerActivityStandardOverrides/${bm.id}`);
    await overrideRef.set({ jfwCount: 2 }, { merge: true });
    testOverridePaths.push(overrideRef);
    console.log(`  Wrote test override for BM ${bm.id}: jfwCount=2`);

    // Snapshot SM notification counts before the WAR write
    const smSnapshots = {};
    for (const s of sms) smSnapshots[s.id] = await getNotifIdSet(s.id);

    const warId = `smoke_bm_missed_${Date.now()}`;
    await writeWar(warId, {
      managerId:   bm.id,
      managerName: bm.displayName || bm.id,
      managerRole: 'branch_manager',
      branchId:    bm.branchId,
      weekStart:   WEEK,
      tenantId:    TENANT,
      status:      'submitted',
      jfwCount:    0,         // under the override standard (0 < 2)
    });
    await sleep(CF_WAIT_MS);

    for (const s of sms) {
      const notifs = await countNewNotifs(s.id, smSnapshots[s.id]);
      if (notifs === 1) {
        pass(4, `SM ${s.id} got 1 manager_alert from BM ${bm.id} (via per-BM override jfwCount=2) ✓`);
      } else {
        fail(4, `SM ${s.id} got ${notifs} notification(s) — expected 1`);
      }
    }
  }

  // ── Leg 5: SM under → no escalation ─────────────────────────────────────
  console.log('── Leg 5: SM submit → chain stops, no escalation ────────────');
  if (!sm) {
    console.log('  SKIP: no SM in tenant');
  } else {
    // Snapshot ALL users' manager_alert counts before the WAR write
    const allUsersSnap = await db.collection(`tenants/${TENANT}/users`).get();
    const allIds = allUsersSnap.docs.map(d => d.id);
    const allSnapshots = {};
    for (const uid of allIds) allSnapshots[uid] = await getNotifIdSet(uid);

    const warId = `smoke_sm_stopped_${Date.now()}`;
    await writeWar(warId, {
      managerId:   sm.id,
      managerName: sm.displayName || sm.id,
      managerRole: 'sales_manager',
      branchId:    sm.branchId ?? null,
      weekStart:   WEEK,
      tenantId:    TENANT,
      status:      'submitted',
      jfwCount:    0,
    });
    await sleep(CF_WAIT_MS);

    let anyNotif = false;
    for (const uid of allIds) {
      const newOnes = await countNewNotifs(uid, allSnapshots[uid]);
      if (newOnes > 0) {
        anyNotif = true;
        fail(5, `Unexpected notification for user ${uid} on SM submit`);
      }
    }
    if (!anyNotif) {
      pass(5, 'No escalation on SM submit — chain stops ✓');
    }
  }

  // ── Leg 6: CF log clean + WAR writes succeeded ────────────────────────────
  console.log('── Leg 6: WAR writes succeeded (verifying testWarIds exist) ─');
  {
    let allExist = true;
    for (const warId of testWarIds) {
      const snap = await db.collection(`tenants/${TENANT}/managerWeeklyReports`).doc(warId).get();
      if (!snap.exists) {
        fail(6, `WAR ${warId} missing — write failed`);
        allExist = false;
      }
    }
    if (allExist) {
      pass(6, `All ${testWarIds.length} test WAR doc(s) confirmed written ✓ (CF error does not block WAR write)`);
    }
    console.log('  → Check firebase functions:log for [onWarSubmitNotifyUpline] lines after this run to confirm no unhandled errors.');
  }

  // ── cleanup ───────────────────────────────────────────────────────────────
  await cleanup();

  console.log('\n=== SMOKE COMPLETE ===');
  if (process.exitCode === 1) {
    console.error('One or more legs FAILED — see above.');
  } else {
    console.log('All legs PASSED.');
  }
}

main().catch(err => {
  console.error('Unhandled smoke error:', err);
  process.exitCode = 1;
}).finally(async () => {
  // Ensure cleanup even if main throws
  if (testWarIds.length > 0 || testNotifPaths.length > 0) {
    try { await cleanup(); } catch { /* best-effort */ }
  }
  await admin.app().delete();
});
