/**
 * rollback.js — finds and removes what an import put in the ledger.
 *
 * This is the P2 rollback path (`--rollback` in
 * `scripts/ops/import-oipa-portfolio.mjs`), narrowed to ONE import and moved
 * server-side so an agent can undo their own.
 *
 * WHAT "THE LAST IMPORT" MEANS HERE, AND WHY IT IS NOT JUST `exportDate`:
 * the brief says "by their most recent exportDate", and that is the right
 * CANDIDATE set — a policy the last import did not touch keeps the export date it
 * already had, because an unchanged policy is skipped and never written.
 *
 * But `exportDate` alone is NOT enough to decide what to DELETE. Measured on
 * `buildImportPlan` (17 Sep 2026): re-importing a newer export bumps `exportDate`
 * on EVERY existing policy even when no fact about the policy changed —
 * `changedKeys: ["exportDate","importedAt"]`. So "delete everything carrying the
 * latest export date" would, on the second import, delete the whole book and
 * present that to the agent as "undo last import". Nothing would error.
 *
 * So the candidate set is narrowed by `exportDate` and the VERDICT comes from the
 * history subcollection, which records `action: 'create'` or `action: 'update'`
 * per policy per import. Only the CREATES are removable: an update overwrote
 * values that were never stored anywhere, so there is nothing to put back.
 * (Dispatcher ruling, 18 Sep 2026.)
 */

const MAX_WRITES = 450; // headroom under Firestore's hard limit of 500 per batch

/**
 * Every imported policy this agent owns.
 *
 * BOTH conditions are required and neither is optional:
 *   importSource == 'oipa_import'  — never touch an organically logged policy
 *   agentId      == this agent     — never touch another agent's book
 *
 * The `agentId` equality is the one that matters most: `importSource` alone would
 * match every agent's import across the tenant. Both are applied as `where`
 * clauses AND re-checked in memory before anything is deleted, because a missing
 * composite index can change what a compound query returns but cannot change what
 * the documents actually say.
 */
async function findImportedDocs(db, tenantId, agentId, importSource) {
  const snap = await db
    .collection(`tenants/${tenantId}/policies`)
    .where('agentId', '==', agentId)
    .where('importSource', '==', importSource)
    .get();

  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const safe = all.filter((d) => d.importSource === importSource && d.agentId === agentId);
  return { docs: safe, rejected: all.length - safe.length };
}

/**
 * Splits the latest export's policies into the ones that import CREATED and the
 * ones it merely UPDATED.
 *
 * @returns {Promise<{exportDate, created, updated, totalImported, rejected}>}
 *   `created` and `updated` are arrays of `{ id, policyNumber }`.
 *   `exportDate` is null when this agent has no imported policies at all.
 */
async function findLastImportBatch(db, tenantId, agentId, importSource) {
  const { docs, rejected } = await findImportedDocs(db, tenantId, agentId, importSource);
  if (docs.length === 0) {
    return { exportDate: null, created: [], updated: [], totalImported: 0, rejected };
  }

  // Lexical max is the true max: export dates are `YYYY-MM-DD`, which sorts
  // chronologically as text. This would silently pick the wrong batch for any
  // other date format, which is why the parser emits only this one.
  const exportDate = docs
    .map((d) => d.exportDate)
    .filter((v) => typeof v === 'string' && v !== '')
    .sort()
    .pop() ?? null;

  if (!exportDate) {
    return { exportDate: null, created: [], updated: [], totalImported: docs.length, rejected };
  }

  const candidates = docs.filter((d) => d.exportDate === exportDate);

  const created = [];
  const updated = [];
  for (const doc of candidates) {
    const hist = await db
      .collection(`tenants/${tenantId}/policies/${doc.id}/history`)
      .where('exportDate', '==', exportDate)
      .get();
    const actions = hist.docs.map((h) => h.data().action);
    // A policy whose history carries a `create` at this export date was put in the
    // ledger BY an import of this export, so removing it restores the state before
    // that import. Anything else at this export date was pre-existing.
    if (actions.includes('create')) created.push({ id: doc.id, policyNumber: doc.policyNumber });
    else updated.push({ id: doc.id, policyNumber: doc.policyNumber });
  }

  return { exportDate, created, updated, totalImported: docs.length, rejected };
}

/**
 * Deletes the given policies and their history subcollections.
 *
 * History subdocs are deleted in the SAME batch as their parent. Firestore does
 * not cascade: a parent deleted without its subcollection leaves history that no
 * query will ever reach again and that nothing will ever report. The subcollection
 * simply survives its parent, silently.
 *
 * @returns {Promise<{deleted, historyDeleted}>}
 */
async function deletePolicies(db, tenantId, docs) {
  let batch = db.batch();
  let writes = 0;
  let deleted = 0;
  let historyDeleted = 0;

  const flush = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const d of docs) {
    const ref = db.doc(`tenants/${tenantId}/policies/${d.id}`);
    const hist = await ref.collection('history').get();
    // +1 for the parent; the history docs are counted individually. Sizing the
    // chunk on DOCUMENTS rather than writes is how a 229-policy undo silently
    // exceeds the batch limit partway through.
    if (writes + hist.size + 1 > MAX_WRITES) await flush();
    for (const h of hist.docs) { batch.delete(h.ref); writes += 1; historyDeleted += 1; }
    batch.delete(ref);
    writes += 1;
    deleted += 1;
  }

  await flush();
  return { deleted, historyDeleted };
}

/**
 * Counts history documents still reachable under policy ids that were just deleted.
 *
 * This is measured AFTER the delete, against ids captured BEFORE it — never
 * inferred from the delete's own counters, which can only report what the code
 * believed it was doing. Firestore's lack of cascade means the only honest way to
 * claim "0 orphans" is to go and look.
 *
 * @param {Array<{id: string}>} deletedDocs  ids captured before the delete
 */
async function countOrphanedHistory(db, tenantId, deletedDocs) {
  let orphaned = 0;
  const orphanedUnder = [];
  for (const d of deletedDocs) {
    const hist = await db.collection(`tenants/${tenantId}/policies/${d.id}/history`).get();
    if (hist.size > 0) {
      orphaned += hist.size;
      orphanedUnder.push({ id: d.id, policyNumber: d.policyNumber ?? null, count: hist.size });
    }
  }
  return { orphaned, orphanedUnder };
}

/**
 * The same question as `findLastImportBatch`, answered from the RUN RECORD
 * instead of from each policy's history (P4d ruling 4).
 *
 * This is the path every run written from P4d onwards takes. It is exact rather
 * than reconstructed: `firstImportRunId` says which run CREATED a policy and
 * `lastImportRunId` says which run last wrote it, so "created by this run" and
 * "updated by this run" are both a field comparison instead of a subcollection
 * read per candidate.
 *
 * WHY THE RUN ID IS FILTERED IN MEMORY AND NOT IN THE QUERY:
 * the `agentId` + `importSource` pair is the query this codebase has already
 * proven against production without a declared composite index. Adding a third
 * equality changes the index requirement, and an index gap fails as an ERROR on
 * a destructive endpoint. The candidate set is one agent's imported book, so the
 * read volume is identical either way.
 *
 * @returns {Promise<{runId, run, created, updated, totalImported, rejected}>}
 */
async function findRunBatch(db, tenantId, agentId, importSource, run) {
  const { docs, rejected } = await findImportedDocs(db, tenantId, agentId, importSource);
  const created = [];
  const updated = [];
  for (const doc of docs) {
    if (doc.firstImportRunId === run.runId) {
      created.push({ id: doc.id, policyNumber: doc.policyNumber });
    } else if (doc.lastImportRunId === run.runId) {
      updated.push({ id: doc.id, policyNumber: doc.policyNumber });
    }
  }
  return {
    runId: run.runId,
    run,
    exportDate: run.exportDate ?? null,
    created,
    updated,
    totalImported: docs.length,
    rejected,
  };
}

module.exports = {
  findImportedDocs,
  findLastImportBatch,
  findRunBatch,
  deletePolicies,
  countOrphanedHistory,
  MAX_WRITES,
};
