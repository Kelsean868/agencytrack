/**
 * previewImport.js — reads an uploaded OIPA export and returns the PLAN. Writes
 * nothing to the ledger.
 *
 * RULING 1: the browser only sends the file. The parse happens here, on the
 * server, with a maintained reader — the app bundle never gains a spreadsheet
 * parser and never gains the import rules.
 *
 * RULING 3, first half: this call returns the plan — creates, updates, unchanged,
 * skipped-not-yours, test records, planClassPending — and writes NOTHING except
 * the parked plan itself, which lives in a path no browser can reach.
 */

const admin = require('firebase-admin');
const functions = require('firebase-functions');

const { loadPortfolioImport } = require('./loadPortfolioImport');
const { readWorkbook, MAX_FILE_BYTES } = require('./readWorkbook');
const { resolveCaller, partitionByServicingAgent } = require('./identity');
const { savePlan, purgeOldPlans } = require('./planStore');

/**
 * Parsing a 5 MB workbook and diffing it against a whole ledger does not fit the
 * 256 MB / 60 s default. 300 s matches the existing bulk-import callable.
 */
const RUNTIME = { memory: '1GB', timeoutSeconds: 300 };

/** Today in Trinidad (UTC−4, no DST), as `YYYY-MM-DD`. The caller never sets the clock. */
function todayTT() {
  return new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Decodes the base64 the browser sent.
 *
 * `Buffer.from(s, 'base64')` does NOT throw on invalid input — it silently returns
 * whatever prefix it could decode. So the result is checked against the magic
 * bytes in `readWorkbook` rather than trusted because the decode "worked".
 */
function decodeFile(fileBase64) {
  if (typeof fileBase64 !== 'string' || fileBase64 === '') {
    throw new functions.https.HttpsError('invalid-argument', 'No file was sent.');
  }
  // A data URL prefix is stripped so the caller may send either form.
  const b64 = fileBase64.includes(',') ? fileBase64.slice(fileBase64.indexOf(',') + 1) : fileBase64;
  // Base64 is 4 chars per 3 bytes; refuse an oversize payload before allocating it.
  if (b64.length > Math.ceil((MAX_FILE_BYTES / 3) * 4) + 1024) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'That file is over the 5 MB limit.',
    );
  }
  return Buffer.from(b64, 'base64');
}

/** Maps a reader failure onto a message the agent can act on. */
function readerError(err) {
  const code = err && err.code;
  if (code === 'too-large' || code === 'not-xlsx' || code === 'empty-workbook') {
    return new functions.https.HttpsError('invalid-argument', err.message);
  }
  return err;
}

async function handler(data, context) {
  const db = admin.firestore();
  const caller = await resolveCaller(data, context, db);

  const lib = await loadPortfolioImport();
  const buffer = decodeFile(data && data.fileBase64);

  let sheet;
  try {
    sheet = await readWorkbook(buffer);
  } catch (err) {
    throw readerError(err);
  }

  const exportDate = lib.parseExportDateFromTitle(sheet.titleCell);
  if (!exportDate) {
    // Guessing "today" here would stamp every policy with a date nobody verified,
    // and the persistency window is measured against it.
    throw new functions.https.HttpsError(
      'invalid-argument',
      'That file has no "as at" date in its title row, so there is no way to tell when it was produced. Export it again from OIPA.',
    );
  }

  const cfgSnap = await db
    .doc(`tenants/${caller.tenantId}/users/${caller.uid}/prefs/${lib.OIPA_IMPORT_CONFIG_PREF_ID}`)
    .get();
  const importConfig = lib.normaliseImportConfig(cfgSnap.exists ? cfgSnap.data() : null);

  const rows = lib.rowsFromSheetMatrix(sheet.matrix);
  const { docs: allDocs, report: parseReport } = lib.parseOipaExport(rows, {
    exportDate,
    agentId: caller.uid,
    agentNumber: caller.agentNumber,
    importedAt: todayTT(),
    importConfig,
  });

  // RULING 2: only the policies this agent services. Everything else is counted
  // and named, never written.
  const { mine, skippedNotYours, skippedNotYoursNumbers } =
    partitionByServicingAgent(allDocs, caller.agentNumber);

  if (mine.length === 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      `None of the ${allDocs.length} policies in that file are serviced by agent ${caller.agentNumber}. Check you exported your own portfolio.`,
    );
  }

  const existingSnap = await db
    .collection(`tenants/${caller.tenantId}/policies`)
    .where('agentId', '==', caller.uid)
    .get();
  const existingDocs = existingSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const plan = lib.buildImportPlan(mine, {
    tenantId: caller.tenantId,
    agentId: caller.uid,
    agentNumber: caller.agentNumber,
    exportDate,
    importedAt: todayTT(),
    unitId: caller.unitId,
    branchId: caller.branchId,
    createdBy: caller.uid,
    existingDocs,
  });

  if (!plan.report.accountedFor) {
    // The same assertion the admin script refuses on. A plan that cannot account
    // for every parsed policy has lost one, and a lost policy is invisible.
    throw new functions.https.HttpsError(
      'internal',
      'The plan did not account for every policy in the file. Nothing was changed.',
    );
  }

  // Older plans go BEFORE the new one is written, so a purge failure cannot delete
  // the plan the agent is about to apply.
  await purgeOldPlans(db, { tenantId: caller.tenantId, uid: caller.uid });

  const planId = await savePlan(db, {
    tenantId: caller.tenantId,
    uid: caller.uid,
    agentNumber: caller.agentNumber,
    exportDate,
    fileName: typeof data.fileName === 'string' ? data.fileName.slice(0, 200) : null,
    plan,
    // `skippedNotYours` is decided HERE, not by the parser — the parser has no
    // notion of who is calling. It is folded into the stored report so the run
    // record `applyImport` writes can state it without re-deriving it from a
    // file the browser would have to send twice. (P4d ruling 1.)
    parseReport: { ...parseReport, skippedNotYours, skippedNotYoursNumbers },
  });

  return {
    planId,
    exportDate,
    sheetName: sheet.sheetName,
    agentNumber: caller.agentNumber,
    counts: {
      rowsInFile: parseReport.rows,
      shadowRows: parseReport.shadows,
      testRecords: parseReport.testRecords,
      skippedNotYours,
      yours: mine.length,
      creates: plan.report.creates,
      updates: plan.report.updates,
      unchanged: plan.report.skips,
    },
    // The lists the review screen must show before anybody presses Import.
    planClassPending: parseReport.planClassPending,
    classUnconfirmed: parseReport.classUnconfirmed,
    overridesApplied: parseReport.overridesApplied,
    importConfigApplied: parseReport.importConfigApplied,
    testRecordNumbers: parseReport.testRecordNumbers,
    skippedNotYoursNumbers,
    unknownPlanPrefixes: parseReport.unknownPlanPrefixes,
    unmappedStatus: parseReport.unmappedStatus,
    orphanedInLedger: plan.report.orphanedInLedger,
    // P4e ruling 2 — named BEFORE anything is written, so the agent sees which
    // of their own status decisions head office is about to override and can
    // cancel instead.
    statusOverwrites: plan.report.statusOverwrites ?? [],
    statusCounts: parseReport.statusCounts,
    createPolicyNumbers: plan.creates.map((c) => c.policyNumber),
    updatePolicyNumbers: plan.updates.map((u) => u.policyNumber),
  };
}

exports.previewPortfolioImport = functions.runWith(RUNTIME).https.onCall(handler);
exports.__handler = handler; // unit tests call the handler directly
