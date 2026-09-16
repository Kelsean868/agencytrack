/**
 * excludeImported.js — the one place that decides whether a policy doc came from
 * the OIPA portfolio import, and the one helper that filters those docs out.
 *
 * PURE. No Firestore, no clock.
 *
 * WHY THIS FILTER IS CLIENT-SIDE AND NOT A FIRESTORE `where`:
 * the obvious query is `where('importSource', '!=', 'oipa_import')`. It is WRONG,
 * and wrong in the silent direction. A Firestore inequality matches only documents
 * that HAVE the field, so `!=` would drop every policy written before the import
 * existed — which is every organic policy in the ledger. The query would return
 * the imported docs and nothing else: the exact inverse of the intent, with no
 * error. `orderBy` has the same trap (it excludes docs missing the ordered field),
 * which is why the importer writes `createdAt` at all.
 *
 * So the read stays as it was and the filter happens in memory, after the fetch.
 * The cost is reading documents we then discard; the benefit is a filter that
 * cannot invert itself.
 *
 * WHY ONE HELPER AND NOT A PREDICATE AT EACH CALL SITE:
 * there are eight call sites. A hand-rolled `d.importSource !== 'oipa_import'` at
 * each is eight chances to typo the tag, and a typo here does not fail — it
 * silently lets 229 historical policies into a production total. The tag itself
 * comes from `OIPA_IMPORT_SOURCE`, so the string is never written twice.
 *
 * WHAT MUST NOT USE THIS:
 *   • the policy LEDGER list — the imported docs are the point of the ledger
 *   • `deriveFromLedger` (persistency) — imported docs are its entire input
 * Both are deliberate exceptions (dispatcher ruling 5e).
 */

import { OIPA_IMPORT_SOURCE } from './oipaImportConfig.js';

/**
 * True when this doc was created by the portfolio importer.
 *
 * Checks for EQUALITY with the tag rather than for the field's presence: a future
 * importer with a different `importSource` is a different question, and should not
 * be silently swept up by a filter written for OIPA.
 */
export function isImportedPolicy(doc) {
  return doc?.importSource === OIPA_IMPORT_SOURCE;
}

/**
 * The organic policies — everything the agent actually logged in AgencyTrack.
 *
 * Returns a NEW array and never mutates the input. A non-array input returns an
 * empty array rather than throwing, because every caller here passes the result
 * of a fetch that may not have resolved yet.
 */
export function excludeImported(docs) {
  if (!Array.isArray(docs)) return [];
  return docs.filter((d) => !isImportedPolicy(d));
}

/**
 * Both halves, when a surface needs to show the split rather than hide one side
 * (the persistency drawer and the import report both want this).
 *
 * The two arrays are disjoint and together account for every input doc, which is
 * the property that makes "evidenced vs declared" showable rather than guessable.
 */
export function partitionImported(docs) {
  const list = Array.isArray(docs) ? docs : [];
  const imported = [];
  const organic = [];
  for (const d of list) {
    if (isImportedPolicy(d)) imported.push(d);
    else organic.push(d);
  }
  return { imported, organic };
}

/** Count only, for a report line that does not need the docs themselves. */
export function countImported(docs) {
  if (!Array.isArray(docs)) return 0;
  let n = 0;
  for (const d of docs) if (isImportedPolicy(d)) n++;
  return n;
}
