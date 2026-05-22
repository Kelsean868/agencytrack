'use strict';

const admin     = require('firebase-admin');
const functions = require('firebase-functions');
const { computeWeekEnd, computeJfwCount, shouldWriteBack } = require('./jfwCountLogic');

/**
 * WAR-write trigger: recomputes jfwCount from the Track F joint-call log and
 * writes it back onto the WAR doc (Admin SDK, bypasses rules).
 *
 * Fires on create + update; ignores delete (change.after.exists === false).
 * Loop-guard: only writes when the recomputed count differs from the stored
 * value — the CF's own update triggers another onWrite, but the second
 * invocation finds stored === computed and short-circuits immediately.
 *
 * Freshness note: reflects joint calls as of the last WAR save. Full-freshness
 * via a jointCalls-write trigger is deferred (see docs/FOLLOW_UPS.md).
 */
async function handleWarWrite(change, context) {
  if (!change.after.exists) return null;

  const data      = change.after.data();
  const managerId = data.managerId;
  const weekStart = data.weekStart;
  const tenantId  = data.tenantId;

  if (!managerId || !weekStart || !tenantId) {
    console.warn('[onWarWrite] missing required fields on WAR doc; skipping', context.params.warId);
    return null;
  }

  const weekEnd = computeWeekEnd(weekStart);

  const snap = await admin.firestore()
    .collectionGroup('jointCalls')
    .where('authorUid', '==', managerId)
    .where('tenantId', '==', tenantId)
    .where('appointmentDate', '>=', weekStart)
    .where('appointmentDate', '<', weekEnd)
    .get();

  const count = computeJfwCount(snap.docs);

  if (!shouldWriteBack(data.jfwCount ?? 0, count)) {
    console.log(`[onWarWrite] ${context.params.warId}: jfwCount already ${count}; no write`);
    return null;
  }

  await admin.firestore()
    .doc(`tenants/${tenantId}/managerWeeklyReports/${context.params.warId}`)
    .update({ jfwCount: count });

  console.log(`[onWarWrite] ${context.params.warId}: jfwCount ${data.jfwCount ?? 0} → ${count}`);
  return null;
}

exports.onWarWrite = functions.firestore
  .document('tenants/{tenantId}/managerWeeklyReports/{warId}')
  .onWrite(handleWarWrite);
