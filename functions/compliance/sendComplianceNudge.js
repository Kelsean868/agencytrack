'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Compliance v2 Slice 2 — sendComplianceNudge callable CF
//
// A manager (UM / BM / SM / TA) nudges one or more agents who have not filed
// their weekly report. One invocation serves both single-Nudge and Nudge-all
// (the UI passes the filtered exception-list uids).
//
// Per target the CF writes FOUR artifacts via the Admin SDK (rules bypass):
//   (a) tenants/{tid}/nudges/{audienceUid}_{type}_{weekStart}  — SET-MERGE.
//       The dedupe / cooldown RECORD. Re-nudge refreshes createdAt (structural
//       dedupe — deterministic ID, never a second doc). Powers the manager
//       cooldown chip via a deterministic-ID upline GET (index-free).
//   (b) tenants/{tid}/notifications/{autoId}  — the EXISTING notification
//       schema ({userId, tenantId, type, title, body, link, read, createdAt}).
//       The agent sees the nudge in the existing bell today. Auto-id, so a
//       re-nudge produces a fresh bell entry (deliberate second contact).
//   (c) a mail/ doc via buildMailDoc — email is REQUIRED here because the
//       audience is, by definition, agents NOT in the app this week.
//   (d) tenants/{tid}/auditNudges/{autoId}  — Admin-only audit append
//       (tenant-scoped per the brief, even though auditInviteResends is
//       top-level; the brief is authority).
//
// (a), (b), (d) are written in ONE batch (atomic). (c) is added separately —
// email failures are NON-FATAL to the notification write (the resendInviteEmail
// emailQueued precedent).
//
// Scope: actor role gate (NUDGE_ACTOR_ROLES); every audienceUid must resolve to
// a user doc in the caller's scope (UM → same unitId, BM → same branchId,
// SM/TA → tenant-wide). Scope is a hard, all-or-nothing precondition — if ANY
// target is out of scope or missing, the whole call is rejected before any
// write. Mirrors the resendInviteEmail tenant-scoping shape.
// ─────────────────────────────────────────────────────────────────────────────

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { buildMailDoc } = require('../utils/email');

const NUDGE_ACTOR_ROLES = new Set([
  'unit_manager',
  'branch_manager',
  'sales_manager',
  'tenant_admin',
]);

// Per-type config: drives the payload lens, the bell notification copy, the
// email subject + template pair. The allowlist is exactly the config keys —
// S2 shipped 'compliance.filing.nudge'; S3 adds 'compliance.plan.nudge'.
const NUDGE_CONFIG = {
  'compliance.filing.nudge': {
    lens: 'filing',
    notifTitle: 'Weekly report reminder',
    notifBody: (managerName, weekStart) =>
      `${managerName} sent a reminder to submit your weekly report for the week of ${weekStart}.`,
    emailSubject: 'A reminder to submit your weekly report',
    txt: 'compliance-nudge.txt',
    html: 'compliance-nudge.html',
  },
  'compliance.plan.nudge': {
    lens: 'plan',
    notifTitle: 'Weekly plan reminder',
    notifBody: (managerName, weekStart) =>
      `${managerName} sent a reminder to commit your weekly plan for the week of ${weekStart}.`,
    emailSubject: 'A reminder to commit your weekly plan',
    txt: 'compliance-plan-nudge.txt',
    html: 'compliance-plan-nudge.html',
  },
};
const NUDGE_TYPES = new Set(Object.keys(NUDGE_CONFIG));

const MAX_AUDIENCE = 50;

// Validate a YYYY-MM-DD string that must represent a Sunday (week-starting).
// Noon-UTC construction avoids any TZ/offset rollover; the ISO round-trip
// rejects impossible dates (e.g. 2026-02-30 normalizing to March).
function isValidSundayString(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  if (d.toISOString().slice(0, 10) !== s) return false;
  return d.getUTCDay() === 0;
}

// Is `target` within `actorRole`'s scope, given the caller's own user doc?
// Tenant is already implicit (every doc is read under the caller's tenant path).
function targetInScope(actorRole, caller, target) {
  if (actorRole === 'sales_manager' || actorRole === 'tenant_admin') return true;
  if (actorRole === 'unit_manager') {
    return target.unitId != null && target.unitId === caller.unitId;
  }
  if (actorRole === 'branch_manager') {
    return target.branchId != null && target.branchId === caller.branchId;
  }
  return false;
}

exports.sendComplianceNudge = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
  }

  const actorRole   = context.auth.token.role;
  const actorUid    = context.auth.uid;
  const actorTenant = context.auth.token.tenantId;

  if (!NUDGE_ACTOR_ROLES.has(actorRole)) {
    throw new functions.https.HttpsError(
      'permission-denied', `${actorRole} cannot send compliance nudges.`
    );
  }
  if (!actorTenant) {
    throw new functions.https.HttpsError(
      'failed-precondition', 'Caller has no tenant on file.'
    );
  }

  // ── Validate input ──────────────────────────────────────────────────────────
  const audienceUids = data?.audienceUids;
  const type         = data?.type;
  const weekStart    = data?.weekStart;

  if (!Array.isArray(audienceUids) || audienceUids.length < 1 || audienceUids.length > MAX_AUDIENCE) {
    throw new functions.https.HttpsError(
      'invalid-argument', `audienceUids must be a non-empty array of at most ${MAX_AUDIENCE} ids.`
    );
  }
  if (!audienceUids.every((u) => typeof u === 'string' && u.length > 0)) {
    throw new functions.https.HttpsError('invalid-argument', 'audienceUids must all be non-empty strings.');
  }
  // Reject duplicate ids — a duplicate would double-write the same agent.
  if (new Set(audienceUids).size !== audienceUids.length) {
    throw new functions.https.HttpsError('invalid-argument', 'audienceUids must not contain duplicates.');
  }
  if (!NUDGE_TYPES.has(type)) {
    throw new functions.https.HttpsError('invalid-argument', `Unsupported nudge type: ${type}.`);
  }
  if (!isValidSundayString(weekStart)) {
    throw new functions.https.HttpsError('invalid-argument', 'weekStart must be a YYYY-MM-DD Sunday.');
  }

  const db = admin.firestore();

  // ── Resolve caller (scope basis + managerName for the payload/email) ─────────
  const callerSnap = await db.doc(`tenants/${actorTenant}/users/${actorUid}`).get();
  if (!callerSnap.exists) {
    throw new functions.https.HttpsError('failed-precondition', 'Caller profile not found.');
  }
  const caller = callerSnap.data();
  const managerName = caller.name || 'Your manager';

  // ── Resolve + scope-validate ALL targets (all-or-nothing precondition) ───────
  const targets = [];
  for (const uid of audienceUids) {
    const snap = await db.doc(`tenants/${actorTenant}/users/${uid}`).get();
    if (!snap.exists) {
      throw new functions.https.HttpsError(
        'not-found', `Target ${uid} does not exist in this tenant.`
      );
    }
    const tdata = snap.data();
    if (!targetInScope(actorRole, caller, tdata)) {
      throw new functions.https.HttpsError(
        'permission-denied', `Target ${uid} is outside your scope.`
      );
    }
    targets.push({ uid, email: tdata.email || null, name: tdata.name || '' });
  }

  // ── Write notification artifacts (a + b + d) in one atomic batch ─────────────
  const cfg = NUDGE_CONFIG[type]; // type already validated against the allowlist
  const ts = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  for (const t of targets) {
    const nudgeRef = db.doc(`tenants/${actorTenant}/nudges/${t.uid}_${type}_${weekStart}`);
    batch.set(nudgeRef, {
      type,
      audienceUid: t.uid,
      payload: { weekStart, lens: cfg.lens, managerName },
      createdBy: actorUid,
      createdAt: ts,
      readAt: null,
    }, { merge: true });

    const notifRef = db.collection(`tenants/${actorTenant}/notifications`).doc();
    batch.set(notifRef, {
      userId: t.uid,
      tenantId: actorTenant,
      type,
      title: cfg.notifTitle,
      body: cfg.notifBody(managerName, weekStart),
      link: null,
      read: false,
      createdAt: ts,
    });

    const auditRef = db.collection(`tenants/${actorTenant}/auditNudges`).doc();
    batch.set(auditRef, {
      actorUid,
      actorRole,
      audienceUid: t.uid,
      type,
      weekStart,
      at: ts,
    });
  }
  await batch.commit();

  // ── Queue emails (c) — per-target, NON-FATAL ────────────────────────────────
  const results = [];
  for (const t of targets) {
    let emailQueued = true;
    let emailError;
    if (!t.email) {
      emailQueued = false;
      emailError = 'no email on file';
    } else {
      try {
        await db.collection('mail').add(
          buildMailDoc(
            t.email,
            cfg.emailSubject,
            cfg.txt,
            cfg.html,
            { userName: t.name, managerName, weekStarting: weekStart }
          )
        );
      } catch (mailErr) {
        console.warn(`[sendComplianceNudge] mail/ write failed for ${t.uid} (non-fatal):`, mailErr.message);
        emailQueued = false;
        emailError = mailErr.message ?? String(mailErr);
      }
    }
    const r = { audienceUid: t.uid, notified: true, emailQueued };
    if (emailError) r.emailError = emailError;
    results.push(r);
  }

  console.log(
    `[sendComplianceNudge] ${actorRole} ${actorUid} nudged ${targets.length} agent(s) ` +
    `for ${type} weekStart=${weekStart}`
  );

  return { success: true, type, weekStart, count: targets.length, results };
});

// Exported for unit tests (handler is also reachable via the onCall ._onCall shim).
exports._internals = { isValidSundayString, targetInScope, NUDGE_ACTOR_ROLES, NUDGE_TYPES, MAX_AUDIENCE };
