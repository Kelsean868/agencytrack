const admin = require('firebase-admin');
const functions = require('firebase-functions/v1');
const { extractTotalProductionCredit, extractTotalApps, extractActivityFields } = require('../utils/fieldHelpers');

const MANAGER_ROLES = new Set([
  'branch_manager',
  'sales_manager',
  'tenant_admin',
  'platform_admin',
]);

exports.getAgentOfMonthCandidates = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const { role, tenantId } = context.auth.token;
  if (!MANAGER_ROLES.has(role)) {
    throw new functions.https.HttpsError('permission-denied', 'Requires branch_manager or above.');
  }

  const { branchId, monthKey } = data;
  if (!branchId || !monthKey) {
    throw new functions.https.HttpsError('invalid-argument', 'branchId and monthKey are required.');
  }
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new functions.https.HttpsError('invalid-argument', 'monthKey must be YYYY-MM format.');
  }

  const db = admin.firestore();

  // Fetch all active agents in the branch (single query, cheap for pilot scale)
  const agentsSnap = await db
    .collection(`tenants/${tenantId}/users`)
    .where('branchId', '==', branchId)
    .where('role', '==', 'agent')
    .get();

  if (agentsSnap.empty) {
    return { api: [], apps: [], activity: [] };
  }

  const agentMap = new Map();
  for (const docSnap of agentsSnap.docs) {
    const d = docSnap.data();
    if (d.provisioning === true) continue;
    agentMap.set(docSnap.id, {
      agentUid: docSnap.id,
      agentName: d.name || d.displayName || 'Agent',
      photoURL: d.photoURL ?? null,
    });
  }

  if (agentMap.size === 0) {
    return { api: [], apps: [], activity: [] };
  }

  const agentUids = new Set(agentMap.keys());

  // Fetch all submitted submissions for the tenant, filter in memory
  // (avoids Firestore `in` query limits with large agent sets)
  const subsSnap = await db
    .collection(`tenants/${tenantId}/submissions`)
    .where('status', '==', 'submitted')
    .get();

  const monthSubs = subsSnap.docs
    .map((d) => d.data())
    .filter(
      (s) =>
        typeof s.weekStarting === 'string' &&
        s.weekStarting.startsWith(monthKey) &&
        agentUids.has(s.agentId),
    );

  // Aggregate per agent for all three categories
  const totals = new Map();
  for (const uid of agentUids) {
    totals.set(uid, { api: 0, apps: 0, activity: 0 });
  }

  for (const sub of monthSubs) {
    const t = totals.get(sub.agentId);
    if (!t) continue;
    t.api += extractTotalProductionCredit(sub);
    t.apps += extractTotalApps(sub);
    t.activity += extractActivityFields(sub).activityTotal;
  }

  // Build sorted top-5 list per category
  function rankCategory(field) {
    return [...agentMap.entries()]
      .map(([uid, info]) => ({ ...info, value: totals.get(uid)?.[field] ?? 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));
  }

  return {
    api: rankCategory('api'),
    apps: rankCategory('apps'),
    activity: rankCategory('activity'),
  };
});
