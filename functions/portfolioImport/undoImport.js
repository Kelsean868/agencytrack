/**
 * undoImport.js — "Undo last import", for the agent's own book only.
 *
 * P4b. Two modes on one callable, mirroring the preview/apply shape of P4a:
 *
 *   dryRun (the DEFAULT)  counts what would go, writes nothing. This is what the
 *                         confirmation dialog states.
 *   confirm: true         deletes, and the caller must echo back the `exportDate`
 *                         the dry run reported.
 *
 * WHY THE CALLER MUST ECHO `exportDate`:
 * the count the agent agreed to and the delete that follows are two separate
 * calls. If another import lands between them, the "last import" is no longer the
 * one on screen, and the dialog's number describes a batch that is no longer the
 * one being deleted. Echoing the date makes that disagreement a refusal instead
 * of a surprise — the same discipline as the P4a plan expiry.
 *
 * WHY THE DEFAULT IS A DRY RUN:
 * this endpoint deletes production policies. A caller who forgets a flag gets a
 * count. A destructive default would mean a forgotten flag empties a book.
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

const { loadPortfolioImport } = require('./loadPortfolioImport');
const { resolveCaller } = require('./identity');
const {
  findLastImportBatch, deletePolicies, countOrphanedHistory,
} = require('./rollback');

/** Reading every candidate's history is many small reads; give it room. */
const RUNTIME = { memory: '1GB', timeoutSeconds: 300 };

/** How many policy numbers travel back for display. The full count is always exact. */
const SAMPLE_SIZE = 25;

async function handler(data, context) {
  const db = admin.firestore();
  const caller = await resolveCaller(data, context, db);
  const lib = await loadPortfolioImport();

  const body = data && typeof data === 'object' ? data : {};
  const confirm = body.confirm === true;

  const batch = await findLastImportBatch(
    db, caller.tenantId, caller.uid, lib.OIPA_IMPORT_SOURCE,
  );

  if (batch.totalImported === 0) {
    throw new functions.https.HttpsError(
      'not-found',
      'You have no imported policies to undo.',
    );
  }

  const summary = {
    exportDate: batch.exportDate,
    found: batch.created.length,
    notRemovable: batch.updated.length,
    totalImported: batch.totalImported,
    policyNumbers: batch.created.slice(0, SAMPLE_SIZE).map((d) => d.policyNumber),
    policyNumbersTruncated: batch.created.length > SAMPLE_SIZE,
    notRemovablePolicyNumbers: batch.updated.slice(0, SAMPLE_SIZE).map((d) => d.policyNumber),
  };

  // An import that only UPDATED policies cannot be undone at all, and saying so is
  // the whole point: the previous values were never stored, by the importer or by
  // anything else, so there is no version of this operation that puts them back.
  // Deleting the creates and leaving the updates would land the ledger in a third
  // state that is neither before nor after the import.
  if (batch.created.length === 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `The ${batch.exportDate} import added no new policies — it only updated ${batch.updated.length} you already had. Those updates cannot be undone, because the values they replaced were never saved.`,
    );
  }
  if (batch.updated.length > 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `The ${batch.exportDate} import added ${batch.created.length} policies and updated ${batch.updated.length} you already had. Undo would remove the ${batch.created.length} new ones but cannot put the other ${batch.updated.length} back, which would leave your ledger in a state it has never been in. Remove the new policies one at a time instead.`,
    );
  }

  if (!confirm) {
    return { ...summary, dryRun: true, deleted: 0, historyDeleted: 0, orphanedHistory: 0 };
  }

  // The echoed date is checked AFTER the dry-run shape is computed, so a mismatch
  // reports the date that is actually current rather than only rejecting.
  if (body.exportDate !== batch.exportDate) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `Your last import is now the ${batch.exportDate} one, not the ${body.exportDate ?? 'unspecified'} one you confirmed. Check the count again.`,
    );
  }

  const { deleted, historyDeleted } = await deletePolicies(
    db, caller.tenantId, batch.created,
  );

  // Verified by LOOKING, against ids captured before the delete — never inferred
  // from the counters above. Firestore does not cascade, so a surviving history
  // subcollection is silent and permanently unreachable.
  const { orphaned, orphanedUnder } = await countOrphanedHistory(
    db, caller.tenantId, batch.created,
  );

  if (orphaned > 0) {
    functions.logger.error('undoImport left orphaned history', {
      uid: caller.uid, exportDate: batch.exportDate, orphaned, orphanedUnder,
    });
  }

  return {
    ...summary,
    dryRun: false,
    deleted,
    historyDeleted,
    orphanedHistory: orphaned,
    orphanedUnder,
  };
}

exports.undoLastPortfolioImport = functions.runWith(RUNTIME).https.onCall(handler);
exports.__handler = handler;
exports.SAMPLE_SIZE = SAMPLE_SIZE;
