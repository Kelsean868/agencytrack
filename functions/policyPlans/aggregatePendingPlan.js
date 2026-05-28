'use strict';

const admin     = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * Firestore trigger: policy.onCreate
 *
 * Aggregates free-text planName entries into config/policyPlans.pendingReview[].
 * Runs only when the policy was logged without a catalog planId (agent typed
 * a custom plan name). Uses a transaction + contributedPolicyIds[] sub-array
 * for idempotent deduplication — same source policyId can never double-count.
 *
 * Early-return gates (in order):
 *   1. planId set → agent used the catalog; nothing to aggregate.
 *   2. !planName → no free-text name; nothing to aggregate.
 *   3. config/policyPlans doc missing → admin hasn't initialized catalog yet.
 *   4. Active catalog plan already matches name (case-insensitive) → not pending.
 */
exports.aggregatePendingPlan = functions.firestore
  .document('tenants/{tenantId}/policies/{policyId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const { tenantId, policyId } = context.params;

    if (data.planId) return null;
    if (!data.planName?.trim()) return null;

    const db     = admin.firestore();
    const cfgRef = db.doc(`tenants/${tenantId}/config/policyPlans`);
    const cfgSnap = await cfgRef.get();
    if (!cfgSnap.exists) return null;

    const normalized = data.planName.trim().toLowerCase();
    const { plans = [] } = cfgSnap.data();

    if (plans.some((p) => p.isActive && p.name.trim().toLowerCase() === normalized)) {
      return null;
    }

    await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(cfgRef);
      if (!freshSnap.exists) return;

      const { plans: activePlans = [], pendingReview: pending = [] } = freshSnap.data();

      if (activePlans.some((p) => p.isActive && p.name.trim().toLowerCase() === normalized)) {
        return;
      }

      const newPending = [...pending];
      const idx = newPending.findIndex(
        (p) => p.name.trim().toLowerCase() === normalized
      );

      if (idx >= 0) {
        const entry = { ...newPending[idx] };
        const ids = entry.contributedPolicyIds ?? [];
        if (ids.includes(policyId)) return;
        entry.loggedByAgents = (entry.loggedByAgents ?? 0) + 1;
        entry.contributedPolicyIds = [...ids, policyId];
        newPending[idx] = entry;
      } else {
        newPending.push({
          name: data.planName.trim(),
          loggedByAgents: 1,
          firstLoggedAt: admin.firestore.FieldValue.serverTimestamp(),
          contributedPolicyIds: [policyId],
        });
      }

      tx.update(cfgRef, { pendingReview: newPending });
    });

    return null;
  });
