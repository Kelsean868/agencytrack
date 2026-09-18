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

  const { created, updated, refused } = await applyPlan(
    db, plan, caller, lib.OIPA_IMPORT_SOURCE,
  );

  // Marked applied AFTER the writes commit. Marking first would leave a crashed
  // run looking done, and the agent with no way to finish it.
  await markApplied(ref, { created, updated, refused: refused.length });

  if (refused.length > 0) {
    // Nothing to roll back — a refused op was never written. Surfaced loudly
    // because it can only mean the plan and the caller disagree about identity.
    functions.logger.error('applyImport refused ops', {
      uid: caller.uid, planId: ref.id, refused,
    });
  }

  return {
    planId: ref.id,
    exportDate: meta.exportDate,
    created,
    updated,
    unchanged: plan.report.skips,
    refused: refused.length,
    refusedPolicyNumbers: refused,
    planClassPending: parseReport.planClassPending,
    overridesApplied: parseReport.overridesApplied,
  };
}

exports.applyPortfolioImport = functions.runWith(RUNTIME).https.onCall(handler);
exports.__handler = handler;
