/**
 * applyPlan.js — commits a preview plan to the ledger.
 *
 * This mirrors `applyPlan()` in `scripts/ops/import-oipa-portfolio.mjs` (P2). The
 * two must agree, because the admin script's LIVE run and the agent's own import
 * write the same documents into the same collection.
 *
 * BATCH SIZING: 500 is Firestore's hard write limit per batch, and one policy
 * costs TWO writes — the document and its history document. Sizing the chunk on
 * DOCUMENTS instead of writes is how a 229-policy import silently fails at ~250.
 */

const admin = require('firebase-admin');

const MAX_WRITES = 450; // headroom under Firestore's 500

/**
 * Re-checks one operation against the caller before it is written.
 *
 * The plan was already built from a verified identity, so this can only fail if
 * the plan was tampered with or a bug crossed two agents' data. It is cheap, and
 * the thing it prevents — writing a policy under the wrong agent — is not
 * recoverable by reading the ledger afterwards, because the wrong doc looks
 * exactly like a right one.
 */
function opBelongsTo(op, { uid, agentNumber }) {
  if (op.kind === 'create') {
    return op.doc.agentId === uid && op.doc.servicingAgentNumber === agentNumber;
  }
  // An update only ever carries owned fields; `servicingAgentNumber` is present
  // only when it CHANGED, so an absent one is not a mismatch.
  return !op.changed.servicingAgentNumber || op.changed.servicingAgentNumber === agentNumber;
}

/**
 * @param {Object} db       admin.firestore()
 * @param {Object} plan     the plan from `buildImportPlan`
 * @param {Object} caller   `{ uid, tenantId, agentNumber }`
 * @param {string} importSource  the provenance tag for the history docs
 * @param {string} runId    the import run these writes belong to (P4d ruling 2).
 *        A CREATE gets `firstImportRunId` AND `lastImportRunId`; an UPDATE gets
 *        `lastImportRunId` only. `firstImportRunId` is the field undo deletes on,
 *        so an update moving it would make undo remove a policy a later import
 *        merely touched — which is the whole failure P4d exists to close.
 * @returns {Promise<{created: number, updated: number, refused: Array<string>}>}
 */
async function applyPlan(db, plan, caller, importSource, runId) {
  if (!runId) throw new Error('applyPlan: runId is required');
  const { FieldValue } = admin.firestore;
  const col = db.collection(`tenants/${caller.tenantId}/policies`);

  const ops = [
    ...plan.creates.map((c) => ({ kind: 'create', ...c })),
    ...plan.updates.map((u) => ({ kind: 'update', ...u })),
  ];

  const refused = [];
  let created = 0;
  let updated = 0;
  let batch = db.batch();
  let writes = 0;

  const flush = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const op of ops) {
    if (!opBelongsTo(op, caller)) { refused.push(op.policyNumber); continue; }
    if (writes + 2 > MAX_WRITES) await flush();

    if (op.kind === 'create') {
      const ref = col.doc();
      // `createdAt` arrives from the plan as the string '<serverTimestamp>' so the
      // dry run can show the true field set; the real value is stamped here.
      batch.set(ref, {
        ...op.doc,
        createdAt: FieldValue.serverTimestamp(),
        firstImportRunId: runId,
        lastImportRunId: runId,
      });
      batch.set(ref.collection('history').doc(), {
        ...op.history,
        source: importSource,
        runId,
        by: caller.uid,
        at: FieldValue.serverTimestamp(),
      });
      created += 1;
    } else {
      const ref = col.doc(op.id);
      // NOTE the absence of `firstImportRunId`. It is written once, at create,
      // and this is the only other place that could ever overwrite it.
      batch.update(ref, {
        ...op.changed,
        updatedAt: FieldValue.serverTimestamp(),
        lastImportRunId: runId,
      });
      batch.set(ref.collection('history').doc(), {
        ...op.history,
        source: importSource,
        runId,
        by: caller.uid,
        at: FieldValue.serverTimestamp(),
      });
      updated += 1;
    }
    writes += 2;
  }

  await flush();
  return { created, updated, refused };
}

module.exports = { applyPlan, opBelongsTo, MAX_WRITES };
