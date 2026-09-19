#!/usr/bin/env node
/**
 * stamp-status-provenance.cjs — gives already-imported policies a record of
 * where their status came from.
 *
 * P4e ruling 4. The 229 policies already in production were written before
 * status provenance existed. Their statuses ARE from the OIPA export — 117
 * settled, 87 lapsed, 22 ntu, 3 denied, with no manager step — but nothing on
 * the document says so, and on screen they are indistinguishable from a status
 * somebody typed.
 *
 * NOTHING IS INVENTED. Every value written here is read off the document itself:
 *   statusSource       — the constant, and only for docs whose importSource says
 *                        this policy came from the OIPA import in the first place
 *   statusSourceDetail — `oipaStatus / oipaSubStatus`, already stored per doc
 *   statusAsOf         — `exportDate`, already stored per doc
 *   statusSetBy        — the constant 'import'
 *
 * IT MUST NOT CHANGE A SINGLE STATUS VALUE, and it does not: `status` is never
 * in the update payload, and the script re-reads afterwards and compares every
 * status against a snapshot taken BEFORE the write. If even one moved it says
 * so and exits non-zero. That check is the point of the script, not decoration —
 * a backfill that quietly edited 229 statuses would be discovered by a manager,
 * not by the operator running it.
 *
 * A policy whose status a PERSON has since changed is left alone: its
 * `statusSource` would be 'agent' or 'manager', and stamping it 'oipa_import'
 * would overwrite the truth with a guess.
 *
 * Usage (DRY RUN by default — prints the plan and writes nothing):
 *   node functions/scripts/stamp-status-provenance.cjs --tenant tatillife_south --uid <uid>
 *   node functions/scripts/stamp-status-provenance.cjs --tenant tatillife_south --uid <uid> --live --yes
 *
 * `--yes` skips the interactive confirm. Pass it whenever there is no keyboard
 * attached: the prompt reads stdin and hangs forever without one.
 */

const path = require('node:path');
const readline = require('node:readline/promises');
const { pathToFileURL } = require('node:url');

function loadAdmin() {
  try { return require('firebase-admin'); } catch { /* fall through */ }
  return require(path.join(__dirname, '..', 'node_modules', 'firebase-admin'));
}

const MAX_WRITES = 450; // headroom under Firestore's 500-per-batch limit

const USAGE = `
stamp-status-provenance.cjs — backfill statusSource / statusSourceDetail /
statusAsOf / statusSetBy onto policies imported before P4e.

  --tenant <tenantId>   required
  --uid <uid>           required — the agent whose policies get stamped
  --live                actually write. Without this, dry run only.
  --yes                 skip the interactive confirm (only with --live)

Dry run is the default and writes nothing. It never changes a status value.
`;

function parseArgs(argv) {
  const out = { live: false, yes: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--tenant') out.tenant = argv[++i];
    else if (argv[i] === '--uid') out.uid = argv[++i];
    else if (argv[i] === '--live') out.live = true;
    else if (argv[i] === '--yes') out.yes = true;
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
  }
  return out;
}

/**
 * This agent's imported policies, split by whether they still need a stamp.
 *
 * Both `agentId` and `importSource` are applied as `where` clauses AND
 * re-checked in memory: a composite-index gap can change what a compound query
 * returns but cannot change what the documents say, and this writes to live data.
 */
async function survey(db, tenant, uid, cfg) {
  const snap = await db.collection(`tenants/${tenant}/policies`)
    .where('agentId', '==', uid)
    .where('importSource', '==', cfg.OIPA_IMPORT_SOURCE)
    .get();

  const all = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((d) => d.agentId === uid && d.importSource === cfg.OIPA_IMPORT_SOURCE);

  const humanSet = all.filter((d) => cfg.HUMAN_STATUS_SOURCES.includes(d.statusSource));
  const stamped = all.filter((d) => d.statusSource === cfg.STATUS_SOURCE_IMPORT);
  const toStamp = all.filter(
    (d) => !d.statusSource && !cfg.HUMAN_STATUS_SOURCES.includes(d.statusSource),
  );
  const noExportDate = toStamp.filter((d) => !d.exportDate);

  return { all, toStamp, stamped, humanSet, noExportDate };
}

async function confirmLive(count) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`\n!! LIVE WRITE — adding provenance fields to ${count} policy doc(s). No status value is touched.`);
  const answer = await rl.question('Type "yes" to proceed: ');
  rl.close();
  return answer.trim() === 'yes';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.tenant || !opts.uid) {
    console.log(USAGE);
    return opts.help ? 0 : 2;
  }
  if (opts.yes && !opts.live) {
    console.error('--yes only makes sense with --live');
    return 2;
  }

  const cfg = await import(
    pathToFileURL(path.join(__dirname, '..', 'portfolioImport', 'esm', 'oipaImportConfig.js')).href
  );

  const admin = loadAdmin();
  admin.initializeApp();
  const db = admin.firestore();

  const found = await survey(db, opts.tenant, opts.uid, cfg);

  console.log('\n========= STAMP STATUS PROVENANCE =========');
  console.log(`mode                ${opts.live ? 'LIVE (will write)' : 'DRY RUN (writes nothing)'}`);
  console.log(`tenant              ${opts.tenant}`);
  console.log(`agent uid           ${opts.uid}`);
  console.log(`imported policies   ${found.all.length}`);
  console.log(`  TO STAMP          ${found.toStamp.length}`);
  console.log(`  already stamped   ${found.stamped.length} (left alone)`);
  console.log(`  set by a person   ${found.humanSet.length} (left alone — stamping these would overwrite the truth)`);
  console.log('status values to change: 0   (this script never writes `status`)');

  if (found.noExportDate.length > 0) {
    // Without an export date there is no honest `statusAsOf`. Refuse rather than
    // invent one: a wrong date on a status is worse than a missing one.
    console.error(
      `\nREFUSING: ${found.noExportDate.length} policy doc(s) have no exportDate, so statusAsOf cannot be filled `
      + `without inventing it. First few: ${found.noExportDate.slice(0, 5).map((d) => d.policyNumber).join(', ')}`,
    );
    return 2;
  }

  if (found.toStamp.length === 0) {
    console.log('\nNothing to stamp. Nothing to do.');
    return 0;
  }

  const sample = found.toStamp[0];
  console.log('\nexample of what would be written:');
  console.log(`  ${sample.policyNumber}  status ${sample.status} (UNCHANGED)`);
  console.log(`    statusSource       ${cfg.STATUS_SOURCE_IMPORT}`);
  console.log(`    statusSourceDetail ${cfg.formatStatusSourceDetail(sample.oipaStatus, sample.oipaSubStatus)}`);
  console.log(`    statusAsOf         ${sample.exportDate}`);
  console.log(`    statusSetBy        ${cfg.STATUS_SET_BY_IMPORT}`);

  if (!opts.live) {
    console.log('\nDRY RUN — nothing was written. Re-run with --live --yes to apply.');
    return 0;
  }
  if (!opts.yes && !(await confirmLive(found.toStamp.length))) {
    console.log('Aborted. Nothing was written.');
    return 1;
  }

  // The before-snapshot is what makes "0 status values changed" a MEASUREMENT
  // rather than a claim about the payload.
  const statusBefore = new Map(found.all.map((d) => [d.id, d.status]));

  let batch = db.batch();
  let writes = 0;
  let stamped = 0;
  const flush = async () => {
    if (writes === 0) return;
    await batch.commit();
    batch = db.batch();
    writes = 0;
  };

  for (const d of found.toStamp) {
    if (writes + 1 > MAX_WRITES) await flush();
    batch.update(db.doc(`tenants/${opts.tenant}/policies/${d.id}`), {
      statusSource: cfg.STATUS_SOURCE_IMPORT,
      statusSourceDetail: cfg.formatStatusSourceDetail(d.oipaStatus, d.oipaSubStatus),
      statusAsOf: d.exportDate,
      statusSetBy: cfg.STATUS_SET_BY_IMPORT,
    });
    writes += 1;
    stamped += 1;
  }
  await flush();

  // Verified by re-reading, and by comparing every status against the snapshot.
  const after = await survey(db, opts.tenant, opts.uid, cfg);
  const moved = after.all.filter((d) => statusBefore.get(d.id) !== d.status);

  console.log(`\nstamped             ${stamped}`);
  console.log(`remaining unstamped ${after.toStamp.length}`);
  console.log(`STATUS VALUES CHANGED ${moved.length}  (must be 0)`);
  if (moved.length > 0) {
    console.error('STATUS MOVED — this script must never do that:',
      moved.map((d) => `${d.policyNumber}: ${statusBefore.get(d.id)} -> ${d.status}`).join(', '));
    return 1;
  }
  return after.toStamp.length === 0 ? 0 : 1;
}

main().then((c) => process.exit(c)).catch((e) => { console.error(e); process.exit(1); });
