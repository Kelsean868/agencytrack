'use strict';

const admin     = require('firebase-admin');
const functions = require('firebase-functions');

// ─────────────────────────────────────────────────────────────────────────────
// Track K · K10c — onFinancingEscalationCreate (BM bell ping)
//
// On CREATE of tenants/{tid}/financingEscalations/{id} (a UM raising a tracked
// financing escalation on an own-unit agent — K10b), write ONE bell notification
// to each branch_manager in the tenant whose branchId == the escalation's
// denormalized branchId. The SAME-BRANCH BM inbox is the escalation surface; this
// CF only PINGS them so they act on the doc. The escalation doc itself remains the
// record — no notification on ack (minimal slice).
//
// Mirrors onWarSubmitNotifyUpline: same recipient-lookup shape (users where
// role == 'branch_manager' AND branchId == X — the EXISTING users(role, branchId)
// composite index) and the same canonical bell schema
// ({userId, tenantId, type, title, body, link, read, createdAt}).
//
// UNRELATED to functions/war/escalationLogic.js (WAR missed-standard upline
// notify) — different concept, no shared symbols, no import.
//
// Idempotence (re-delivery tolerance): gen-1 Firestore triggers guarantee
// at-least-once, so this handler can fire more than once for one create. Each
// notification is written with a DETERMINISTIC id derived from the escalation id
// + recipient uid via .doc(id).create(); a re-delivery re-creates the SAME id and
// Firestore rejects it with ALREADY_EXISTS (caught per-recipient) → no duplicate
// bell spam. .create() (not .set()) is what makes the dedupe fail-safe.
//
// Best-effort: notification failures are caught per-recipient and logged; they
// NEVER throw (a thrown gen-1 trigger would be retried, re-running the whole
// handler — the deterministic-id .create() keeps that retry idempotent anyway).
// ─────────────────────────────────────────────────────────────────────────────

const NOTIFY_TYPE = 'manager_alert'; // rendered by NotificationDrawer TYPE_META

// Deterministic per-(escalation, recipient) notification id — the dedupe key.
// Firestore uids and the reason/month segments of the escalation id carry no
// characters illegal in a doc id, so this is a safe, collision-free join.
function notifDedupeId(escalationId, recipientUid) {
  return `finesc_${escalationId}_${recipientUid}`;
}

async function handleFinancingEscalationCreate(snap, context) {
  const { tenantId, escalationId } = context.params;
  const esc = snap.exists ? snap.data() : null;
  if (!esc) return null;

  const { branchId, agentName, raisedByName, reason } = esc;

  // A missing/blank branchId can't route to any BM inbox — the K10c rules bind
  // branchId to the agent's real branch, so this should never happen post-deploy,
  // but guard rather than run an unfiltered recipient query.
  if (!branchId || typeof branchId !== 'string') {
    console.warn(`[onFinancingEscalationCreate] ${escalationId}: missing/blank branchId; no recipients`);
    return null;
  }

  try {
    // Recipient lookup: same-branch branch managers. Uses the EXISTING composite
    // index users (role ASC, branchId ASC) — no new index.
    const recipientsSnap = await admin.firestore()
      .collection(`tenants/${tenantId}/users`)
      .where('role', '==', 'branch_manager')
      .where('branchId', '==', branchId)
      .get();

    if (recipientsSnap.empty) {
      console.log(`[onFinancingEscalationCreate] ${escalationId}: no same-branch BM recipients (branchId=${branchId})`);
      return null;
    }

    const agentLabel  = agentName    || 'an agent';
    const raiserLabel = raisedByName || 'A unit manager';
    const title = 'Financing escalation raised';
    const body  =
      `${raiserLabel} raised a financing escalation on ${agentLabel}` +
      `${reason ? ` (${reason})` : ''}. Open your escalations inbox to review and acknowledge.`;
    const ts = admin.firestore.FieldValue.serverTimestamp();

    await Promise.all(
      recipientsSnap.docs.map((recipDoc) => {
        // Deterministic id → .create() throws ALREADY_EXISTS on re-delivery, which
        // we swallow. The escalation id + recipient uid in the payload satisfy the
        // post-deploy smoke's value-level assertions.
        const dedupeId = notifDedupeId(escalationId, recipDoc.id);
        return admin.firestore()
          .collection(`tenants/${tenantId}/notifications`)
          .doc(dedupeId)
          .create({
            userId:       recipDoc.id,
            tenantId,
            type:         NOTIFY_TYPE,
            title,
            body,
            link:         null,
            read:         false,
            escalationId,            // value-level smoke assertion + audit trace
            createdAt:    ts,
          })
          .catch((err) => {
            if (err?.code === 6 || err?.code === 'already-exists') {
              // Re-delivery of the same escalation create — already pinged. Idempotent.
              console.log(`[onFinancingEscalationCreate] ${escalationId}: dedupe hit for ${recipDoc.id} (already notified)`);
              return null;
            }
            console.error(`[onFinancingEscalationCreate] notification write failed for ${recipDoc.id}:`, err);
            return null;
          });
      })
    );

    console.log(`[onFinancingEscalationCreate] ${escalationId}: pinged ${recipientsSnap.size} same-branch BM(s) (branchId=${branchId})`);
  } catch (err) {
    // Best-effort — a failed ping NEVER blocks or retries destructively; the
    // deterministic-id .create() keeps any at-least-once retry idempotent.
    console.error('[onFinancingEscalationCreate] unexpected error (swallowed):', err);
  }

  return null;
}

exports.onFinancingEscalationCreate = functions.firestore
  .document('tenants/{tenantId}/financingEscalations/{escalationId}')
  .onCreate(handleFinancingEscalationCreate);

// Exported for unit tests.
exports._internals = { handleFinancingEscalationCreate, notifDedupeId, NOTIFY_TYPE };
