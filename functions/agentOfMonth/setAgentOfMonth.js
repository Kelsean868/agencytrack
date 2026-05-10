const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { extractTotalProductionCredit, extractTotalApps, extractActivityFields } = require('../utils/fieldHelpers');

const MANAGER_ROLES = new Set([
  'branch_manager',
  'sales_manager',
  'tenant_admin',
  'platform_admin',
]);

// Trinidad is UTC-4, no DST
const TRINI_OFFSET_MS = 4 * 60 * 60 * 1000;

function getTriniNow() {
  return new Date(Date.now() - TRINI_OFFSET_MS);
}

function toMonthKey(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function getCurrentMonthKey() {
  return toMonthKey(getTriniNow());
}

function getPrevMonthKey() {
  const d = getTriniNow();
  d.setUTCMonth(d.getUTCMonth() - 1);
  return toMonthKey(d);
}

function isWithinEditWindow() {
  return getTriniNow().getUTCDate() <= 7;
}

exports.setAgentOfMonth = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const { role, tenantId } = context.auth.token;
  if (!MANAGER_ROLES.has(role)) {
    throw new functions.https.HttpsError('permission-denied', 'Requires branch_manager or above.');
  }

  const { branchId, monthKey, category, agentUid } = data;
  if (!branchId || !monthKey || !category || !agentUid) {
    throw new functions.https.HttpsError('invalid-argument', 'branchId, monthKey, category, and agentUid are required.');
  }
  if (!['api', 'apps', 'activity'].includes(category)) {
    throw new functions.https.HttpsError('invalid-argument', 'category must be api, apps, or activity.');
  }

  const current = getCurrentMonthKey();
  const prev = getPrevMonthKey();
  if (monthKey !== current && !(monthKey === prev && isWithinEditWindow())) {
    throw new functions.https.HttpsError('failed-precondition', 'This month is locked and can no longer be edited.');
  }

  const db = admin.firestore();

  const agentSnap = await db.doc(`tenants/${tenantId}/users/${agentUid}`).get();
  if (!agentSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Agent not found.');
  }
  const agentData = agentSnap.data();
  if (agentData.branchId !== branchId) {
    throw new functions.https.HttpsError('failed-precondition', 'Agent does not belong to the specified branch.');
  }

  // Fetch agent's submitted submissions for the target month.
  const subsSnap = await db
    .collection(`tenants/${tenantId}/submissions`)
    .where('agentId', '==', agentUid)
    .where('status', '==', 'submitted')
    .get();
  const monthSubs = subsSnap.docs
    .map((d) => d.data())
    .filter((s) => typeof s.weekStarting === 'string' && s.weekStarting.startsWith(monthKey));

  const achievementValue =
    category === 'api'
      ? monthSubs.reduce((sum, s) => sum + extractTotalProductionCredit(s), 0)
      : category === 'apps'
        ? monthSubs.reduce((sum, s) => sum + extractTotalApps(s), 0)
        : monthSubs.reduce((sum, s) => sum + extractActivityFields(s).activityTotal, 0);

  const categoryRecord = {
    agentUid,
    agentName: agentData.name || agentData.displayName || 'Agent',
    photoURL: agentData.photoURL ?? null,
    achievementValue,
    approvedBy: context.auth.uid,
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.doc(`tenants/${tenantId}/agentOfMonth/${monthKey}`).set(
    { monthKey, tenantId, branchId, [category]: categoryRecord },
    { merge: true },
  );

  return { success: true, monthKey, category, agentUid };
});
