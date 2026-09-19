/**
 * importRuns.js — one document per import run.
 *
 * P4d ruling 1. Before this, "which import wrote this policy" had no stored
 * answer: a preview plan got a `planId`, but nothing carried that id onto the
 * documents the plan wrote. Undo had to reconstruct the answer by reading every
 * candidate policy's history subcollection, and the counts an agent saw came from
 * the PLAN — what the importer intended to do — rather than from what it did.
 *
 * WHERE IT LIVES, AND WHY THAT PATH:
 *   tenants/{tenantId}/users/{uid}/importRuns/{runId}
 * The same reasoning as `importPlans`: that path has NO block in
 * `firestore.rules`, and Firestore denies anything a rule does not explicitly
 * allow. So no browser can read or write it, and it needs no rules change. The
 * Admin SDK bypasses rules, so the functions still reach it. P4c will read it
 * through a callable, not directly.
 *
 * THE RUN DOC IS WRITTEN TWICE, ON PURPOSE:
 * once BEFORE any policy is touched (`status: 'running'`), once after
 * (`status: 'complete'` plus the counts). Writing it only at the end would mean a
 * run that crashed halfway leaves policies stamped with a run id that has no run
 * document — invisible to undo, which is the one tool that could clean them up.
 * Writing it first costs one document and makes a half-finished run both
 * discoverable and undoable.
 */

const admin = require('firebase-admin');

const RUN_STATUS_RUNNING = 'running';
const RUN_STATUS_COMPLETE = 'complete';

const runsCollection = (db, tenantId, uid) =>
  db.collection(`tenants/${tenantId}/users/${uid}/importRuns`);

/**
 * Reserves a run id and records that the run started.
 *
 * @returns {Promise<{runId: string, ref: Object}>}
 */
async function startRun(db, { tenantId, uid, agentId, exportDate, fileName, planId }) {
  const { FieldValue } = admin.firestore;
  const ref = runsCollection(db, tenantId, uid).doc();
  await ref.set({
    runId: ref.id,
    agentId,
    tenantId,
    exportDate,
    fileName: fileName ?? null,
    planId: planId ?? null,
    status: RUN_STATUS_RUNNING,
    startedAt: FieldValue.serverTimestamp(),
    // `startedAtMs` is a plain number alongside the server timestamp because the
    // newest run has to be picked WITHOUT an orderBy — see `findLatestRun`.
    startedAtMs: Date.now(),
    finishedAt: null,
    counts: null,
  });
  return { runId: ref.id, ref };
}

/**
 * Records what the run actually did.
 *
 * `created` and `updated` are the writer's own tallies — the number of documents
 * it committed — never `plan.report.creates`. A plan says what the importer meant
 * to do; only the writer knows what it did, and a refused operation is the case
 * where those two disagree (P4d ruling 1).
 *
 * `unchanged`, `skippedNotYours`, `testRecords` and `planClassPending` describe
 * rows that by definition produced NO write, so no writer tally can exist for
 * them. They are carried from the stored plan and parse report, which live
 * server-side and never passed through the browser. The distinction is recorded
 * on the document itself as `countsSource` so a reader is never guessing which
 * kind of number they are looking at.
 */
async function finishRun(ref, { written, planCounts, statusOverwrites = [] }) {
  const { FieldValue } = admin.firestore;
  const counts = {
    created: written.created,
    updated: written.updated,
    refused: written.refused.length,
    unchanged: planCounts.unchanged,
    statusOverwrites: planCounts.statusOverwrites ?? 0,
    skippedNotYours: planCounts.skippedNotYours,
    testRecords: planCounts.testRecords,
    planClassPending: planCounts.planClassPending,
  };
  await ref.update({
    status: RUN_STATUS_COMPLETE,
    finishedAt: FieldValue.serverTimestamp(),
    finishedAtMs: Date.now(),
    counts,
    countsSource: {
      writer: ['created', 'updated', 'refused'],
      plan: ['unchanged', 'statusOverwrites', 'skippedNotYours', 'testRecords', 'planClassPending'],
    },
    ...(written.refused.length > 0 ? { refusedPolicyNumbers: written.refused } : {}),
    // P4e ruling 2 — which of the agent's own status decisions this import
    // overrode. Recorded on the run so it survives after the fact, not only on
    // the review screen the agent saw for a moment before pressing Import.
    statusOverwrites,
    statusOverwriteCount: statusOverwrites.length,
  });
  return counts;
}

const RUN_STATUS_UNDONE = 'undone';

/**
 * The newest run for this agent that has NOT already been undone, or null.
 *
 * Sorted in memory on `startedAtMs` rather than with `orderBy('startedAt')`.
 * Firestore EXCLUDES documents missing the ordered field, so an `orderBy` on the
 * server timestamp would silently drop any run whose first write had not yet
 * resolved its sentinel — returning "no runs" for an import that is happening
 * right now. An agent accumulates a handful of these, so reading them all costs
 * nothing and cannot lose one.
 *
 * AN UNDONE RUN IS SKIPPED, NOT DELETED. Its policies are already gone, so
 * offering it again would answer "0 to remove" for an import the agent has
 * finished with, and hide the run before it — which is the one they would
 * actually want next. The document stays as the record that the import happened
 * and was reversed.
 *
 * A run still `running` is NOT skipped: a crashed import leaves policies stamped
 * with its id, and undo is the only thing that can clear them.
 */
async function findLatestRun(db, tenantId, uid) {
  const snap = await runsCollection(db, tenantId, uid).get();
  if (snap.empty) return null;
  const runs = snap.docs
    .map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter((r) => r.status !== RUN_STATUS_UNDONE);
  if (runs.length === 0) return null;
  runs.sort((a, b) => (b.startedAtMs ?? 0) - (a.startedAtMs ?? 0));
  return runs[0];
}

module.exports = {
  startRun,
  finishRun,
  findLatestRun,
  runsCollection,
  RUN_STATUS_RUNNING,
  RUN_STATUS_COMPLETE,
  RUN_STATUS_UNDONE,
};
