#!/usr/bin/env node
/**
 * stamp-import-run.cjs — gives already-imported policies a run to belong to.
 *
 * P4d ruling 6. The 229 policies already in production were written before import
 * runs existed, so they carry no `firstImportRunId`. Undo still finds them
 * through the history fallback, but every count and every screen P4c builds on
 * the run record would report them as belonging to no import at all.
 *
 * This script writes ONE synthetic run document for a given export date and
 * stamps the matching policies with it. It is deliberately a script and not code
 * in a Cloud Function: a backfill is a one-time operator action on live data, and
 * burying it in a code path means it runs again, unattended, the next time
 * somebody imports.
 *
 * THE RUN IT WRITES IS MARKED `synthetic: true` AND HAS NO WRITER COUNTS.
 * A real run records what its writer committed. This one is reconstructed after
 * the fact from what is in the ledger now, which is not the same claim — some of
 * those policies may have been edited by a human since. Marking it keeps the two
 * kinds of run distinguishable forever, so nobody reads a reconstruction as a
 * measurement.
 *
 * Usage (DRY RUN by default — prints the plan and writes nothing):
 *   node functions/scripts/stamp-import-run.cjs --tenant tatillife_south \
 *        --uid <uid> --export-date 2026-09-15
 *   node functions/scripts/stamp-import-run.cjs --tenant tatillife_south \
 *        --uid <uid> --export-date 2026-09-15 --live
 *
 * Ambient credentials only; never a key file.
 */

const path = require('node:path');
const readline = require('node:readline/promises');

function loadAdmin() {
  try { return require('firebase-admin'); } catch { /* fall through */ }
  return require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
}

const IMPORT_SOURCE = 'oipa_import';
const MAX_WRITES = 450; // headroom under Firestore's 500-per-batch limit

const USAGE = `
stamp-import-run.cjs — backfill firstImportRunId / lastImportRunId onto policies
imported before import runs were recorded.

  --tenant <tenantId>       required
  --uid <uid>               required — the agent whose policies get stamped
  --export-date YYYY-MM-DD  required — only policies carrying this date are touched
  --live                    actually write. Without this, dry run only.
  --yes                     skip the interactive confirm (only with --live)

Dry run is the default and writes nothing.
`;

function parseArgs(argv) {
  const out = { live: false, yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--tenant') out.tenant = argv[++i];
    else if (argv[i] === '--uid') out.uid = argv[++i];
    else if (argv[i] === '--export-date') out.exportDate = argv[++i];
    else if (argv[i] === '--live') out.live = true;
    else if (argv[i] === '--yes') out.yes = true;
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
  }
  return out;
}

/**
 * This agent's imported policies at this export date, split by whether they have
 * already been stamped.
 *
 * Both `agentId` and `importSource` are applied as `where` clauses AND re-checked
 * in memory: a composite-index gap can change what a compound query returns, but
 * it cannot change what the documents say, and this script writes to production.
 */
async function findCandidates(db, tenant, uid, exportDate) {
  const snap = await db.collection(`tenants/${tenant}/policies`)
    .where('agentId', '==', uid)
    .where('importSource', '==', IMPORT_SOURCE)
    .get();

  const all = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.agentId === uid && d.importSource === IMPORT_SOURCE);

  const atDate = all.filter((d) => d.exportDate === exportDate);
  return {
    totalImported: all.length,
    atDate,
    unstamped: atDate.filter((d) => !d.firstImportRunId),
    alreadyStamped: atDate.filter((d) => d.firstImportRunId),
    otherDates: [...new Set(all.filter((d) => d.exportDate !== exportDate).map((d) => d.exportDate))],
  };
}

async function confirmLive(count, target) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n!! LIVE WRITE — stamping ${count} policy doc(s) under ${target}`);
  const answer = await rl.question('Type "yes" to proceed: ');
  rl.close();
  return answer.trim() === 'yes';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.tenant || !opts.uid || !opts.exportDate) {
    console.log(USAGE);
    return opts.help ? 0 : 2;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.exportDate)) {
    console.error(`--export-date must be YYYY-MM-DD, got "${opts.exportDate}"`);
    return 2;
  }
  if (opts.yes && !opts.live) {
    console.error('--yes only makes sense with --live');
    return 2;
  }

  const admin = loadAdmin();
  admin.initializeApp();
  const db = admin.firestore();
  const { FieldValue } = admin.firestore;

  const found = await findCandidates(db, opts.tenant, opts.uid, opts.exportDate);

  console.log('\n============ STAMP IMPORT RUN ============');
  console.log(`mode              ${opts.live ? 'LIVE (will write)' : 'DRY RUN (writes nothing)'}`);
  console.log(`tenant            ${opts.tenant}`);
  console.log(`agent uid         ${opts.uid}`);
  console.log(`export date       ${opts.exportDate}`);
  console.log(`imported total    ${found.totalImported}`);
  console.log(`at this date      ${found.atDate.length}`);
  console.log(`  to stamp        ${found.unstamped.length}`);
  console.log(`  already stamped ${found.alreadyStamped.length} (left alone)`);
  if (found.otherDates.length > 0) {
    console.log(`other export dates present, NOT touched: ${found.otherDates.join(', ')}`);
  }

  if (found.atDate.length === 0) {
    console.log('\nNothing matches that export date. Nothing to do.');
    return 0;
  }
  if (found.unstamped.length === 0) {
    console.log('\nEvery policy at that date already has a run id. Nothing to do.');
    return 0;
  }

  const runsCol = db.collection(`tenants/${opts.tenant}/users/${opts.uid}/importRuns`);
  const runRef = runsCol.doc();
  console.log(`\nwould create run  ${runRef.path}`);
  console.log(`would stamp       ${found.unstamped.length} policies with firstImportRunId = lastImportRunId = ${runRef.id}`);
  console.log(`sample            ${found.unstamped.slice(0, 5).map((d) => d.policyNumber).join(', ')}`);

  if (!opts.live) {
    console.log('\nDRY RUN — nothing was written. Re-run with --live to apply.');
    return 0;
  }
  if (!opts.yes && !(await confirmLive(found.unstamped.length, runRef.path))) {
    console.log('Aborted. Nothing was written.');
    return 1;
  }

  // The run doc goes FIRST. If the stamping loop then fails partway, the policies
  // that were stamped point at a run that exists, and re-running the script
  // stamps only the remainder — `unstamped` is computed from the documents, not
  // from a counter, so the script is safe to run again.
  await runRef.set({
    runId: runRef.id,
    agentId: opts.uid,
    tenantId: opts.tenant,
    exportDate: opts.exportDate,
    fileName: null,
    planId: null,
    status: 'complete',
    synthetic: true,
    syntheticNote:
      'Backfilled by functions/scripts/stamp-import-run.cjs. Reconstructed from the '
      + 'ledger after the fact, NOT measured by the writer that created these policies. '
      + 'Counts are null because no writer tally exists for this run.',
    startedAt: FieldValue.serverTimestamp(),
    startedAtMs: Date.now(),
    finishedAt: FieldValue.serverTimestamp(),
    finishedAtMs: Date.now(),
    counts: null,
    stampedPolicies: found.unstamped.length,
  });
  console.log(`\ncreated run       ${runRef.id}`);

  let batch = db.batch();
  let writes = 0;
  let stamped = 0;
  const flush = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const d of found.unstamped) {
    if (writes + 1 > MAX_WRITES) await flush();
    batch.update(db.doc(`tenants/${opts.tenant}/policies/${d.id}`), {
      firstImportRunId: runRef.id,
      lastImportRunId: runRef.id,
    });
    writes += 1;
    stamped += 1;
  }
  await flush();

  // Verified by re-reading, not by trusting the counter above.
  const after = await findCandidates(db, opts.tenant, opts.uid, opts.exportDate);
  console.log(`stamped           ${stamped}`);
  console.log(`remaining unstamped at this date: ${after.unstamped.length}`);
  return after.unstamped.length === 0 ? 0 : 1;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
