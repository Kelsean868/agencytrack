/**
 * applyImport.js — writes the plan the agent just reviewed, and only that plan.
 *
 * RULING 3, second half: `applyImport(planId)` writes THAT EXACT PLAN. The plan
 * comes back off the server, not out of the request, so there is nothing in the
 * payload for a caller to change except which of their own plans to apply.
 *
 * RULING 19 note: this is not a deploy gate — an agent applying their own import
 * is ordinary product behaviour. What it is NOT allowed to do is write anything
 * the preview did not already show them.
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

const { loadPortfolioImport } = require('./loadPortfolioImport');
const { resolveCaller } = require('./identity');
const { loadPlan, markApplied } = require('./planStore');
const { applyPlan } = require('./applyPlan');
const { startRun, finishRun } = require('./importRuns');

const RUNTIME = { memory: '1GB', timeoutSeconds: 300 };

async function handler(data, context) {
  const db = admin.firestore();
  const caller = await resolveCaller(data, context, db);
  const lib = await loadPortfolioImport();

  const { ref, meta, plan, parseReport } = await loadPlan(db, {
    tenantId: caller.tenantId,
    uid: caller.uid,
    planId: data && data.planId,
    agentNumber: caller.agentNumber,
  });

  // The run doc opens BEFORE any policy is touched, so a run that crashes
  // halfway still has a record and its policies are still findable by undo.
  const { runId, ref: runRef } = await startRun(db, {
    tenantId: caller.tenantId,
    uid: caller.uid,
    agentId: caller.uid,
    exportDate: meta.exportDate,
    fileName: meta.fileName,
    planId: ref.id,
  });

  const written = await applyPlan(
    db, plan, caller, lib.OIPA_IMPORT_SOURCE, runId,
  );
  const { created, updated, refused } = written;

  // `created` and `updated` are the WRITER's tallies. `plan.report.creates` is
  // what the importer meant to do, and a refused operation is exactly the case
  // where the two disagree — so the run record never quotes the plan for these.
  const counts = await finishRun(runRef, {
    written,
    planCounts: {
      unchanged: plan.report.skips,
      skippedNotYours: parseReport.skippedNotYours ?? null,
      testRecords: parseReport.testRecords ?? null,
      planClassPending: Array.isArray(parseReport.planClassPending)
        ? parseReport.planClassPending.length : null,
    },
  });

  // Marked applied AFTER the writes commit. Marking first would leave a crashed
  // run looking done, and the agent with no way to finish it.
  await markApplied(ref, { created, updated, refused: refused.length, runId });

  if (refused.length > 0) {
    // Nothing to roll back — a refused op was never written. Surfaced loudly
    // because it can only mean the plan and the caller disagree about identity.
    functions.logger.error('applyImport refused ops', {
      uid: caller.uid, planId: ref.id, runId, refused,
    });
  }

  return {
    planId: ref.id,
    runId,
    exportDate: meta.exportDate,
    created,
    updated,
    unchanged: plan.report.skips,
    refused: refused.length,
    refusedPolicyNumbers: refused,
    counts,
    planClassPending: parseReport.planClassPending,
    overridesApplied: parseReport.overridesApplied,
  };
}

exports.applyPortfolioImport = functions.runWith(RUNTIME).https.onCall(handler);
exports.__handler = handler;
