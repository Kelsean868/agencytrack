'use strict';

const { APP_URL, CONTACT_EMAIL } = require('../lib/config');

// ─────────────────────────────────────────────────────────────────────────────
// Track K · K7 — notifyFinancingAdjustment callable CF (clause-5.3 notify duty)
//
// A branch-manager-and-up discharges the clause-5.3 obligation: when an agent's
// confirmed monthly financing is cut >10% below the amount in effect, the BM
// must NOTIFY a configured recipient (the CRO-function holder). This is a
// MANAGER-CONFIRMED fire (the manager clicks the affordance) — never auto-fired
// on a proration save, and never an automatic termination.
//
// Why a NEW CF (not sendComplianceNudge): that CF's targetInScope REJECTS a
// tenant-level recipient for a BM caller (target.branchId === caller.branchId),
// and its audience model resolves caller-scoped DOWN-LINE agents. Here the
// recipient is a tenant-level CRO. This CF resolves the recipient SERVER-SIDE
// from config (config-driven, not caller-supplied → the cross-branch concern is
// contained) and REUSES only the TRANSPORT, not the audience resolution.
//
// Per fire the CF writes via the Admin SDK (rules bypass):
//   (a) tenants/{tid}/notifications/{autoId} — the EXISTING bell schema
//       ({userId, tenantId, type, title, body, link, read, createdAt}); userId =
//       the configured recipient.
//   (b) tenants/{tid}/auditNudges/{autoId} — tenant-scoped audit append (who /
//       when / payload) for the 5.3 paper trail (CD#15).
//   (c) tenants/{tid}/nudges/{agentId}_{TYPE}_{month} — SET-MERGE cooldown /
//       dedupe record (deterministic id; reuses the nudges collection + its
//       CF-only rules, zero rules edit). Powers the manager's 24h cooldown chip
//       via a deterministic-ID GET.
//   (a)+(b)+(c) are ONE atomic batch. (d) a mail/ doc is added separately —
//       email failure is NON-FATAL (the sendComplianceNudge precedent).
//
// Recipient config: tenants/{tid}/config/financingConfig.notifyRecipientUid. When
// UNSET the CF returns a STRUCTURED { success:false, reason:'no-recipient' } — NOT
// a thrown error — so the UI can render its disabled "no recipient configured"
// state. A configured-but-missing recipient user → reason:'recipient-not-found'.
// ─────────────────────────────────────────────────────────────────────────────

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { buildMailDoc } = require('../utils/email');

// BM-and-up (CD#5 "BM; UM excluded"). platform_admin has no tenant context to
// fire within (tenantId:null) — excluded by design; the tenant precondition would
// reject it regardless.
const NOTIFY_ACTOR_ROLES = new Set(['branch_manager', 'sales_manager', 'tenant_admin']);

const NOTIFY_TYPE = 'financing.adjustment.notify';
const MONTH_KEY_RE = /^\d{4}_\d{2}$/;

// Is the SUBJECT agent within the caller's scope? Defense-in-depth: a BM may only
// discharge the duty for an agent in their own branch; SM/TA are tenant-wide. The
// recipient is config-trusted (not scope-checked). Mirrors sendComplianceNudge's
// targetInScope shape applied to the agent the notice is ABOUT.
function agentInScope(actorRole, caller, agent) {
  if (actorRole === 'sales_manager' || actorRole === 'tenant_admin') return true;
  if (actorRole === 'branch_manager') {
    return agent.branchId != null && agent.branchId === caller.branchId;
  }
  return false;
}

// Format a ratio (0.14) as a whole-percent string ("14%") for copy. Non-finite
// → "" so a bad payload never throws or prints "NaN%".
function pctLabel(ratio) {
  const n = parseFloat(ratio);
  if (!Number.isFinite(n)) return '';
  return `${Math.round(n * 100)}%`;
}

exports.notifyFinancingAdjustment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const actorRole   = context.auth.token.role;
  const actorUid    = context.auth.uid;
  const actorTenant = context.auth.token.tenantId;

  if (!NOTIFY_ACTOR_ROLES.has(actorRole)) {
    throw new functions.https.HttpsError(
      'permission-denied', `${actorRole} cannot send financing-adjustment notices.`
    );
  }
  if (!actorTenant) {
    throw new functions.https.HttpsError('failed-precondition', 'Caller has no tenant on file.');
  }

  // ── Validate input ──────────────────────────────────────────────────────────
  const agentId = data?.agentId;
  const month   = data?.month;
  const payload  = (data && typeof data.payload === 'object' && data.payload) ? data.payload : {};

  if (typeof agentId !== 'string' || agentId.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'agentId must be a non-empty string.');
  }
  if (!MONTH_KEY_RE.test(month ?? '')) {
    throw new functions.https.HttpsError('invalid-argument', 'month must be a YYYY_MM key.');
  }

  const db = admin.firestore();

  // ── Resolve caller (scope basis + firing-manager name for copy) ──────────────
  const callerSnap = await db.doc(`tenants/${actorTenant}/users/${actorUid}`).get();
  if (!callerSnap.exists) {
    throw new functions.https.HttpsError('failed-precondition', 'Caller profile not found.');
  }
  const caller = callerSnap.data();
  const managerName = caller.name || 'A manager';

  // ── Resolve + scope-validate the SUBJECT agent ───────────────────────────────
  const agentSnap = await db.doc(`tenants/${actorTenant}/users/${agentId}`).get();
  if (!agentSnap.exists) {
    throw new functions.https.HttpsError('not-found', `Agent ${agentId} does not exist in this tenant.`);
  }
  const agent = agentSnap.data();
  if (!agentInScope(actorRole, caller, agent)) {
    throw new functions.https.HttpsError('permission-denied', `Agent ${agentId} is outside your scope.`);
  }
  const agentName = agent.name || payload.agentName || 'the agent';

  // ── Resolve the configured recipient SERVER-SIDE (config-driven) ─────────────
  const cfgSnap = await db.doc(`tenants/${actorTenant}/config/financingConfig`).get();
  const recipientUid = cfgSnap.exists ? cfgSnap.data().notifyRecipientUid : null;
  if (!recipientUid) {
    // Tolerated absence — the UI renders "no recipient configured". Not an error.
    return { success: false, reason: 'no-recipient' };
  }

  const recipientSnap = await db.doc(`tenants/${actorTenant}/users/${recipientUid}`).get();
  if (!recipientSnap.exists) {
    return { success: false, reason: 'recipient-not-found', recipientUid };
  }
  const recipient = recipientSnap.data();
  const recipientEmail = recipient.email || null;
  const recipientName = recipient.name || 'Sales Admin';

  // ── Copy ─────────────────────────────────────────────────────────────────────
  const monthLabel = typeof payload.monthLabel === 'string' && payload.monthLabel ? payload.monthLabel : month;
  const adjLabel = pctLabel(payload.adjustmentPct);
  const adjClause = adjLabel ? `${adjLabel} ` : '';
  const notifTitle = 'Financing adjustment notice (clause 5.3)';
  const notifBody =
    `${managerName} flagged a ${adjClause}downward financing adjustment for ${agentName} (${monthLabel}) — ` +
    `past the 10% threshold. Clause 5.3 notification, not a termination.`;

  // ── Write transport artifacts (a + b + c) in one atomic batch ────────────────
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();

  const notifRef = db.collection(`tenants/${actorTenant}/notifications`).doc();
  batch.set(notifRef, {
    userId: recipientUid,
    tenantId: actorTenant,
    type: NOTIFY_TYPE,
    title: notifTitle,
    body: notifBody,
    link: null,
    read: false,
    createdAt: ts,
  });

  const auditRef = db.collection(`tenants/${actorTenant}/auditNudges`).doc();
  batch.set(auditRef, {
    actorUid,
    actorRole,
    type: NOTIFY_TYPE,
    agentId,
    recipientUid,
    month,
    adjustmentPct: Number.isFinite(parseFloat(payload.adjustmentPct)) ? parseFloat(payload.adjustmentPct) : null,
    at: ts,
  });

  // Deterministic cooldown/dedupe id — agentId first so the nudges rule's
  // split('_')[0] === agentId (Firebase uids carry no underscore; the type uses
  // dots; month's underscore is after the type).
  const cooldownRef = db.doc(`tenants/${actorTenant}/nudges/${agentId}_${NOTIFY_TYPE}_${month}`);
  batch.set(cooldownRef, {
    type: NOTIFY_TYPE,
    audienceUid: agentId,
    payload: { month, monthLabel, recipientUid, managerName, adjustmentPct: payload.adjustmentPct ?? null },
    createdBy: actorUid,
    createdAt: ts,
  }, { merge: true });

  await batch.commit();

  // ── Queue the email (d) — NON-FATAL ──────────────────────────────────────────
  let emailQueued = true;
  let emailError;
  if (!recipientEmail) {
    emailQueued = false;
    emailError = 'no email on file';
  } else {
    try {
      await db.collection('mail').add(
        buildMailDoc(
          recipientEmail,
          'Financing adjustment notice — clause 5.3',
          'financing-adjustment-notify.txt',
          'financing-adjustment-notify.html',
          {
            recipientName,
            managerName,
            agentName,
            monthLabel,
            adjustmentPct: adjLabel,
            appUrl: APP_URL,
            contactEmail: CONTACT_EMAIL,
          }
        )
      );
    } catch (mailErr) {
      console.warn(`[notifyFinancingAdjustment] mail/ write failed (non-fatal):`, mailErr.message);
      emailQueued = false;
      emailError = mailErr.message ?? String(mailErr);
    }
  }

  console.log(
    `[notifyFinancingAdjustment] ${actorRole} ${actorUid} notified ${recipientUid} ` +
    `re agent=${agentId} month=${month}`
  );

  const result = { success: true, recipientUid, agentId, month, emailQueued };
  if (emailError) result.emailError = emailError;
  return result;
});

// Exported for unit tests (handler reachable via the onCall ._onCall shim).
exports._internals = { agentInScope, pctLabel, NOTIFY_ACTOR_ROLES, NOTIFY_TYPE };
