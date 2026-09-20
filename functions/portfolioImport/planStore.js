/**
 * planStore.js — parks a preview plan until the agent confirms it.
 *
 * RULING 3: `previewImport` returns the plan and writes NOTHING to the ledger;
 * `applyImport(planId)` writes THAT EXACT PLAN. Plans expire after 15 minutes.
 *
 * WHY THE PLAN IS STORED SERVER-SIDE AND NOT ROUND-TRIPPED THROUGH THE BROWSER:
 * a plan that comes back from the client is a plan the client can edit. Sending
 * 229 policy documents out and accepting them back would make "apply" a
 * write-anything endpoint wearing a preview's clothes. The browser gets a summary
 * and an opaque id; the bytes that get written never leave the server.
 *
 * WHERE IT LIVES, AND WHY THAT PATH:
 *   tenants/{tenantId}/users/{uid}/importPlans/{planId}
 * That path has NO block in `firestore.rules`, and Firestore denies anything a
 * rule does not explicitly allow. So the browser cannot read or write it at all,
 * which is exactly right, and it needs no rules change (dispatcher ruling, 17 Sep
 * 2026). The Admin SDK bypasses rules, so the functions still reach it.
 */

const functions = require('firebase-functions/v1');

/** Ruling 3. A plan older than this is refused and must be re-previewed. */
const PLAN_TTL_MS = 15 * 60 * 1000;

/**
 * Hard ceiling on the stored plan. A Firestore document may not exceed 1 MiB, and
 * exceeding it fails the WRITE — which would surface to the agent as "preview
 * failed" with no reason. 229 policies measure roughly 90 KB, so this is a guard,
 * not a working limit; it exists so the failure names itself.
 */
const MAX_PLAN_BYTES = 800 * 1024;

const collection = (db, tenantId, uid) => db.collection(`tenants/${tenantId}/users/${uid}/importPlans`);

/**
 * Writes the plan and returns its id.
 *
 * The whole plan is stored as ONE JSON string rather than as nested Firestore
 * maps. Firestore rejects a document nested more than 20 levels deep and silently
 * reorders map keys; neither matters to a string, and the plan is only ever read
 * back whole by the same code that wrote it.
 */
async function savePlan(db, { tenantId, uid, plan, parseReport, exportDate, agentNumber, fileName }) {
  const payload = JSON.stringify({ plan, parseReport });
  const bytes = Buffer.byteLength(payload, 'utf8');
  if (bytes > MAX_PLAN_BYTES) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `That file produces a plan of ${(bytes / 1024).toFixed(0)} KB, over the ${MAX_PLAN_BYTES / 1024} KB limit. Split the export and import it in parts.`,
    );
  }

  const ref = collection(db, tenantId, uid).doc();
  await ref.set({
    ownerUid: uid,          // re-checked on apply; the path alone is not the proof
    tenantId,
    agentNumber,
    exportDate,
    fileName: fileName ?? null,
    payload,
    createdAtMs: Date.now(), // a plain number: the TTL is compared in the function,
    createdAt: new Date(),   // and a server timestamp is not readable in the same write
    appliedAt: null,
    counts: {
      creates: plan.report.creates,
      updates: plan.report.updates,
      unchanged: plan.report.skips,
    },
  });
  return ref.id;
}

/**
 * Reads a plan back and refuses it unless it is this caller's, unexpired and
 * unapplied.
 *
 * All three checks are separate refusals with their own message, because they mean
 * different things to the person on the screen: a wrong owner is a bug or an
 * attack, an expired plan means "press preview again", and an already-applied plan
 * means the write already happened and pressing again must not double it.
 */
async function loadPlan(db, { tenantId, uid, planId, agentNumber, now = Date.now() }) {
  if (typeof planId !== 'string' || planId.trim() === '') {
    throw new functions.https.HttpsError('invalid-argument', 'planId is required.');
  }

  const ref = collection(db, tenantId, uid).doc(planId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'That import plan was not found. Review the file again.',
    );
  }

  const d = snap.data();
  if (d.ownerUid !== uid || d.tenantId !== tenantId) {
    throw new functions.https.HttpsError('permission-denied', 'That import plan is not yours.');
  }
  // The plan was built against the agent number in force at preview time. If the
  // profile's number changed since, every `isWritingAgent` and every
  // servicing-match in the plan was decided on a stale fact.
  if (d.agentNumber !== agentNumber) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Your agent number changed since you reviewed this file. Review it again.',
    );
  }
  if (d.appliedAt) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'That import has already been done. Review the file again to import it a second time.',
    );
  }
  if (now - (d.createdAtMs ?? 0) > PLAN_TTL_MS) {
    throw new functions.https.HttpsError(
      'deadline-exceeded',
      'That review expired after 15 minutes. Review the file again.',
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(d.payload);
  } catch {
    throw new functions.https.HttpsError('internal', 'That import plan could not be read. Review the file again.');
  }

  return { ref, meta: d, plan: parsed.plan, parseReport: parsed.parseReport };
}

/** Marks a plan applied. Called AFTER the ledger writes commit, never before. */
async function markApplied(ref, written) {
  await ref.update({ appliedAt: new Date(), written });
}

/**
 * Clears this agent's earlier plans. Called at the start of every preview so a
 * stale plan cannot be applied later, and so the subcollection does not grow one
 * document per preview forever. Keeps `keepId` (the one just written).
 */
async function purgeOldPlans(db, { tenantId, uid, keepId = null }) {
  const snap = await collection(db, tenantId, uid).get();
  const stale = snap.docs.filter((d) => d.id !== keepId);
  if (stale.length === 0) return 0;
  const batch = db.batch();
  stale.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return stale.length;
}

module.exports = { savePlan, loadPlan, markApplied, purgeOldPlans, PLAN_TTL_MS, MAX_PLAN_BYTES };
