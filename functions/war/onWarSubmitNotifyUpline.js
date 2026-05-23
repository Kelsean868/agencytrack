'use strict';

const admin     = require('firebase-admin');
const functions = require('firebase-functions');
const { resolveStandards, computeMissed } = require('./escalationLogic');

/**
 * WAR-write trigger: on first submit transition, compute missed activities and
 * write a manager_alert notification to each upline recipient.
 *
 * Gate: before.status !== 'submitted' && after.status === 'submitted'
 * This naturally de-dups re-submits and ignores onWarWrite's jfwCount
 * write-back (which updates jfwCount but never changes status).
 *
 * Upline topology (locked — uniform, no per-manager exceptions):
 *   unit_manager   → all branch_managers with matching branchId (composite index)
 *   branch_manager → all sales_managers in the tenant (single-field index, auto)
 *   sales_manager  → no escalation (chain stops)
 *
 * Best-effort: notification failures are caught per-recipient and logged;
 * they NEVER throw and NEVER block the WAR write that triggered this CF.
 */
async function handleWarSubmitNotify(change, context) {
  if (!change.after.exists) return null;

  const before = change.before.exists ? change.before.data() : {};
  const after  = change.after.data();

  if (before.status === 'submitted' || after.status !== 'submitted') return null;

  const { tenantId, managerId, managerRole, branchId, weekStart } = after;
  const managerName = after.managerName ?? managerId;

  if (!managerId || !managerRole || !tenantId) {
    console.warn('[onWarSubmitNotifyUpline] missing required fields; skipping', context.params.warId);
    return null;
  }

  if (managerRole === 'sales_manager') {
    console.log(`[onWarSubmitNotifyUpline] ${context.params.warId}: sales_manager; chain stops`);
    return null;
  }

  try {
    // 1. Resolve standards: org-default + per-manager override
    const [orgDefaultSnap, overrideSnap] = await Promise.all([
      admin.firestore().doc(`tenants/${tenantId}/config/managerActivityStandards`).get(),
      admin.firestore().doc(`tenants/${tenantId}/managerActivityStandardOverrides/${managerId}`).get(),
    ]);
    const orgDefault = orgDefaultSnap.exists ? orgDefaultSnap.data() : {};
    const override   = overrideSnap.exists   ? overrideSnap.data()   : null;
    const resolved   = resolveStandards(orgDefault, override, managerRole);

    // 2. Compute missed
    const missed = computeMissed(after, resolved);
    if (missed.length === 0) {
      console.log(`[onWarSubmitNotifyUpline] ${context.params.warId}: all standards met; no notification`);
      return null;
    }

    // 3. Query upline recipients
    let recipientsQuery;
    if (managerRole === 'unit_manager') {
      if (!branchId) {
        console.warn('[onWarSubmitNotifyUpline] unit_manager missing branchId; cannot resolve upline', managerId);
        return null;
      }
      // Requires composite index: users (role ASC, branchId ASC)
      recipientsQuery = admin.firestore()
        .collection(`tenants/${tenantId}/users`)
        .where('role', '==', 'branch_manager')
        .where('branchId', '==', branchId);
    } else {
      // branch_manager → all sales_managers; single-field index, no composite needed
      recipientsQuery = admin.firestore()
        .collection(`tenants/${tenantId}/users`)
        .where('role', '==', 'sales_manager');
    }

    const recipientsSnap = await recipientsQuery.get();
    if (recipientsSnap.docs.length === 0) {
      console.log(`[onWarSubmitNotifyUpline] ${context.params.warId}: no upline recipients found`);
      return null;
    }

    // 4. Write notifications (best-effort per recipient)
    const missedCount = missed.length;
    const missedList  = missed.map(m => m.label).join(', ');
    const title = `WAR alert: ${managerName} missed ${missedCount} standard${missedCount !== 1 ? 's' : ''}`;
    const body  = `${managerName} submitted their WAR for week of ${weekStart} with ${missedCount} activit${missedCount !== 1 ? 'ies' : 'y'} under target: ${missedList}.`;

    await Promise.all(
      recipientsSnap.docs.map(recipDoc =>
        admin.firestore()
          .collection(`tenants/${tenantId}/notifications`)
          .add({
            userId:    recipDoc.id,
            tenantId,
            type:      'manager_alert',
            title,
            body,
            link:      null,
            read:      false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          .catch(err => console.error(`[onWarSubmitNotifyUpline] notification write failed for ${recipDoc.id}:`, err))
      )
    );

    console.log(`[onWarSubmitNotifyUpline] ${context.params.warId}: notified ${recipientsSnap.docs.length} recipient(s) (${missedCount} missed)`);
  } catch (err) {
    // Best-effort — a failed escalation NEVER blocks the WAR write
    console.error('[onWarSubmitNotifyUpline] unexpected error (swallowed):', err);
  }

  return null;
}

exports.onWarSubmitNotifyUpline = functions.firestore
  .document('tenants/{tenantId}/managerWeeklyReports/{warId}')
  .onWrite(handleWarSubmitNotify);
